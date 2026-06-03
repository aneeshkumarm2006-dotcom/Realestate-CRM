const Automation = require('../models/Automation');
const Task = require('../models/Task');
const TaskGroup = require('../models/TaskGroup');
const Board = require('../models/Board');
const eventBus = require('./eventBus');
const { runAutomationOnce } = require('../controllers/automationController');

let mounted = false;

/**
 * Read a task's current status id, accounting for the flexible-columns
 * engine (F1). When `board.useFlexibleColumns === true`, walk the board's
 * `columns` to find the `status`-typed column (preferring `key === 'status'`)
 * and return the value from `task.columnValues[colId]`. Otherwise fall back
 * to the legacy `task.status` field.
 *
 * Returns a string (or null). Used by ITEM_IN_STATUS condition evaluation
 * downstream of the create payload so re-evaluating against a refetched task
 * picks up the right value regardless of which storage owns it.
 */
const readCurrentStatusId = (task, board) => {
  if (board && board.useFlexibleColumns && Array.isArray(board.columns) && board.columns.length > 0) {
    const statusCol =
      board.columns.find((c) => c.key === 'status' && c.type === 'status') ||
      board.columns.find((c) => c.type === 'status');
    if (statusCol && task && task.columnValues) {
      const raw =
        typeof task.columnValues.get === 'function'
          ? task.columnValues.get(statusCol._id.toString())
          : task.columnValues[statusCol._id.toString()];
      if (raw != null) return raw.toString();
    }
  }
  return task && task.status ? task.status.toString() : null;
};

/**
 * True if every condition on the automation matches the triggering task.
 * An empty `conditions` array is treated as "match everything" — the
 * automation fires on every item creation for its board.
 */
const evaluateConditions = (automation, payload) => {
  const conds = Array.isArray(automation.conditions) ? automation.conditions : [];
  if (conds.length === 0) return true;
  for (const c of conds) {
    if (!c?.type || !c?.value) return false;
    const target = c.value.toString();
    if (c.type === 'ITEM_IN_GROUP') {
      if (!payload.groupId || payload.groupId.toString() !== target) return false;
    } else if (c.type === 'ITEM_IN_STATUS') {
      if (!payload.statusId || payload.statusId.toString() !== target) return false;
    } else {
      // Unknown condition types are treated as failing matches so we
      // don't accidentally run automations the user can't see.
      return false;
    }
  }
  return true;
};

/**
 * True if every condition on a GROUP_CREATED automation matches the new
 * group. Conditions for this trigger only support GROUP_NAME_MATCHES today
 * (value is a regex string). An empty conditions array matches every group.
 */
const evaluateGroupCreatedConditions = (automation, payload) => {
  const conds = Array.isArray(automation.conditions) ? automation.conditions : [];
  if (conds.length === 0) return true;
  const name = payload.groupName == null ? '' : String(payload.groupName);
  for (const c of conds) {
    if (!c?.type || c.value == null) return false;
    if (c.type === 'GROUP_NAME_MATCHES') {
      let re;
      try {
        re = new RegExp(String(c.value));
      } catch (err) {
        console.error(
          '[automation/dispatcher] invalid GROUP_NAME_MATCHES regex',
          c.value,
          err.message
        );
        return false;
      }
      if (!re.test(name)) return false;
    } else {
      // Unknown condition types — treat as failing matches so the
      // automation can't fire on payloads it wasn't designed for.
      return false;
    }
  }
  return true;
};

const handleGroupCreated = async (payload) => {
  if (!payload || !payload.groupId || !payload.boardId) return;

  let triggeringGroup;
  try {
    triggeringGroup = await TaskGroup.findById(payload.groupId);
  } catch (err) {
    console.error('[automation/dispatcher] failed to load triggering group:', err);
    return;
  }
  if (!triggeringGroup) return;

  let automations;
  try {
    automations = await Automation.find({
      board: payload.boardId,
      enabled: true,
      triggerType: 'GROUP_CREATED',
    });
  } catch (err) {
    console.error('[automation/dispatcher] failed to query automations:', err);
    return;
  }

  for (const automation of automations) {
    if (!evaluateGroupCreatedConditions(automation, payload)) continue;
    try {
      await runAutomationOnce(automation, { triggeringGroup });
      automation.lastRunAt = new Date();
      await automation.save();
    } catch (err) {
      console.error(
        '[automation/dispatcher] failed to run automation',
        automation?._id?.toString(),
        err
      );
    }
  }
};

const handleItemCreated = async (payload) => {
  if (!payload || !payload.taskId || !payload.boardId) return;

  // Fetch the triggering task so action handlers (CREATE_SUBITEM) have the
  // full doc. Skip automation-created tasks outright — the flag is the
  // primary defence against infinite trigger loops.
  let triggeringTask;
  try {
    triggeringTask = await Task.findById(payload.taskId);
  } catch (err) {
    console.error('[automation/dispatcher] failed to load triggering task:', err);
    return;
  }
  if (!triggeringTask) return;
  if (triggeringTask.createdByAutomation) return;
  if (triggeringTask.parent) return; // subitems never trigger

  // F1 shim: on flexible-columns boards the create payload's `statusId`
  // can be stale relative to columnValues. Refresh from the board's
  // status column so ITEM_IN_STATUS conditions evaluate consistently.
  let board = null;
  try {
    board = await Board.findById(payload.boardId).select('useFlexibleColumns columns').lean();
  } catch (err) {
    console.error('[automation/dispatcher] failed to load board for shim:', err);
  }
  if (board && board.useFlexibleColumns) {
    const refreshedStatusId = readCurrentStatusId(triggeringTask, board);
    if (refreshedStatusId) {
      payload = { ...payload, statusId: refreshedStatusId };
    }
  }

  let automations;
  try {
    automations = await Automation.find({
      board: payload.boardId,
      enabled: true,
      triggerType: 'ITEM_CREATED',
    });
  } catch (err) {
    console.error('[automation/dispatcher] failed to query automations:', err);
    return;
  }

  for (const automation of automations) {
    if (!evaluateConditions(automation, payload)) continue;
    try {
      await runAutomationOnce(automation, { triggeringTask });
      automation.lastRunAt = new Date();
      await automation.save();
    } catch (err) {
      console.error(
        '[automation/dispatcher] failed to run automation',
        automation?._id?.toString(),
        err
      );
    }
  }
};

// ===========================================================================
// F4 — event-driven triggers (COLUMN_VALUE_CHANGED / STATUS_BECAME /
// DATE_ARRIVED-via-runner / PERSON_ASSIGNED / FORM_SUBMITTED / WEBHOOK_RECEIVED)
// ===========================================================================

const asId = (v) => (v == null ? '' : v.toString());

/**
 * Per-trigger `triggerConfig` matchers. Each takes the automation's stored
 * config and the event payload and returns true when the trigger's *watched
 * surface* matches (column/value/user/form/endpoint). Conditions are evaluated
 * separately — these only decide relevance.
 */
const TRIGGER_MATCHERS = {
  // { columnId? } — empty means any column.
  COLUMN_VALUE_CHANGED: (cfg, payload) => {
    if (!cfg || !cfg.columnId) return true;
    return asId(cfg.columnId) === asId(payload.columnId);
  },
  // { columnId, fromValue?, toValue } — compares against option ids.
  STATUS_BECAME: (cfg, payload) => {
    if (!cfg || asId(cfg.columnId) !== asId(payload.columnId)) return false;
    if (asId(cfg.toValue) !== asId(payload.toValue)) return false;
    if (cfg.fromValue != null && cfg.fromValue !== '') {
      if (asId(cfg.fromValue) !== asId(payload.fromValue)) return false;
    }
    return true;
  },
  // { columnId, userId? } — userId (if set) must be among the net-added users.
  PERSON_ASSIGNED: (cfg, payload) => {
    if (!cfg || asId(cfg.columnId) !== asId(payload.columnId)) return false;
    if (cfg.userId != null && cfg.userId !== '') {
      const added = Array.isArray(payload.addedUserIds)
        ? payload.addedUserIds.map(asId)
        : [];
      if (!added.includes(asId(cfg.userId))) return false;
    }
    return true;
  },
  // Dormant until F13 emits `form.submitted`. { formId? }.
  FORM_SUBMITTED: (cfg, payload) =>
    !cfg || !cfg.formId || asId(cfg.formId) === asId(payload.formId),
  // Dormant until F7 emits `webhook.received`. { endpointId? }.
  WEBHOOK_RECEIVED: (cfg, payload) =>
    !cfg || !cfg.endpointId || asId(cfg.endpointId) === asId(payload.endpointId),
};

/**
 * Run an automation's actions and summarise each outcome for triggerHistory.
 * F4-level granularity: the whole run succeeds (every action `ok`) or throws
 * (every action `failed` with the error). F5.4 replaces this with true
 * per-action outcomes once the actionTypes registry lands.
 */
const runActionsAndSummarize = async (automation, ctx) => {
  const actions = Array.isArray(automation.actions) ? automation.actions : [];
  try {
    await runAutomationOnce(automation, ctx);
    return actions.map((a) => ({ actionType: a.type, status: 'ok' }));
  } catch (err) {
    console.error(
      '[automation/dispatcher] action run failed for',
      automation?._id?.toString(),
      err
    );
    return actions.map((a) => ({
      actionType: a.type,
      status: 'failed',
      error: err.message,
    }));
  }
};

/**
 * Generic handler for the F4 task-scoped triggers. Loads the triggering task
 * (skipping automation-created tasks — the loop guard), then for every enabled
 * automation of `triggerType` on the board:
 *   - skips entirely when triggerConfig doesn't match (not relevant, no log);
 *   - logs `matched: false` when the watched surface matched but a condition
 *     rejected the event (so users can debug a non-firing automation);
 *   - otherwise runs the actions and logs `matched: true` with per-action
 *     outcomes.
 * Mirrors `handleItemCreated`'s structure (load task, skip createdByAutomation).
 */
const handleTaskTriggerEvent = async (triggerType, payload) => {
  if (!payload || !payload.taskId || !payload.boardId) return;
  const matchFn = TRIGGER_MATCHERS[triggerType];
  if (!matchFn) return;

  let triggeringTask;
  try {
    triggeringTask = await Task.findById(payload.taskId);
  } catch (err) {
    console.error('[automation/dispatcher] failed to load triggering task:', err);
    return;
  }
  if (!triggeringTask) return;
  // Loop guard: never react to a task an automation created/just wrote. The
  // F5 `_originAutomationId` tag will refine this for SET_COLUMN_VALUE chains.
  if (triggeringTask.createdByAutomation) return;

  // Resolve group/status for ITEM_IN_GROUP / ITEM_IN_STATUS condition eval.
  let board = null;
  try {
    board = await Board.findById(payload.boardId)
      .select('useFlexibleColumns columns statuses')
      .lean();
  } catch (err) {
    console.error('[automation/dispatcher] failed to load board:', err);
  }
  const condPayload = {
    groupId: triggeringTask.group,
    statusId: readCurrentStatusId(triggeringTask, board),
  };

  let automations;
  try {
    automations = await Automation.find({
      board: payload.boardId,
      enabled: true,
      triggerType,
    });
  } catch (err) {
    console.error('[automation/dispatcher] failed to query automations:', err);
    return;
  }

  for (const automation of automations) {
    const cfg = automation.triggerConfig || {};
    if (!matchFn(cfg, payload)) continue; // watched surface didn't match

    if (!evaluateConditions(automation, condPayload)) {
      // Relevant but filtered out by a condition — record for debugging.
      Automation.appendTriggerHistory(automation, {
        taskId: triggeringTask._id,
        matched: false,
        actionsRun: [],
      });
      try {
        await automation.save();
      } catch (err) {
        console.error('[automation/dispatcher] failed to save history:', err);
      }
      continue;
    }

    const actionsRun = await runActionsAndSummarize(automation, { triggeringTask });
    Automation.appendTriggerHistory(automation, {
      taskId: triggeringTask._id,
      matched: true,
      actionsRun,
    });
    automation.lastRunAt = new Date();
    try {
      await automation.save();
    } catch (err) {
      console.error(
        '[automation/dispatcher] failed to run automation',
        automation?._id?.toString(),
        err
      );
    }
  }
};

const handleColumnChanged = (payload) =>
  handleTaskTriggerEvent('COLUMN_VALUE_CHANGED', payload);
const handleStatusBecame = (payload) =>
  handleTaskTriggerEvent('STATUS_BECAME', payload);
const handlePersonAssigned = (payload) =>
  handleTaskTriggerEvent('PERSON_ASSIGNED', payload);

// Dormant cross-phase handlers — registered now so the emitters in F7/F13 land
// into live subscribers (exactly how the F1 events were dormant in Phase 1).
// They share the task-trigger machinery; until a real `form.submitted` /
// `webhook.received` payload (carrying a taskId) is emitted, these no-op.
const handleFormSubmitted = (payload) =>
  handleTaskTriggerEvent('FORM_SUBMITTED', payload);
const handleWebhookReceived = (payload) =>
  handleTaskTriggerEvent('WEBHOOK_RECEIVED', payload);

/**
 * F9 lead-intake hook: routed through both the WEBHOOK_RECEIVED and
 * FORM_SUBMITTED matchers so an intake event can fire either family. Safe
 * no-op until `lead.intake` is emitted in Phase 3.
 */
const handleLeadIntake = async (payload) => {
  await handleTaskTriggerEvent('WEBHOOK_RECEIVED', payload);
  await handleTaskTriggerEvent('FORM_SUBMITTED', payload);
};

/**
 * Subscribe the dispatcher to the event bus. Idempotent — safe to call
 * multiple times across hot-reloads.
 */
const mountAutomationEventDispatcher = () => {
  if (mounted) return;
  mounted = true;

  const wrap = (fn) => (payload) =>
    Promise.resolve(fn(payload)).catch((err) =>
      console.error('[automation/dispatcher] unhandled error:', err)
    );

  eventBus.on('item.created', wrap(handleItemCreated));
  eventBus.on('group.created', wrap(handleGroupCreated));
  // F4 — F1 column events.
  eventBus.on('task.column_changed', wrap(handleColumnChanged));
  eventBus.on('task.status_became', wrap(handleStatusBecame));
  eventBus.on('task.person_assigned', wrap(handlePersonAssigned));
  // F4 — cross-phase stubs (dormant until F7/F13/F9 emit them).
  eventBus.on('webhook.received', wrap(handleWebhookReceived));
  eventBus.on('form.submitted', wrap(handleFormSubmitted));
  eventBus.on('lead.intake', wrap(handleLeadIntake));

  console.log('automation event dispatcher mounted');
};

module.exports = {
  mountAutomationEventDispatcher,
  evaluateConditions,
  evaluateGroupCreatedConditions,
  readCurrentStatusId,
  // Exported for unit tests.
  TRIGGER_MATCHERS,
  handleTaskTriggerEvent,
};

const Automation = require('../models/Automation');
const Task = require('../models/Task');
const eventBus = require('./eventBus');
const { runAutomationOnce } = require('../controllers/automationController');

let mounted = false;

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

/**
 * Subscribe the dispatcher to the event bus. Idempotent — safe to call
 * multiple times across hot-reloads.
 */
const mountAutomationEventDispatcher = () => {
  if (mounted) return;
  mounted = true;
  eventBus.on('item.created', (payload) => {
    handleItemCreated(payload).catch((err) =>
      console.error('[automation/dispatcher] unhandled error:', err)
    );
  });
  console.log('automation event dispatcher mounted');
};

module.exports = {
  mountAutomationEventDispatcher,
  evaluateConditions,
};

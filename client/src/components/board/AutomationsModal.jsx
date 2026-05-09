import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Play,
  ChevronLeft,
  Zap,
} from 'lucide-react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import AssigneePicker from './AssigneePicker';
import * as automationService from '../../services/automationService';

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const WEEKDAY_CHIPS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const getBrowserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const getTimezoneList = () => {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone');
    }
  } catch {
    // fall through
  }
  return null;
};

const describeSchedule = (s) => {
  if (!s) return '';
  const hh = String(s.hour ?? 9).padStart(2, '0');
  const tz = s.timezone && s.timezone !== 'UTC' ? ` (${s.timezone})` : '';
  if (s.frequency === 'daily') return `Daily at ${hh}:00${tz}`;
  if (s.frequency === 'weekly') {
    const days = (s.daysOfWeek || []).slice().sort();
    const labels = days.map((d) => WEEKDAY_SHORT[d]).join(', ');
    return `Weekly · ${labels || '—'} at ${hh}:00${tz}`;
  }
  if (s.frequency === 'monthly') {
    return `Monthly · day ${s.dayOfMonth} at ${hh}:00${tz}`;
  }
  return '';
};

const describeTemplate = (t) => {
  if (!t) return '';
  const groupName = t.group?.name || '—';
  const due =
    Number.isFinite(t.dueInDays) && t.dueInDays !== null
      ? `, due in ${t.dueInDays} day${t.dueInDays === 1 ? '' : 's'}`
      : '';
  return `→ "${t.name}" in ${groupName}${due}`;
};

const formatNextRun = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const buildInitialForm = (groups) => ({
  name: '',
  frequency: 'weekly',
  daysOfWeek: [1],
  dayOfMonth: 1,
  hour: 9,
  timezone: getBrowserTimezone(),
  templateName: '',
  group: groups?.[0]?._id || '',
  priority: 'medium',
  assignedTo: [],
  dueInDays: '',
  note: '',
  enabled: true,
});

const formFromAutomation = (a, groups) => {
  const s = a.schedule || {};
  const t = a.taskTemplate || {};
  const groupId =
    typeof t.group === 'object' && t.group !== null ? t.group._id : t.group;
  return {
    name: a.name || '',
    frequency: s.frequency || 'weekly',
    daysOfWeek: Array.isArray(s.daysOfWeek) && s.daysOfWeek.length > 0
      ? s.daysOfWeek
      : [1],
    dayOfMonth: s.dayOfMonth || 1,
    hour: typeof s.hour === 'number' ? s.hour : 9,
    timezone: s.timezone || getBrowserTimezone(),
    templateName: t.name || '',
    group: groupId || groups?.[0]?._id || '',
    priority: t.priority || 'medium',
    assignedTo: (t.assignedTo || []).map((u) =>
      typeof u === 'object' && u !== null ? u._id : u
    ),
    dueInDays:
      Number.isFinite(t.dueInDays) && t.dueInDays !== null
        ? String(t.dueInDays)
        : '',
    note: t.note || '',
    enabled: a.enabled !== false,
  };
};

const SegmentedControl = ({ options, value, onChange, disabled }) => (
  <div
    className="inline-flex"
    style={{
      border: '1.5px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding: 2,
      background: 'var(--color-bg-input)',
    }}
  >
    {options.map((opt) => {
      const selected = opt.value === value;
      return (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className="font-body"
          style={{
            fontSize: 13,
            fontWeight: selected ? 600 : 500,
            padding: '6px 14px',
            borderRadius: 'var(--radius-sm)',
            background: selected ? 'var(--color-accent)' : 'transparent',
            color: selected ? '#FFFFFF' : 'var(--color-text-secondary)',
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'background 150ms ease, color 150ms ease',
          }}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

const WeekdayChips = ({ value, onChange, disabled }) => {
  const set = new Set(value || []);
  return (
    <div className="flex flex-wrap gap-2">
      {WEEKDAY_CHIPS.map((c) => {
        const selected = set.has(c.value);
        return (
          <button
            key={c.value}
            type="button"
            disabled={disabled}
            onClick={() => {
              const next = new Set(set);
              if (next.has(c.value)) next.delete(c.value);
              else next.add(c.value);
              onChange(Array.from(next));
            }}
            className="font-body"
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              border: selected
                ? '1.5px solid var(--color-accent)'
                : '1.5px solid var(--color-border)',
              background: selected ? 'var(--color-accent-light)' : 'transparent',
              color: selected
                ? 'var(--color-accent-text)'
                : 'var(--color-text-secondary)',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
};

const SelectField = ({ label, value, onChange, options, disabled, listId }) => (
  <div>
    {label && (
      <label
        className="block mb-2 font-body font-medium text-xs uppercase tracking-wide"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
      </label>
    )}
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      list={listId}
      className="w-full font-body"
      style={{
        height: 38,
        padding: '0 10px',
        borderRadius: 'var(--radius-md)',
        border: '1.5px solid var(--color-border)',
        background: 'var(--color-bg-input)',
        color: 'var(--color-text-primary)',
        fontSize: 14,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

const Toggle = ({ checked, onChange, disabled, label }) => (
  <label
    className="inline-flex items-center gap-2 select-none"
    style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
  >
    <span
      style={{
        position: 'relative',
        width: 36,
        height: 20,
        borderRadius: 999,
        background: checked
          ? 'var(--color-accent)'
          : 'var(--color-border-strong)',
        transition: 'background 150ms ease',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#FFFFFF',
          transition: 'left 150ms ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }}
      />
    </span>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="sr-only"
    />
    {label && (
      <span
        className="font-body"
        style={{ fontSize: 13, color: 'var(--color-text-primary)' }}
      >
        {label}
      </span>
    )}
  </label>
);

const AutomationsModal = ({
  isOpen,
  onClose,
  boardId,
  groups = [],
  members = [],
  isAdmin = false,
}) => {
  const [view, setView] = useState('list');
  const [editingId, setEditingId] = useState(null);
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState(null);
  const [form, setForm] = useState(() => buildInitialForm(groups));
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const tzList = useMemo(() => getTimezoneList(), []);

  useEffect(() => {
    if (!isOpen || !boardId) return;
    setView('list');
    setEditingId(null);
    setListError(null);
    setLoading(true);
    automationService
      .listAutomations(boardId)
      .then((data) => setAutomations(data || []))
      .catch((err) => {
        console.error('Failed to load automations:', err);
        setListError(
          err?.response?.data?.error ||
            'Failed to load automations. Please try again.'
        );
      })
      .finally(() => setLoading(false));
  }, [isOpen, boardId]);

  const groupOptions = useMemo(
    () => groups.map((g) => ({ value: g._id, label: g.name })),
    [groups]
  );

  const hourOptions = useMemo(
    () =>
      HOURS.map((h) => ({
        value: h,
        label: `${String(h).padStart(2, '0')}:00`,
      })),
    []
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(buildInitialForm(groups));
    setFormError(null);
    setView('form');
  };

  const openEdit = (automation) => {
    setEditingId(automation._id);
    setForm(formFromAutomation(automation, groups));
    setFormError(null);
    setView('form');
  };

  const backToList = () => {
    if (saving) return;
    setView('list');
    setEditingId(null);
    setFormError(null);
  };

  const handleClose = () => {
    if (saving) return;
    onClose?.();
  };

  const buildPayload = () => {
    const schedule = {
      frequency: form.frequency,
      hour: Number(form.hour),
      timezone: form.timezone || 'UTC',
    };
    if (form.frequency === 'weekly') {
      schedule.daysOfWeek = form.daysOfWeek;
    }
    if (form.frequency === 'monthly') {
      schedule.dayOfMonth = Number(form.dayOfMonth);
    }
    const dueInDays =
      form.dueInDays === '' || form.dueInDays === null
        ? null
        : Number(form.dueInDays);
    return {
      name: form.name.trim(),
      enabled: form.enabled,
      schedule,
      taskTemplate: {
        name: form.templateName.trim(),
        group: form.group,
        priority: form.priority,
        assignedTo: form.assignedTo,
        note: form.note.trim() || undefined,
        dueInDays,
      },
    };
  };

  const validateLocal = () => {
    if (!form.name.trim()) return 'Automation name is required';
    if (!form.templateName.trim()) return 'Task title is required';
    if (!form.group) return 'Please choose a group';
    if (form.frequency === 'weekly' && (!form.daysOfWeek || form.daysOfWeek.length === 0)) {
      return 'Pick at least one day of the week';
    }
    if (form.frequency === 'monthly') {
      const d = Number(form.dayOfMonth);
      if (!Number.isInteger(d) || d < 1 || d > 31) {
        return 'Day of month must be between 1 and 31';
      }
    }
    if (form.dueInDays !== '' && form.dueInDays !== null) {
      const n = Number(form.dueInDays);
      if (!Number.isFinite(n) || n < 0) {
        return 'Due in days must be a non-negative number';
      }
    }
    return null;
  };

  const handleSave = async () => {
    const err = validateLocal();
    if (err) {
      setFormError(err);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = buildPayload();
      if (editingId) {
        const updated = await automationService.updateAutomation(editingId, payload);
        setAutomations((list) =>
          list.map((a) => (a._id === updated._id ? updated : a))
        );
      } else {
        const created = await automationService.createAutomation(boardId, payload);
        setAutomations((list) => [created, ...list]);
      }
      setView('list');
      setEditingId(null);
    } catch (e) {
      setFormError(
        e?.response?.data?.error || 'Failed to save automation. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (automation) => {
    if (!window.confirm(`Delete automation "${automation.name}"?`)) return;
    setBusyId(automation._id);
    try {
      await automationService.deleteAutomation(automation._id);
      setAutomations((list) => list.filter((a) => a._id !== automation._id));
    } catch (e) {
      setListError(
        e?.response?.data?.error || 'Failed to delete automation.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleToggle = async (automation, enabled) => {
    setBusyId(automation._id);
    try {
      const updated = await automationService.updateAutomation(automation._id, {
        enabled,
      });
      setAutomations((list) =>
        list.map((a) => (a._id === updated._id ? updated : a))
      );
    } catch (e) {
      setListError(
        e?.response?.data?.error || 'Failed to update automation.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleRunNow = async (automation) => {
    setBusyId(automation._id);
    try {
      const data = await automationService.runAutomationNow(automation._id);
      if (data?.automation) {
        setAutomations((list) =>
          list.map((a) => (a._id === data.automation._id ? data.automation : a))
        );
      }
    } catch (e) {
      setListError(
        e?.response?.data?.error || 'Failed to run automation.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleRunNowFromForm = async () => {
    if (!editingId) return;
    setSaving(true);
    setFormError(null);
    try {
      const data = await automationService.runAutomationNow(editingId);
      if (data?.automation) {
        setAutomations((list) =>
          list.map((a) => (a._id === data.automation._id ? data.automation : a))
        );
      }
    } catch (e) {
      setFormError(
        e?.response?.data?.error || 'Failed to run automation.'
      );
    } finally {
      setSaving(false);
    }
  };

  const renderListView = () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p
          className="font-body"
          style={{ fontSize: 13, color: 'var(--color-text-muted)' }}
        >
          Automatically create tasks on a recurring schedule.
        </p>
        {isAdmin && (
          <Button variant="primary" size="sm" icon={Plus} onClick={openCreate}>
            New Automation
          </Button>
        )}
      </div>

      {listError && (
        <p
          className="font-body text-xs"
          style={{ color: 'var(--color-status-stuck)' }}
        >
          {listError}
        </p>
      )}

      {loading ? (
        <p
          className="font-body"
          style={{ fontSize: 13, color: 'var(--color-text-muted)' }}
        >
          Loading…
        </p>
      ) : automations.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center text-center"
          style={{ padding: '32px 16px', color: 'var(--color-text-muted)' }}
        >
          <Zap size={28} aria-hidden="true" />
          <p className="font-body mt-2" style={{ fontSize: 14 }}>
            No automations yet
          </p>
          <p className="font-body" style={{ fontSize: 12 }}>
            Create one to spawn tasks on a schedule.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {automations.map((a) => {
            const isBusy = busyId === a._id;
            return (
              <li
                key={a._id}
                style={{
                  border: '1.5px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  background: a.enabled
                    ? 'var(--color-bg-surface)'
                    : 'var(--color-bg-subtle)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-display font-semibold truncate"
                        style={{
                          fontSize: 14,
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {a.name}
                      </span>
                      {!a.enabled && (
                        <span
                          className="font-body"
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            background: 'var(--color-bg-subtle)',
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          paused
                        </span>
                      )}
                    </div>
                    <p
                      className="font-body mt-1"
                      style={{
                        fontSize: 12,
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {describeSchedule(a.schedule)}
                    </p>
                    <p
                      className="font-body"
                      style={{ fontSize: 12, color: 'var(--color-text-muted)' }}
                    >
                      {describeTemplate(a.taskTemplate)}
                    </p>
                    <p
                      className="font-body mt-1"
                      style={{ fontSize: 11, color: 'var(--color-text-muted)' }}
                    >
                      Next run: {a.enabled ? formatNextRun(a.nextRunAt) : 'paused'}
                      {a.lastRunAt && ` · Last: ${formatNextRun(a.lastRunAt)}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Toggle
                      checked={a.enabled}
                      disabled={isBusy}
                      onChange={(v) => handleToggle(a, v)}
                    />
                    <button
                      type="button"
                      onClick={() => handleRunNow(a)}
                      disabled={isBusy}
                      aria-label="Run now"
                      title="Run now"
                      className="flex items-center justify-center rounded-md transition-colors duration-150 hover:bg-[color:var(--color-bg-subtle)]"
                      style={{
                        width: 30,
                        height: 30,
                        border: '1.5px solid var(--color-border)',
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                        opacity: isBusy ? 0.6 : 1,
                      }}
                    >
                      <Play size={14} color="var(--color-text-secondary)" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(a)}
                      disabled={isBusy}
                      aria-label="Edit"
                      title="Edit"
                      className="flex items-center justify-center rounded-md transition-colors duration-150 hover:bg-[color:var(--color-bg-subtle)]"
                      style={{
                        width: 30,
                        height: 30,
                        border: '1.5px solid var(--color-border)',
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                        opacity: isBusy ? 0.6 : 1,
                      }}
                    >
                      <Pencil size={14} color="var(--color-text-secondary)" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(a)}
                      disabled={isBusy}
                      aria-label="Delete"
                      title="Delete"
                      className="flex items-center justify-center rounded-md transition-colors duration-150 hover:bg-[color:var(--color-bg-subtle)]"
                      style={{
                        width: 30,
                        height: 30,
                        border: '1.5px solid var(--color-border)',
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                        opacity: isBusy ? 0.6 : 1,
                      }}
                    >
                      <Trash2 size={14} color="#DC2626" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const setField = (k) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [k]: value }));
  };

  const renderFormView = () => (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={backToList}
        disabled={saving}
        className="inline-flex items-center gap-1 self-start font-body"
        style={{
          fontSize: 13,
          color: 'var(--color-text-muted)',
          background: 'transparent',
          border: 'none',
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        <ChevronLeft size={14} aria-hidden="true" />
        Back to list
      </button>

      <Input
        label="Automation Name"
        placeholder="e.g. Weekly standup task"
        value={form.name}
        onChange={setField('name')}
        required
        disabled={saving}
        autoFocus
      />

      <div>
        <label
          className="block mb-2 font-body font-medium text-xs uppercase tracking-wide"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Frequency
        </label>
        <SegmentedControl
          options={FREQUENCIES}
          value={form.frequency}
          onChange={(v) => setForm((f) => ({ ...f, frequency: v }))}
          disabled={saving}
        />
      </div>

      {form.frequency === 'weekly' && (
        <div>
          <label
            className="block mb-2 font-body font-medium text-xs uppercase tracking-wide"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Days of week
          </label>
          <WeekdayChips
            value={form.daysOfWeek}
            onChange={(v) => setForm((f) => ({ ...f, daysOfWeek: v }))}
            disabled={saving}
          />
        </div>
      )}

      {form.frequency === 'monthly' && (
        <Input
          label="Day of month"
          type="number"
          min={1}
          max={31}
          value={form.dayOfMonth}
          onChange={(e) =>
            setForm((f) => ({ ...f, dayOfMonth: e.target.value }))
          }
          disabled={saving}
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Time of day"
          value={form.hour}
          onChange={(e) =>
            setForm((f) => ({ ...f, hour: Number(e.target.value) }))
          }
          options={hourOptions}
          disabled={saving}
        />
        <div>
          <label
            className="block mb-2 font-body font-medium text-xs uppercase tracking-wide"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Timezone
          </label>
          {tzList ? (
            <select
              value={form.timezone}
              onChange={(e) =>
                setForm((f) => ({ ...f, timezone: e.target.value }))
              }
              disabled={saving}
              className="w-full font-body"
              style={{
                height: 38,
                padding: '0 10px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--color-border)',
                background: 'var(--color-bg-input)',
                color: 'var(--color-text-primary)',
                fontSize: 14,
              }}
            >
              {tzList.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          ) : (
            <Input
              value={form.timezone}
              onChange={(e) =>
                setForm((f) => ({ ...f, timezone: e.target.value }))
              }
              disabled={saving}
              placeholder="e.g. Europe/Paris"
            />
          )}
        </div>
      </div>

      <div
        style={{
          height: 1,
          background: 'var(--color-border)',
          margin: '4px 0',
        }}
      />

      <Input
        label="Task Title"
        placeholder="e.g. Daily standup"
        value={form.templateName}
        onChange={setField('templateName')}
        required
        disabled={saving}
      />

      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Group"
          value={form.group}
          onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
          options={groupOptions.length > 0 ? groupOptions : [{ value: '', label: 'No groups' }]}
          disabled={saving || groupOptions.length === 0}
        />
        <SelectField
          label="Priority"
          value={form.priority}
          onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
          options={PRIORITIES}
          disabled={saving}
        />
      </div>

      <div>
        <label
          className="block mb-2 font-body font-medium text-xs uppercase tracking-wide"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Assignees
        </label>
        <AssigneePicker
          members={members}
          value={form.assignedTo}
          onChange={(ids) => setForm((f) => ({ ...f, assignedTo: ids }))}
          disabled={saving}
        />
      </div>

      <Input
        label="Due in N days (optional)"
        type="number"
        min={0}
        placeholder="e.g. 3"
        value={form.dueInDays}
        onChange={setField('dueInDays')}
        disabled={saving}
      />

      <Input
        label="Note (optional)"
        placeholder="Any additional context…"
        value={form.note}
        onChange={setField('note')}
        disabled={saving}
        multiline
        rows={3}
      />

      <Toggle
        checked={form.enabled}
        onChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
        disabled={saving}
        label="Enabled"
      />

      {formError && (
        <p
          className="text-xs font-body"
          style={{ color: 'var(--color-status-stuck)' }}
        >
          {formError}
        </p>
      )}
    </div>
  );

  const footer = view === 'list' ? (
    <Button variant="secondary" onClick={handleClose}>
      Close
    </Button>
  ) : (
    <>
      {editingId && (
        <Button
          variant="secondary"
          onClick={handleRunNowFromForm}
          disabled={saving}
        >
          Run now
        </Button>
      )}
      <Button variant="secondary" onClick={backToList} disabled={saving}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Automation'}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={view === 'list' ? 'Automations' : editingId ? 'Edit Automation' : 'New Automation'}
      maxWidth={620}
      footer={footer}
    >
      {view === 'list' ? renderListView() : renderFormView()}
    </Modal>
  );
};

export default AutomationsModal;

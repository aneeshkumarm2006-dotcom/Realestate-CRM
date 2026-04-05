/**
 * Mapping of task priority and status values to their background/text colors.
 * Colors are pulled from the CSS custom properties defined in globals.css
 * (see Macan_Design.md Section 2).
 */

export const PRIORITY_COLORS = {
  critical: {
    bg: '#FEF2F2',
    text: '#DC2626',
    solid: '#DC2626',
    label: 'Critical',
  },
  high: {
    bg: '#FFF7ED',
    text: '#EA580C',
    solid: '#EA580C',
    label: 'High',
  },
  medium: {
    bg: '#FFFBEB',
    text: '#D97706',
    solid: '#D97706',
    label: 'Medium',
  },
  low: {
    bg: '#F3F4F6',
    text: '#6B7280',
    solid: '#6B7280',
    label: 'Low',
  },
};

export const STATUS_COLORS = {
  done: {
    bg: 'var(--color-status-done-bg)',
    text: 'var(--color-status-done)',
    solid: '#16A34A',
    label: 'Done',
  },
  working_on_it: {
    bg: 'var(--color-status-working-bg)',
    text: 'var(--color-status-working)',
    solid: '#D97706',
    label: 'Working on it',
  },
  stuck: {
    bg: 'var(--color-status-stuck-bg)',
    text: 'var(--color-status-stuck)',
    solid: '#DC2626',
    label: 'Stuck',
  },
  not_started: {
    bg: 'var(--color-status-notstarted-bg)',
    text: 'var(--color-status-notstarted)',
    solid: '#6B7280',
    label: 'Not Started',
  },
};

export const getPriorityColor = (priority) =>
  PRIORITY_COLORS[priority] || PRIORITY_COLORS.low;

export const getStatusColor = (status) =>
  STATUS_COLORS[status] || STATUS_COLORS.not_started;

export default PRIORITY_COLORS;

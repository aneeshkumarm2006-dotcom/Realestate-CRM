import { forwardRef } from 'react';
import {
  STATUS_COLORS,
  PRIORITY_COLORS,
  getStatusPalette,
  getLabelPalette,
} from '../../utils/priorityColors';

/**
 * Chip — status (pill) or priority (rounded-sm) label.
 *
 * Props:
 *   type:  'status' | 'priority' | 'label'
 *   value: priority key, status id/legacy-key, or label id
 *   board: optional board doc (required for `status` and `label` types when
 *          the value is an ObjectId). Falls back to the legacy STATUS_COLORS
 *          palette for status when board is omitted (e.g. personal tasks).
 *   label: optional override label
 *   onClick: optional — makes the chip clickable
 */
const Chip = forwardRef(function Chip(
  {
    type = 'status',
    value,
    board,
    label: labelOverride,
    onClick,
    className = '',
    ...rest
  },
  ref,
) {
  let bg;
  let text;
  let label;

  if (type === 'priority') {
    const entry = PRIORITY_COLORS[value] || PRIORITY_COLORS.low;
    bg = entry.bg;
    text = entry.text;
    label = labelOverride ?? entry.label;
  } else if (type === 'label') {
    const pal = getLabelPalette(board, value);
    bg = pal.bg;
    text = pal.text;
    label = labelOverride ?? pal.label;
  } else {
    // status
    if (board) {
      const pal = getStatusPalette(board, value);
      bg = pal.bg;
      text = pal.text;
      label = labelOverride ?? pal.label;
    } else {
      const entry =
        STATUS_COLORS[value] || STATUS_COLORS.not_started;
      bg = entry.bg;
      text = entry.text;
      label = labelOverride ?? entry.label;
    }
  }

  const isClickable = typeof onClick === 'function';
  const radius = 'var(--radius-full)';

  const Tag = isClickable ? 'button' : 'span';

  return (
    <Tag
      ref={ref}
      type={isClickable ? 'button' : undefined}
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1 font-body font-medium text-[12px] leading-none',
        'whitespace-nowrap select-none align-middle',
        isClickable
          ? 'cursor-pointer transition-opacity duration-150 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        backgroundColor: bg,
        color: text,
        borderRadius: radius,
        padding: '3px 10px',
        border: 'none',
      }}
      {...rest}
    >
      {label}
    </Tag>
  );
});

export default Chip;

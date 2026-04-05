import { forwardRef } from 'react';
import { STATUS_COLORS, PRIORITY_COLORS } from '../../utils/priorityColors';

/**
 * Chip — status (pill) or priority (rounded-sm) label.
 * Used throughout task tables, calendar events, and task detail headers.
 *
 * See Macan_Design.md Section 6.4.
 *
 * Props:
 *   type:  'status' | 'priority'
 *   value: status key ('done' | 'working_on_it' | 'stuck' | 'not_started')
 *          or priority key ('critical' | 'high' | 'medium' | 'low')
 *   onClick: optional — makes the chip clickable (e.g. status dropdown)
 */

const Chip = forwardRef(function Chip(
  {
    type = 'status',
    value,
    label: labelOverride,
    onClick,
    className = '',
    ...rest
  },
  ref,
) {
  const source = type === 'priority' ? PRIORITY_COLORS : STATUS_COLORS;
  const entry = source[value] || source[Object.keys(source)[0]];
  const label = labelOverride ?? entry.label;

  const isClickable = typeof onClick === 'function';
  const radius =
    type === 'priority' ? 'var(--radius-sm)' : 'var(--radius-full)';

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
        backgroundColor: entry.bg,
        color: entry.text,
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

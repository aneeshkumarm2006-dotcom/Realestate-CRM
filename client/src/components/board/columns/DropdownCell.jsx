import StatusCell from './StatusCell';

/**
 * DropdownCell — same UX as StatusCell, different semantic. Both render
 * the selected option as a chip and open a single-select popover. Kept
 * separate so type-specific UX (e.g. icon, grouping) can diverge later
 * without touching StatusCell.
 */
const DropdownCell = (props) => <StatusCell {...props} />;

export default DropdownCell;

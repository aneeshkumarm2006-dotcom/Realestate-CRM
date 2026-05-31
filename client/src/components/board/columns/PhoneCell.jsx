import { useEffect, useRef, useState } from 'react';
import { focusedInputStyle, cellWrapperStyle } from './cellShared';

const PhoneCell = ({ value, readOnly, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const ref = useRef(null);

  useEffect(() => setDraft(value || ''), [value]);
  useEffect(() => {
    if (editing && ref.current) ref.current.focus();
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    if (next !== (value || '')) onChange?.(next || null);
    setEditing(false);
  };

  if (readOnly || !editing) {
    return (
      <div
        style={{ ...cellWrapperStyle, cursor: readOnly ? 'default' : 'text' }}
        onClick={() => !readOnly && setEditing(true)}
      >
        {value ? (
          <a
            href={`tel:${value}`}
            onClick={(e) => e.stopPropagation()}
            style={{ color: 'var(--color-text-primary)' }}
          >
            {value}
          </a>
        ) : (
          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
        )}
      </div>
    );
  }

  return (
    <input
      ref={ref}
      type="tel"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setEditing(false);
      }}
      style={focusedInputStyle}
    />
  );
};

export default PhoneCell;

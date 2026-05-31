import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import useBoardStore from '../../store/boardStore';
import useToastStore from '../../store/toastStore';

/**
 * AddColumnButton — opens a type picker and creates a new column via the
 * boardStore. Categories mirror the grouping in the phase doc.
 *
 * Props:
 *   boardId — current board id (required for the API call)
 */

const CATEGORIES = [
  {
    name: 'Text',
    types: [
      { id: 'text', label: 'Text' },
      { id: 'long_text', label: 'Long Text' },
      { id: 'link', label: 'Link' },
      { id: 'email', label: 'Email' },
      { id: 'phone', label: 'Phone' },
    ],
  },
  {
    name: 'Numbers',
    types: [
      { id: 'number', label: 'Number' },
      { id: 'rating', label: 'Rating' },
      { id: 'formula', label: 'Formula (read-only)' },
    ],
  },
  {
    name: 'People',
    types: [
      { id: 'person', label: 'People' },
    ],
  },
  {
    name: 'Dates',
    types: [
      { id: 'date', label: 'Date' },
      { id: 'timeline', label: 'Timeline' },
    ],
  },
  {
    name: 'Custom',
    types: [
      { id: 'status', label: 'Status (chips)' },
      { id: 'dropdown', label: 'Dropdown' },
      { id: 'tags', label: 'Tags (multi)' },
      { id: 'checkbox', label: 'Checkbox' },
      { id: 'location', label: 'Location' },
      { id: 'file', label: 'File' },
    ],
  },
];

const AddColumnButton = ({ boardId }) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('picker'); // 'picker' | 'naming'
  const [pickedType, setPickedType] = useState(null);
  const [name, setName] = useState('');
  const ref = useRef(null);
  const nameRef = useRef(null);
  const addColumn = useBoardStore((s) => s.addColumn);
  const toastError = useToastStore((s) => s.error);

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      setOpen(false);
      setStep('picker');
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  useEffect(() => {
    if (step === 'naming' && nameRef.current) nameRef.current.focus();
  }, [step]);

  const startWithType = (typeId, defaultName) => {
    setPickedType(typeId);
    setName(defaultName);
    setStep('naming');
  };

  const createColumn = async () => {
    if (!name.trim() || !pickedType) return;
    const payload = { name: name.trim(), type: pickedType };
    // Seed minimal settings for types that need them, so the API doesn't 400.
    if (pickedType === 'status' || pickedType === 'dropdown' || pickedType === 'tags') {
      payload.settings = { options: [] };
    } else if (pickedType === 'rating') {
      payload.settings = { max: 5 };
    }
    try {
      await addColumn(boardId, payload);
      setOpen(false);
      setStep('picker');
      setPickedType(null);
      setName('');
    } catch (err) {
      toastError(err?.response?.data?.error || 'Could not create column');
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Add column"
        style={{
          width: 28,
          height: 28,
          padding: 0,
          borderRadius: '50%',
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Plus size={14} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 6,
            zIndex: 50,
            minWidth: 260,
            maxHeight: 360,
            overflowY: 'auto',
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            padding: 8,
          }}
        >
          {step === 'picker' &&
            CATEGORIES.map((cat) => (
              <div key={cat.name} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--color-text-muted)',
                    padding: '4px 6px',
                  }}
                >
                  {cat.name}
                </div>
                {cat.types.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => startWithType(t.id, t.label)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: 12,
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ))}
          {step === 'naming' && (
            <div style={{ padding: 6 }}>
              <div
                style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}
              >
                Name your new {pickedType} column
              </div>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createColumn();
                  if (e.key === 'Escape') {
                    setStep('picker');
                    setPickedType(null);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: 13,
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 8,
                }}
              />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setStep('picker');
                    setPickedType(null);
                  }}
                  style={{
                    padding: '4px 10px',
                    fontSize: 12,
                    background: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={createColumn}
                  disabled={!name.trim()}
                  style={{
                    padding: '4px 10px',
                    fontSize: 12,
                    background: 'var(--color-accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: name.trim() ? 'pointer' : 'not-allowed',
                    opacity: name.trim() ? 1 : 0.5,
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AddColumnButton;

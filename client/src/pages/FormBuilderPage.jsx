import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import {
  GripVertical,
  Plus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  FileText,
} from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Dropdown from '../components/ui/Dropdown';
import SortableItem from '../components/dnd/SortableItem';
import useAuthStore from '../store/authStore';
import useOrgStore from '../store/orgStore';
import useBoardStore from '../store/boardStore';
import useToastStore from '../store/toastStore';
import * as formService from '../services/formService';

/**
 * FormBuilderPage — the column-mapped public-form builder (F13.5). Each form
 * field binds to a board `columnId`; fields reorder via `@dnd-kit/sortable`; a
 * live preview shows the rendered form; after saving, the `/f/:slug` URL is shown
 * with a copy button. New forms read `?boardId=`; editing loads `/forms/:id/edit`.
 */

const FORM_TYPE_OPTIONS = [
  { value: 'text', label: 'Text' },
  { value: 'long_text', label: 'Long text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
];

/** Map a board column type → a sensible default form field type. */
const formTypeForColumn = (colType) => {
  switch (colType) {
    case 'email':
      return 'email';
    case 'phone':
      return 'phone';
    case 'number':
    case 'rating':
      return 'number';
    case 'long_text':
      return 'long_text';
    case 'date':
    case 'timeline':
      return 'date';
    case 'status':
    case 'dropdown':
    case 'tags':
      return 'dropdown';
    case 'checkbox':
      return 'checkbox';
    default:
      return 'text';
  }
};

/** Option labels for a status/dropdown/tags column (shown as dropdown choices). */
const optionLabelsForColumn = (col) =>
  col && col.settings && Array.isArray(col.settings.options)
    ? col.settings.options.map((o) => o.label).filter(Boolean)
    : [];

let seq = 0;
const newFieldId = () => `f_${Date.now().toString(36)}_${(seq++).toString(36)}`;

const useIsCurrentOrgAdmin = () => {
  const user = useAuthStore((s) => s.user);
  const currentOrg = useOrgStore((s) => s.currentOrg);
  if (!user || !currentOrg) return false;
  const adminId =
    typeof currentOrg.admin === 'object' && currentOrg.admin !== null
      ? currentOrg.admin._id || currentOrg.admin
      : currentOrg.admin;
  const isMainAdmin = !!adminId && String(adminId) === String(user._id);
  const isExtraAdmin =
    Array.isArray(currentOrg.admins) &&
    currentOrg.admins.some((a) => {
      const id = typeof a === 'object' && a !== null ? a._id || a : a;
      return String(id) === String(user._id);
    });
  return isMainAdmin || isExtraAdmin;
};

const sectionCard = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: 18,
};

const FormBuilderPage = () => {
  const { id: formId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isAdmin = useIsCurrentOrgAdmin();
  const toastSuccess = useToastStore((s) => s.success);

  const currentOrg = useOrgStore((s) => s.currentOrg);
  const orgId = currentOrg?._id || null;
  const boards = useBoardStore((s) => s.boards);
  const fetchBoards = useBoardStore((s) => s.fetchBoards);
  const getBoardById = useBoardStore((s) => s.getBoardById);

  const isEdit = !!formId;
  const [boardId, setBoardId] = useState(searchParams.get('boardId') || null);
  const [name, setName] = useState('');
  const [fields, setFields] = useState([]);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [postSubmitRedirectUrl, setPostSubmitRedirectUrl] = useState('');
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [enabled, setEnabled] = useState(true);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedForm, setSavedForm] = useState(null); // { publicUrl, slug }
  const [copied, setCopied] = useState(false);
  const [addColumnId, setAddColumnId] = useState('');

  // Hydrate boards (for the board picker + columns).
  useEffect(() => {
    if (orgId && boards.length === 0) fetchBoards(orgId).catch((e) => console.error(e));
  }, [orgId, boards.length, fetchBoards]);

  // Edit mode — load the form, then its board.
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    formService
      .getForm(formId)
      .then((f) => {
        if (cancelled) return;
        setBoardId(String(f.boardId));
        setName(f.name || '');
        setFields((f.fieldMap || []).map((fm) => ({ ...fm })));
        setWelcomeMessage(f.welcomeMessage || '');
        setPostSubmitRedirectUrl(f.postSubmitRedirectUrl || '');
        setCaptchaEnabled(!!f.captchaEnabled);
        setEnabled(!!f.enabled);
        setSavedForm({ publicUrl: f.publicUrl, slug: f.slug });
      })
      .catch(() => setError('Could not load this form.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isEdit, formId]);

  const board = boardId ? getBoardById(boardId) : null;
  const columns = useMemo(() => board?.columns || [], [board]);
  const columnsById = useMemo(() => new Map(columns.map((c) => [String(c._id), c])), [columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const addFieldFromColumn = (colId) => {
    const col = columnsById.get(String(colId));
    if (!col) return;
    setFields((prev) => [
      ...prev,
      {
        formFieldId: newFieldId(),
        label: col.name,
        type: formTypeForColumn(col.type),
        required: false,
        columnId: String(col._id),
        options: optionLabelsForColumn(col),
      },
    ]);
    setAddColumnId('');
  };

  const addCustomField = () =>
    setFields((prev) => [
      ...prev,
      { formFieldId: newFieldId(), label: 'New field', type: 'text', required: false, columnId: null, options: [] },
    ]);

  const updateField = (id, patch) =>
    setFields((prev) => prev.map((f) => (f.formFieldId === id ? { ...f, ...patch } : f)));
  const removeField = (id) => setFields((prev) => prev.filter((f) => f.formFieldId !== id));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFields((prev) => {
      const oldIndex = prev.findIndex((f) => f.formFieldId === active.id);
      const newIndex = prev.findIndex((f) => f.formFieldId === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const buildPayload = () => ({
    name: name.trim(),
    fieldMap: fields.map((f) => ({
      formFieldId: f.formFieldId,
      label: f.label,
      type: f.type,
      required: !!f.required,
      columnId: f.columnId || null,
      options: Array.isArray(f.options) ? f.options : [],
    })),
    welcomeMessage,
    postSubmitRedirectUrl,
    captchaEnabled,
    enabled,
  });

  const handleSave = useCallback(async () => {
    setError('');
    if (!boardId) {
      setError('Pick a board for this form.');
      return;
    }
    if (!name.trim()) {
      setError('Give the form a name.');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        const updated = await formService.updateForm(formId, buildPayload());
        setSavedForm({ publicUrl: updated.publicUrl, slug: updated.slug });
        toastSuccess('Form saved');
      } else {
        const created = await formService.createForm(boardId, buildPayload());
        setSavedForm({ publicUrl: created.publicUrl, slug: created.slug });
        toastSuccess('Form published');
        navigate(`/forms/${created._id}/edit`, { replace: true });
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not save the form.');
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, name, fields, welcomeMessage, postSubmitRedirectUrl, captchaEnabled, enabled, isEdit, formId]);

  const copyUrl = async () => {
    if (!savedForm?.publicUrl) return;
    try {
      await navigator.clipboard.writeText(savedForm.publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const boardOptions = useMemo(
    () =>
      (boards || [])
        .filter((b) => !orgId || String(b.organisation || '') === String(orgId))
        .map((b) => ({ value: String(b._id), label: b.name })),
    [boards, orgId]
  );
  const columnAddOptions = columns.map((c) => ({ value: String(c._id), label: `${c.name} (${c.type})` }));

  if (!isAdmin) {
    return (
      <PageWrapper>
        <p className="font-body" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          The form builder is admin-only.
        </p>
      </PageWrapper>
    );
  }

  if (loading) {
    return (
      <PageWrapper>
        <p className="font-body" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Loading…</p>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold inline-flex items-center gap-2" style={{ fontSize: 22, color: 'var(--color-text-primary)' }}>
            <FileText size={20} /> {isEdit ? 'Edit form' : 'New form'}
          </h1>
          <p className="font-body mt-1" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            Build a public form that creates tasks on this board — submissions run through the same lead intake as inbound webhooks.
          </p>
        </div>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Publish form'}
        </Button>
      </header>

      {error && (
        <div className="mb-4 font-body" style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-status-stuck-bg)', color: 'var(--color-status-stuck)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {savedForm?.publicUrl && (
        <div className="mb-5 flex items-center gap-3 flex-wrap font-body" style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-status-done-bg)', color: 'var(--color-status-done)', fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Public URL:</span>
          <code style={{ wordBreak: 'break-all', color: 'var(--color-text-primary)' }}>{savedForm.publicUrl}</code>
          <button type="button" onClick={copyUrl} className="inline-flex items-center gap-1.5" style={{ fontSize: 12, padding: '4px 8px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--color-border)', background: '#fff', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
          </button>
          <a href={`/f/${savedForm.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5" style={{ fontSize: 12, color: 'var(--color-accent)' }}>
            <ExternalLink size={13} /> Open
          </a>
        </div>
      )}

      <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
        {/* --- Builder --- */}
        <div className="flex flex-col gap-5">
          <div style={sectionCard} className="flex flex-col gap-4">
            {!isEdit && (
              <Dropdown
                label="Board"
                options={boardOptions}
                value={boardId || ''}
                onChange={(v) => setBoardId(v)}
                placeholder="Pick a board"
              />
            )}
            <Input label="Form name" required placeholder="e.g. Contact us" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Thank-you message" multiline rows={2} placeholder="Shown after a successful submission." value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} />
            <Input label="Redirect URL (optional)" placeholder="https://… (overrides the thank-you message)" value={postSubmitRedirectUrl} onChange={(e) => setPostSubmitRedirectUrl(e.target.value)} />
            <div className="flex items-center gap-6">
              <label className="inline-flex items-center gap-2 cursor-pointer font-body" style={{ fontSize: 14 }}>
                <input type="checkbox" checked={captchaEnabled} onChange={(e) => setCaptchaEnabled(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--color-accent)' }} />
                Enable captcha (Turnstile)
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer font-body" style={{ fontSize: 14 }}>
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--color-accent)' }} />
                Published
              </label>
            </div>
          </div>

          <div style={sectionCard} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="font-display font-semibold" style={{ fontSize: 15, color: 'var(--color-text-primary)' }}>Fields</h2>
              <div className="flex items-center gap-2">
                <div style={{ width: 200 }}>
                  <Dropdown size="sm" options={columnAddOptions} value={addColumnId} onChange={addFieldFromColumn} placeholder="Add field from column" />
                </div>
                <Button variant="secondary" size="sm" icon={Plus} onClick={addCustomField}>Custom</Button>
              </div>
            </div>

            {!board ? (
              <p className="font-body" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Pick a board to map fields to its columns.</p>
            ) : fields.length === 0 ? (
              <p className="font-body" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No fields yet — add one from a board column above.</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={fields.map((f) => f.formFieldId)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2">
                    {fields.map((field) => (
                      <SortableItem key={field.formFieldId} id={field.formFieldId} data={{ type: 'field' }}>
                        {({ ref, setActivatorNodeRef, style, attributes, listeners }) => (
                          <div ref={ref} style={{ ...style, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 10, background: 'var(--color-bg-surface)' }}>
                            <div className="flex items-center gap-2">
                              <button ref={setActivatorNodeRef} type="button" aria-label="Drag to reorder" {...attributes} {...listeners} style={{ cursor: 'grab', touchAction: 'none', background: 'transparent', border: 'none', padding: 2 }}>
                                <GripVertical size={15} color="var(--color-text-muted)" />
                              </button>
                              <div style={{ flex: '1 1 40%' }}>
                                <Input value={field.label} onChange={(e) => updateField(field.formFieldId, { label: e.target.value })} placeholder="Field label" style={{ height: 32 }} />
                              </div>
                              <div style={{ flex: '0 0 130px' }}>
                                <Dropdown size="sm" options={FORM_TYPE_OPTIONS} value={field.type} onChange={(v) => updateField(field.formFieldId, { type: v })} />
                              </div>
                              <label className="inline-flex items-center gap-1.5 font-body shrink-0" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                                <input type="checkbox" checked={!!field.required} onChange={(e) => updateField(field.formFieldId, { required: e.target.checked })} style={{ width: 15, height: 15, accentColor: 'var(--color-accent)' }} />
                                Required
                              </label>
                              <button type="button" aria-label="Remove field" onClick={() => removeField(field.formFieldId)} className="flex items-center justify-center rounded-md hover:bg-[color:var(--color-bg-subtle)]" style={{ width: 30, height: 30, flexShrink: 0 }}>
                                <Trash2 size={14} color="var(--color-text-secondary)" />
                              </button>
                            </div>
                            <p className="font-body" style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, marginLeft: 26 }}>
                              {field.columnId && columnsById.get(String(field.columnId))
                                ? `Maps to column: ${columnsById.get(String(field.columnId)).name}`
                                : 'Not mapped to a column (stored on the task note for legacy boards).'}
                              {field.type === 'dropdown' && (field.options || []).length > 0 && ` · options: ${field.options.join(', ')}`}
                            </p>
                          </div>
                        )}
                      </SortableItem>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* --- Live preview --- */}
        <div style={sectionCard}>
          <h2 className="font-display font-semibold mb-1" style={{ fontSize: 15, color: 'var(--color-text-primary)' }}>Live preview</h2>
          <p className="font-body mb-4" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>How visitors see your form.</p>
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', marginBottom: 18 }}>{name || 'Untitled form'}</h3>
            <div className="flex flex-col gap-4">
              {fields.map((field) => (
                <div key={field.formFieldId}>
                  <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#475569' }}>
                    {field.label || 'Field'}{field.required && <span style={{ color: '#DC2626', marginLeft: 4 }}>*</span>}
                  </label>
                  {field.type === 'dropdown' ? (
                    <select disabled style={previewInput}>
                      <option>Select…</option>
                      {(field.options || []).map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <input type="checkbox" disabled style={{ width: 18, height: 18 }} />
                  ) : field.type === 'long_text' ? (
                    <textarea disabled rows={3} style={{ ...previewInput, height: 'auto' }} />
                  ) : (
                    <input disabled type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'} style={previewInput} />
                  )}
                </div>
              ))}
              {fields.length === 0 && <p style={{ fontSize: 13, color: '#94A3B8' }}>Add fields to preview the form.</p>}
              {captchaEnabled && <div style={{ height: 60, border: '1px dashed #CBD5E1', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#94A3B8' }}>Captcha challenge</div>}
              <button disabled style={{ height: 42, borderRadius: 8, border: 'none', background: '#2563EB', color: '#fff', fontSize: 15, fontWeight: 600, opacity: 0.9 }}>Submit</button>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
};

const previewInput = {
  width: '100%',
  height: 38,
  padding: '0 12px',
  fontSize: 14,
  border: '1.5px solid #E2E8F0',
  borderRadius: 8,
  background: '#F8FAFC',
  color: '#0F172A',
};

export default FormBuilderPage;

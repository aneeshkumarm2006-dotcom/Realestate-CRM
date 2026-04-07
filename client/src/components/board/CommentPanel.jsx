import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Send } from 'lucide-react';
import Chip from '../ui/Chip';
import { formatDate, timeAgo } from '../../utils/dateUtils';
import * as commentService from '../../services/commentService';
import useNotificationStore from '../../store/notificationStore';
import useOrgStore from '../../store/orgStore';

/**
 * CommentPanel — right-edge slide-out panel showing task detail + comments.
 *
 * See Macan_Design.md Section 6.9.
 *
 * Specs:
 *   - 420px width (desktop), full-width (mobile <768px)
 *   - Background: white, left border, shadow-lg, z-index 100
 *   - Animation: translateX(100%) → 0, 300ms cubic-bezier(0.4, 0, 0.2, 1)
 *   - Sections: close button, task header, comments thread, sticky composer
 *   - Subtle 40% dark backdrop (overlay). Click outside or ESC to close.
 *
 * Props:
 *   task     — populated task doc (contains: name, priority, status,
 *              assignedTo[{name, profilePic}], dueDate, note)
 *   isOpen   — whether the panel is rendered + in-position
 *   onClose  — callback to close the panel
 */
const CommentPanel = ({ task, isOpen, onClose }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const threadRef = useRef(null);
  const textareaRef = useRef(null);
  const refreshNotifications = useNotificationStore((s) => s.fetchNotifications);

  // @mention state
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [mentionedUsers, setMentionedUsers] = useState([]); // [{_id, name}]
  const [mentionHighlight, setMentionHighlight] = useState(0);
  const mentionDropdownRef = useRef(null);

  // Org members for @mention
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const orgMembers = useOrgStore((s) => s.members);
  const fetchMembers = useOrgStore((s) => s.fetchMembers);

  const taskId = task?._id || null;

  // Fetch org members when panel opens (if not already loaded)
  useEffect(() => {
    if (isOpen && currentOrg?._id && orgMembers.length === 0) {
      fetchMembers(currentOrg._id).catch(() => {});
    }
  }, [isOpen, currentOrg?._id, orgMembers.length, fetchMembers]);

  // Filter members based on mention query
  const filteredMembers = useMemo(() => {
    if (!showMentionDropdown) return [];
    const q = mentionQuery.toLowerCase();
    return orgMembers.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) &&
        !mentionedUsers.some((mu) => mu._id === m._id)
    );
  }, [orgMembers, mentionQuery, showMentionDropdown, mentionedUsers]);

  // Reset state when the panel is opened for a new task
  useEffect(() => {
    if (!isOpen || !taskId) {
      setComments([]);
      setText('');
      setError('');
      setMentionedUsers([]);
      setShowMentionDropdown(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    commentService
      .getComments(taskId)
      .then((list) => {
        if (!cancelled) setComments(list || []);
      })
      .catch((err) => {
        console.error('Failed to load comments:', err);
        if (!cancelled) {
          setError(
            err?.response?.data?.error ||
              'Failed to load comments. Please try again.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, taskId]);

  // Scroll the comment thread to the bottom after loading or appending
  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [comments, loading]);

  // ESC closes the panel + scroll lock on <body>
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.();
      const trimmed = text.trim();
      if (!trimmed || submitting || !taskId) return;
      setSubmitting(true);
      setError('');
      try {
        const mentionIds = mentionedUsers.map((u) => u._id);
        const created = await commentService.addComment(taskId, trimmed, mentionIds);
        setComments((prev) => [...prev, created]);
        setText('');
        setMentionedUsers([]);
        // Return focus to the textarea for rapid posting
        textareaRef.current?.focus();
        // Repoll notifications — the comment may have created one for the
        // current user on other tasks they're assigned to
        refreshNotifications();
      } catch (err) {
        console.error('Failed to add comment:', err);
        setError(
          err?.response?.data?.error ||
            'Failed to add comment. Please try again.'
        );
      } finally {
        setSubmitting(false);
      }
    },
    [text, submitting, taskId, refreshNotifications, mentionedUsers]
  );

  // Insert a selected mention into the text
  const insertMention = useCallback(
    (member) => {
      const before = text.slice(0, mentionStartIndex);
      const after = text.slice(
        mentionStartIndex + mentionQuery.length + 1 // +1 for the @ char
      );
      const newText = `${before}@${member.name} ${after}`;
      setText(newText);
      setMentionedUsers((prev) => {
        if (prev.some((u) => u._id === member._id)) return prev;
        return [...prev, { _id: member._id, name: member.name }];
      });
      setShowMentionDropdown(false);
      setMentionQuery('');
      setMentionStartIndex(-1);
      setMentionHighlight(0);
      // Refocus textarea
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [text, mentionStartIndex, mentionQuery]
  );

  // Detect @ in textarea input
  const handleTextChange = useCallback(
    (e) => {
      const val = e.target.value;
      setText(val);

      const cursorPos = e.target.selectionStart;
      // Look backwards from cursor for an unmatched @
      const textBeforeCursor = val.slice(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex >= 0) {
        // Check that the @ is at start or preceded by whitespace
        const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
        if (charBefore === ' ' || charBefore === '\n' || lastAtIndex === 0) {
          const query = textBeforeCursor.slice(lastAtIndex + 1);
          // Only show dropdown if query has no spaces (still typing the name)
          if (!query.includes(' ')) {
            setMentionStartIndex(lastAtIndex);
            setMentionQuery(query);
            setShowMentionDropdown(true);
            setMentionHighlight(0);
            return;
          }
        }
      }
      setShowMentionDropdown(false);
      setMentionQuery('');
    },
    []
  );

  const handleKeyDown = (e) => {
    // Mention dropdown keyboard navigation
    if (showMentionDropdown && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionHighlight((prev) =>
          prev < filteredMembers.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionHighlight((prev) =>
          prev > 0 ? prev - 1 : filteredMembers.length - 1
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMembers[mentionHighlight]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionDropdown(false);
        return;
      }
    }
    // Cmd/Ctrl + Enter to submit from the textarea
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const assignees = useMemo(
    () => (Array.isArray(task?.assignedTo) ? task.assignedTo : []),
    [task]
  );

  if (!isOpen || !task) return null;

  const panel = (
    <>
      {/* Subtle backdrop — clicking it closes the panel */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.15)',
          zIndex: 99,
          animation: 'macan-cp-backdrop 200ms ease-out',
        }}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Task details: ${task.name || ''}`}
        className="macan-comment-panel bg-white flex flex-col"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          maxWidth: '100vw',
          zIndex: 100,
          borderLeft: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-lg)',
          animation:
            'macan-cp-slide 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Close button */}
        <div
          className="flex items-center justify-end"
          style={{
            padding: '12px 16px 0 16px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="flex items-center justify-center rounded-md transition-colors duration-150 hover:bg-[color:var(--color-bg-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
            style={{ width: 32, height: 32 }}
          >
            <X size={18} color="var(--color-text-secondary)" aria-hidden="true" />
          </button>
        </div>

        {/* Task detail header */}
        <header
          style={{
            padding: '4px 24px 20px 24px',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <h2
            className="font-display"
            style={{
              fontSize: 20,
              fontWeight: 700,
              lineHeight: 1.3,
              color: 'var(--color-text-primary)',
              wordBreak: 'break-word',
            }}
          >
            {task.name}
          </h2>

          <div
            className="mt-3 flex flex-wrap items-center gap-2"
            aria-label="Task badges"
          >
            {task.priority && <Chip type="priority" value={task.priority} />}
            <Chip type="status" value={task.status || 'not_started'} />
          </div>

          <dl className="mt-4 flex flex-col gap-2">
            <MetaRow label="Assigned to">
              {assignees.length > 0 ? (
                <div className="flex items-center gap-2 flex-wrap">
                  {assignees.map((u) => (
                    <span
                      key={u._id || u.email || u.name}
                      className="inline-flex items-center gap-2"
                    >
                      <Avatar user={u} size={20} />
                      <span
                        className="font-body"
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {u.name}
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <span
                  className="font-body"
                  style={{ fontSize: 13, color: 'var(--color-text-muted)' }}
                >
                  Unassigned
                </span>
              )}
            </MetaRow>

            <MetaRow label="Due date">
              <span
                className="font-body"
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: task.dueDate
                    ? 'var(--color-text-primary)'
                    : 'var(--color-text-muted)',
                }}
              >
                {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
              </span>
            </MetaRow>
          </dl>

          {task.note ? (
            <div className="mt-4">
              <p
                className="font-body"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'var(--color-text-muted)',
                  marginBottom: 6,
                }}
              >
                Notes
              </p>
              <p
                className="font-body"
                style={{
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: 'var(--color-text-secondary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {task.note}
              </p>
            </div>
          ) : null}
        </header>

        {/* Comment thread */}
        <div
          ref={threadRef}
          className="flex-1 overflow-y-auto"
          style={{ padding: '0 24px' }}
        >
          {loading ? (
            <p
              className="font-body text-center"
              style={{
                fontSize: 13,
                color: 'var(--color-text-muted)',
                padding: '24px 0',
              }}
            >
              Loading comments…
            </p>
          ) : comments.length === 0 ? (
            <p
              className="font-body text-center"
              style={{
                fontSize: 13,
                color: 'var(--color-text-muted)',
                padding: '32px 0',
              }}
            >
              No comments yet. Start the conversation.
            </p>
          ) : (
            <ul
              className="flex flex-col"
              style={{ padding: 0, margin: 0, listStyle: 'none' }}
            >
              {comments.map((c, i) => (
                <li
                  key={c._id}
                  style={{
                    padding: '12px 0',
                    borderBottom:
                      i === comments.length - 1
                        ? 'none'
                        : '1px solid var(--color-border)',
                  }}
                >
                  <CommentItem comment={c} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Sticky composer footer */}
        <form
          onSubmit={handleSubmit}
          style={{
            borderTop: '1px solid var(--color-border)',
            padding: '12px 16px 16px 16px',
            background: '#FFFFFF',
          }}
        >
          {error ? (
            <p
              className="font-body"
              role="alert"
              style={{
                fontSize: 12,
                color: 'var(--color-status-stuck)',
                marginBottom: 8,
              }}
            >
              {error}
            </p>
          ) : null}
          <div style={{ position: 'relative', background: 'var(--color-bg-surface, #FFFFFF)', borderRadius: 'var(--radius-md)' }}>
            {/* Highlight backdrop — sits behind the transparent textarea
                and paints the actual visible text + coloured @mentions. */}
            <div
              aria-hidden="true"
              className="font-body"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                padding: '10px 12px',
                fontSize: 14,
                lineHeight: 1.5,
                border: '1.5px solid transparent',
                borderRadius: 'var(--radius-md)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowY: 'auto',
                pointerEvents: 'none',
              }}
            >
              <HighlightedText text={text} mentionedUsers={mentionedUsers} />
            </div>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onScroll={(e) => {
                const backdrop = e.target.previousElementSibling;
                if (backdrop) backdrop.scrollTop = e.target.scrollTop;
              }}
              placeholder="Add a comment... (type @ to mention)"
              rows={3}
              disabled={submitting}
              className="w-full font-body transition-colors duration-150 focus:outline-none focus:border-[color:var(--color-accent)] focus:shadow-[0_0_0_3px_var(--color-accent-light)]"
              style={{
                resize: 'none',
                fontSize: 14,
                padding: '10px 12px',
                color: 'transparent',
                caretColor: 'var(--color-text-primary)',
                background: 'transparent',
                border: '1.5px solid var(--color-border-strong)',
                borderRadius: 'var(--radius-md)',
                lineHeight: 1.5,
                position: 'relative',
                zIndex: 1,
              }}
            />
            {/* @mention dropdown */}
            {showMentionDropdown && filteredMembers.length > 0 && (
              <ul
                ref={mentionDropdownRef}
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  right: 0,
                  maxHeight: 200,
                  overflowY: 'auto',
                  background: '#FFFFFF',
                  border: '1.5px solid var(--color-border-strong)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  margin: '0 0 4px 0',
                  padding: '4px 0',
                  listStyle: 'none',
                  zIndex: 110,
                }}
              >
                {filteredMembers.map((member, idx) => (
                  <li
                    key={member._id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(member);
                    }}
                    onMouseEnter={() => setMentionHighlight(idx)}
                    className="flex items-center gap-2 cursor-pointer"
                    style={{
                      padding: '8px 12px',
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--color-text-primary)',
                      background:
                        idx === mentionHighlight
                          ? 'var(--color-bg-subtle, #F3F4F6)'
                          : 'transparent',
                      transition: 'background 100ms',
                    }}
                  >
                    <Avatar user={member} size={22} />
                    <span>{member.name}</span>
                    {member.email && (
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--color-text-muted)',
                          marginLeft: 'auto',
                        }}
                      >
                        {member.email}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span
              className="font-body"
              style={{ fontSize: 11, color: 'var(--color-text-muted)' }}
            >
              {submitting ? 'Sending…' : 'Cmd/Ctrl + Enter to send'}
            </span>
            <button
              type="submit"
              disabled={!text.trim() || submitting}
              className="inline-flex items-center justify-center gap-2 font-body whitespace-nowrap transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
              style={{
                height: 36,
                padding: '0 16px',
                background: 'var(--color-accent)',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: 13,
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: text.trim() && !submitting ? 'pointer' : 'not-allowed',
              }}
            >
              <Send size={14} aria-hidden="true" />
              Send
            </button>
          </div>
        </form>
      </aside>

      <style>{`
        @keyframes macan-cp-slide {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes macan-cp-backdrop {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @media (max-width: 767px) {
          .macan-comment-panel {
            width: 100vw !important;
          }
        }
      `}</style>
    </>
  );

  return createPortal(panel, document.body);
};

/**
 * A labelled row inside the task detail header (dt/dd pair).
 */
const MetaRow = ({ label, children }) => (
  <div className="flex items-start gap-3">
    <dt
      className="font-body shrink-0"
      style={{
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--color-text-muted)',
        width: 88,
        paddingTop: 2,
      }}
    >
      {label}
    </dt>
    <dd className="min-w-0 flex-1" style={{ margin: 0 }}>
      {children}
    </dd>
  </div>
);

/**
 * Live highlight overlay for the composer textarea.
 * Renders the same text with @mentions shown as coloured spans.
 * Non-mention text is transparent so only the highlights are visible.
 */
const HighlightedText = ({ text, mentionedUsers }) => {
  if (!text || mentionedUsers.length === 0) {
    return <span style={{ color: 'var(--color-text-primary)' }}>{text}</span>;
  }

  const names = mentionedUsers
    .map((u) => u.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (names.length === 0) {
    return <span style={{ color: 'var(--color-text-primary)' }}>{text}</span>;
  }

  const escaped = names.map((n) =>
    n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const regex = new RegExp(`(@(?:${escaped.join('|')}))`, 'g');

  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) => {
        if (regex.test(part)) {
          regex.lastIndex = 0;
          return (
            <span
              key={i}
              style={{
                color: 'var(--color-accent, #2563EB)',
                fontWeight: 600,
                background: 'rgba(37,99,235,0.1)',
                borderRadius: 3,
                padding: '1px 2px',
              }}
            >
              {part}
            </span>
          );
        }
        regex.lastIndex = 0;
        return (
          <span key={i} style={{ color: 'var(--color-text-primary)' }}>
            {part}
          </span>
        );
      })}
    </>
  );
};

/**
 * Render comment text with @mentions highlighted.
 * Matches @Name patterns against the comment's populated mentions array.
 */
const RenderCommentText = ({ text, mentions }) => {
  if (!mentions || mentions.length === 0) {
    return <>{text}</>;
  }

  // Build a regex that matches any mentioned name prefixed by @
  const mentionNames = mentions
    .map((m) => m.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length); // longest first to avoid partial matches

  if (mentionNames.length === 0) return <>{text}</>;

  const escaped = mentionNames.map((n) =>
    n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const regex = new RegExp(`(@(?:${escaped.join('|')}))`, 'g');

  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) => {
        if (regex.test(part)) {
          // Reset lastIndex since we reuse the regex
          regex.lastIndex = 0;
          return (
            <span
              key={i}
              style={{
                color: 'var(--color-accent)',
                fontWeight: 600,
                background: 'var(--color-accent-light, rgba(37,99,235,0.08))',
                borderRadius: 3,
                padding: '0 2px',
              }}
            >
              {part}
            </span>
          );
        }
        regex.lastIndex = 0;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

/**
 * One comment entry inside the thread.
 */
const CommentItem = ({ comment }) => {
  const author = comment.author || {};
  return (
    <div className="flex items-start gap-3">
      <Avatar user={author} size={28} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className="font-body"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            {author.name || 'Unknown'}
          </span>
          <span
            className="font-body"
            style={{ fontSize: 11, color: 'var(--color-text-muted)' }}
            title={formatDate(comment.createdAt)}
          >
            {timeAgo(comment.createdAt)}
          </span>
        </div>
        <p
          className="font-body"
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: 'var(--color-text-primary)',
            marginTop: 2,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          <RenderCommentText text={comment.text} mentions={comment.mentions} />
        </p>
      </div>
    </div>
  );
};

/**
 * Avatar bubble — profile pic if available, otherwise an initial fallback.
 */
const Avatar = ({ user, size = 28 }) => {
  const name = user?.name || '';
  const initial = name.charAt(0).toUpperCase() || '?';
  const hasPic = !!user?.profilePic;

  const base = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
  };

  if (hasPic) {
    return (
      <img
        src={user.profilePic}
        alt={name}
        style={{ ...base, objectFit: 'cover' }}
      />
    );
  }

  return (
    <span
      aria-label={name}
      className="inline-flex items-center justify-center font-body font-semibold"
      style={{
        ...base,
        background: 'var(--color-accent-light)',
        color: 'var(--color-accent-text)',
        fontSize: Math.round(size * 0.4),
      }}
    >
      {initial}
    </span>
  );
};

export default CommentPanel;

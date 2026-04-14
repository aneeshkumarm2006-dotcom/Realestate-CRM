import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ChevronRight,
  Lock,
  Globe,
  Plus,
  Settings as SettingsIcon,
} from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTaskGroup } from '../components/ui/Skeleton';
import TaskGroupHeader from '../components/board/TaskGroupHeader';
import TaskTable from '../components/board/TaskTable';
import StatusMenu from '../components/board/StatusMenu';
import PriorityMenu from '../components/board/PriorityMenu';
import TaskActionsMenu from '../components/board/TaskActionsMenu';
import CommentPanel from '../components/board/CommentPanel';
import useAuthStore from '../store/authStore';
import useOrgStore from '../store/orgStore';
import useBoardStore from '../store/boardStore';
import useTaskStore from '../store/taskStore';
import useNotificationStore from '../store/notificationStore';
import useToastStore from '../store/toastStore';
import * as taskService from '../services/taskService';
import { formatDate } from '../utils/dateUtils';

/**
 * Group color cycle — reuses the stat-card palette so groups are visually
 * distinct within a board.
 */
const GROUP_DOT_CYCLE = [
  'var(--color-card-blue)',
  'var(--color-card-green)',
  'var(--color-card-orange)',
  'var(--color-card-purple)',
];

/**
 * Determine whether the signed-in user is the admin of the current org.
 */
const useIsCurrentOrgAdmin = () => {
  const user = useAuthStore((s) => s.user);
  const currentOrg = useOrgStore((s) => s.currentOrg);
  if (!user || !currentOrg) return false;
  const adminId =
    typeof currentOrg.admin === 'object' && currentOrg.admin !== null
      ? currentOrg.admin._id || currentOrg.admin
      : currentOrg.admin;
  const isMainAdmin = !!adminId && String(adminId) === String(user._id);
  const isExtraAdmin = Array.isArray(currentOrg.admins) &&
    currentOrg.admins.some((a) => {
      const id = typeof a === 'object' && a !== null ? a._id || a : a;
      return String(id) === String(user._id);
    });
  return isMainAdmin || isExtraAdmin;
};

const BoardDetailPage = () => {
  const { id: boardId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isAdmin = useIsCurrentOrgAdmin();
  const currentUser = useAuthStore((s) => s.user);

  const currentOrg = useOrgStore((s) => s.currentOrg);
  const members = useOrgStore((s) => s.members);
  const fetchMembers = useOrgStore((s) => s.fetchMembers);
  const boards = useBoardStore((s) => s.boards);
  const fetchBoards = useBoardStore((s) => s.fetchBoards);
  const getBoardById = useBoardStore((s) => s.getBoardById);

  const groups = useTaskStore((s) => s.groups);
  const tasksByGroup = useTaskStore((s) => s.tasksByGroup);
  const loading = useTaskStore((s) => s.loading);
  const fetchBoardData = useTaskStore((s) => s.fetchBoardData);
  const clearTasks = useTaskStore((s) => s.clear);
  const addTaskLocal = useTaskStore((s) => s.addTask);
  const updateTaskLocal = useTaskStore((s) => s.updateTask);
  const deleteTaskLocal = useTaskStore((s) => s.deleteTask);
  const addGroupLocal = useTaskStore((s) => s.addGroup);
  const removeGroupLocal = useTaskStore((s) => s.removeGroup);
  const refreshNotifications = useNotificationStore((s) => s.fetchNotifications);
  const toastError = useToastStore((s) => s.error);

  // Collapse state, keyed by group id
  const [collapsed, setCollapsed] = useState(() => new Set());
  // Which group (if any) is currently creating a new task inline
  const [creatingInGroup, setCreatingInGroup] = useState(null);
  // Key counter per group — increment after each save to reset the inline creation row
  const [newTaskKeysByGroup, setNewTaskKeysByGroup] = useState({});
  // Task currently being edited inline
  const [editingTaskId, setEditingTaskId] = useState(null);
  // Status chip menu state
  const [statusMenu, setStatusMenu] = useState(null); // { task, anchor }
  // Priority chip menu state
  const [priorityMenu, setPriorityMenu] = useState(null); // { task, anchor }
  // Row actions menu state
  const [actionsMenu, setActionsMenu] = useState(null); // { task, anchor }
  // Delete confirmation
  const [taskPendingDelete, setTaskPendingDelete] = useState(null);
  // Comment panel — which task (if any) is open in the side panel
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  // New-group modal state
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupModalError, setGroupModalError] = useState(null);
  // Delete-group confirmation state
  const [groupPendingDelete, setGroupPendingDelete] = useState(null);
  const [deletingGroup, setDeletingGroup] = useState(false);

  // --- Notification highlight (scroll-to + glow) --------------------------
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);

  const board = getBoardById(boardId) || null;
  const orgId = currentOrg?._id || null;

  // If we navigated directly and the boards list is empty, fetch it so the
  // header can resolve the board metadata.
  useEffect(() => {
    if (!board && orgId && boards.length === 0) {
      fetchBoards(orgId).catch((err) =>
        console.error('Failed to fetch boards:', err)
      );
    }
  }, [board, orgId, boards.length, fetchBoards]);

  // Fetch groups + tasks for this board
  useEffect(() => {
    if (!boardId) return;
    fetchBoardData(boardId).catch((err) => {
      console.error('Failed to load board data:', err);
    });
    return () => {
      clearTasks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  // --- Handle highlightTask query param from notification click -----------
  useEffect(() => {
    const taskId = searchParams.get('highlightTask');
    if (!taskId || loading || groups.length === 0) return;

    // Find which group contains the task and ensure it's expanded
    for (const group of groups) {
      const groupTasks = tasksByGroup[group._id] || [];
      if (groupTasks.some((t) => t._id === taskId)) {
        // Expand the group if collapsed
        setCollapsed((prev) => {
          const next = new Set(prev);
          next.delete(group._id);
          return next;
        });
        break;
      }
    }

    // Clear the query param so refreshing doesn't re-trigger
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('highlightTask');
      return next;
    }, { replace: true });

    // Set highlight — scroll + auto-remove are handled by separate effects below
    setHighlightedTaskId(taskId);
  }, [searchParams, loading, groups, tasksByGroup, setSearchParams]);

  // --- Auto-remove highlight after animation completes -------------------
  useEffect(() => {
    if (!highlightedTaskId) return;
    const timer = setTimeout(() => setHighlightedTaskId(null), 3000);
    return () => clearTimeout(timer);
  }, [highlightedTaskId]);

  // Fetch org members (used by assignee picker) — admin only actually needs
  // them, but caching them doesn't hurt and useful for future features.
  useEffect(() => {
    if (!orgId) return;
    if (!isAdmin) return;
    fetchMembers(orgId).catch((err) =>
      console.error('Failed to load members:', err)
    );
  }, [orgId, isAdmin, fetchMembers]);

  const totalTaskCount = useMemo(
    () =>
      Object.values(tasksByGroup).reduce(
        (acc, list) => acc + (list?.length || 0),
        0
      ),
    [tasksByGroup]
  );

  const toggleGroup = (groupId) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleOpenTask = (task) => {
    if (!task?._id) return;
    setSelectedTaskId(task._id);
  };

  const handleCloseTask = () => setSelectedTaskId(null);

  // Resolve the selected task from the live store so the panel reflects
  // updates (status change, edit, etc.) while open.
  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    for (const list of Object.values(tasksByGroup)) {
      if (!Array.isArray(list)) continue;
      const match = list.find((t) => t._id === selectedTaskId);
      if (match) return match;
    }
    return null;
  }, [selectedTaskId, tasksByGroup]);

  // Auto-close the panel if the selected task disappears (e.g. deleted)
  useEffect(() => {
    if (selectedTaskId && !selectedTask) {
      setSelectedTaskId(null);
    }
  }, [selectedTaskId, selectedTask]);

  // --- Inline creation --------------------------------------------------

  const handleStartCreate = (groupId) => {
    setEditingTaskId(null);
    setCreatingInGroup(groupId);
    // Auto-expand the group if it's collapsed
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(groupId);
      return next;
    });
  };

  const handleSaveNewTask = useCallback(
    async (groupId, payload) => {
      try {
        const created = await taskService.createTask({
          ...payload,
          board: boardId,
          group: groupId,
        });
        addTaskLocal(created);
        // Increment the key for this group so the creation row resets
        setNewTaskKeysByGroup((prev) => ({
          ...prev,
          [groupId]: (prev[groupId] || 0) + 1,
        }));
        refreshNotifications();
      } catch (err) {
        console.error('Failed to create task:', err);
        toastError(
          err?.response?.data?.error ||
            'Failed to create task. Please try again.'
        );
        throw err;
      }
    },
    [boardId, addTaskLocal, refreshNotifications, toastError]
  );

  // --- Inline edit ------------------------------------------------------

  const handleStartEdit = (task) => {
    setCreatingInGroup(null);
    setEditingTaskId(task._id);
  };

  const handleSaveEditTask = useCallback(
    async (taskId, payload) => {
      try {
        const updated = await taskService.updateTask(taskId, payload);
        updateTaskLocal(updated);
        setEditingTaskId(null);
        refreshNotifications();
      } catch (err) {
        console.error('Failed to update task:', err);
        toastError(
          err?.response?.data?.error ||
            'Failed to update task. Please try again.'
        );
        throw err;
      }
    },
    [updateTaskLocal, refreshNotifications, toastError]
  );

  const handleCancelEdit = () => {
    setCreatingInGroup(null);
    setEditingTaskId(null);
  };

  // --- Inline status change --------------------------------------------

  const canChangeStatus = () => {
    // All org members can change task status
    return !!currentUser;
  };

  const handleStatusClick = (task, event) => {
    if (!canChangeStatus(task)) return;
    const anchor = event?.currentTarget || null;
    setStatusMenu({ task, anchor });
  };

  const handleStatusSelect = async (newStatus) => {
    if (!statusMenu) return;
    const { task } = statusMenu;
    setStatusMenu(null);
    if (newStatus === task.status) return;
    // Optimistic update
    const prev = task;
    updateTaskLocal({ ...task, status: newStatus });
    try {
      const updated = await taskService.updateTask(task._id, {
        status: newStatus,
      });
      updateTaskLocal(updated);
      refreshNotifications();
    } catch (err) {
      console.error('Failed to update status:', err);
      updateTaskLocal(prev);
      toastError(
        err?.response?.data?.error ||
          'Failed to update status. Please try again.'
      );
    }
  };

  // --- Inline priority change ------------------------------------------

  const handlePriorityClick = (task, event) => {
    if (!currentUser) return;
    const anchor = event?.currentTarget || null;
    setPriorityMenu({ task, anchor });
  };

  const handlePrioritySelect = async (newPriority) => {
    if (!priorityMenu) return;
    const { task } = priorityMenu;
    setPriorityMenu(null);
    if (newPriority === task.priority) return;
    const prev = task;
    updateTaskLocal({ ...task, priority: newPriority });
    try {
      const updated = await taskService.updateTask(task._id, {
        priority: newPriority,
      });
      updateTaskLocal(updated);
    } catch (err) {
      console.error('Failed to update priority:', err);
      updateTaskLocal(prev);
      toastError(
        err?.response?.data?.error ||
          'Failed to update priority. Please try again.'
      );
    }
  };

  // --- Row actions menu (Edit / Delete) --------------------------------

  const handleActionsClick = (task, event) => {
    if (!isAdmin) return;
    const anchor = event?.currentTarget || null;
    setActionsMenu({ task, anchor });
  };

  const handleMenuEdit = () => {
    if (!actionsMenu) return;
    const task = actionsMenu.task;
    setActionsMenu(null);
    handleStartEdit(task);
  };

  const handleMenuDelete = () => {
    if (!actionsMenu) return;
    const task = actionsMenu.task;
    setActionsMenu(null);
    setTaskPendingDelete(task);
  };

  const handleConfirmDelete = async () => {
    if (!taskPendingDelete) return;
    const task = taskPendingDelete;
    setTaskPendingDelete(null);
    try {
      await taskService.deleteTask(task._id);
      deleteTaskLocal(task._id);
    } catch (err) {
      console.error('Failed to delete task:', err);
      toastError(
        err?.response?.data?.error ||
          'Failed to delete task. Please try again.'
      );
    }
  };

  // --- New group creation ----------------------------------------------

  const handleOpenGroupModal = () => {
    setNewGroupName('');
    setGroupModalError(null);
    setCreatingGroup(false);
    setGroupModalOpen(true);
  };

  const handleCloseGroupModal = () => {
    if (creatingGroup) return;
    setGroupModalOpen(false);
  };

  const handleSubmitNewGroup = async (e) => {
    e?.preventDefault?.();
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      setGroupModalError('Group name is required');
      return;
    }
    try {
      setCreatingGroup(true);
      setGroupModalError(null);
      const created = await taskService.createGroup(boardId, { name: trimmed });
      addGroupLocal(created);
      setGroupModalOpen(false);
      setNewGroupName('');
    } catch (err) {
      console.error('Failed to create group:', err);
      setGroupModalError(
        err?.response?.data?.error ||
          'Failed to create group. Please try again.'
      );
    } finally {
      setCreatingGroup(false);
    }
  };

  // --- Group deletion -----------------------------------------------------

  const handleDeleteGroup = (group) => {
    setGroupPendingDelete(group);
  };

  const handleConfirmDeleteGroup = async () => {
    if (!groupPendingDelete) return;
    const group = groupPendingDelete;
    setGroupPendingDelete(null);
    setDeletingGroup(true);
    try {
      await taskService.deleteGroup(group._id);
      removeGroupLocal(group._id);
    } catch (err) {
      console.error('Failed to delete group:', err);
      toastError(
        err?.response?.data?.error ||
          'Failed to delete group. Please try again.'
      );
    } finally {
      setDeletingGroup(false);
    }
  };

  const isPublic = board?.visibility === 'public';
  const VisibilityIcon = isPublic ? Globe : Lock;
  const hasGroups = groups.length > 0;

  return (
    <PageWrapper>
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 font-body"
        style={{ fontSize: 13 }}
      >
        <Link
          to="/boards"
          className="transition-colors duration-150 hover:text-[color:var(--color-accent)]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          My Boards
        </Link>
        <ChevronRight
          size={14}
          color="var(--color-text-muted)"
          aria-hidden="true"
        />
        <span
          style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}
          className="truncate"
        >
          {board?.name || 'Loading…'}
        </span>
      </nav>

      {/* Board header */}
      <header className="mt-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1
              className="font-display truncate"
              style={{
                fontSize: 26,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '-0.01em',
                color: 'var(--color-text-primary)',
              }}
            >
              {board?.name || '—'}
            </h1>
            {board && (
              <span
                className="inline-flex items-center gap-1 font-body shrink-0"
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  background: isPublic
                    ? 'var(--color-status-done-bg)'
                    : '#FFF0F0',
                  color: isPublic ? 'var(--color-status-done)' : '#DC2626',
                }}
              >
                <VisibilityIcon size={11} aria-hidden="true" />
                {isPublic ? 'public' : 'private'}
              </span>
            )}
          </div>
          <p
            className="mt-1 font-body"
            style={{ fontSize: 13, color: 'var(--color-text-muted)' }}
          >
            {board
              ? `Created ${formatDate(board.createdAt)} · ${totalTaskCount} ${totalTaskCount === 1 ? 'task' : 'tasks'}`
              : 'Loading board details…'}
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="primary"
              icon={Plus}
              onClick={handleOpenGroupModal}
            >
              New Group
            </Button>
            <button
              type="button"
              aria-label="Board settings"
              onClick={() => navigate('/settings')}
              className="flex items-center justify-center rounded-md transition-colors duration-150 hover:bg-[color:var(--color-bg-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
              style={{
                width: 38,
                height: 38,
                border: '1.5px solid var(--color-border-strong)',
              }}
            >
              <SettingsIcon
                size={16}
                color="var(--color-text-secondary)"
                aria-hidden="true"
              />
            </button>
          </div>
        )}
      </header>

      {/* Task groups */}
      <section className="mt-6 flex flex-col gap-4">
        {loading && !hasGroups ? (
          <div
            role="status"
            aria-live="polite"
            aria-label="Loading board"
            className="flex flex-col gap-4"
          >
            <SkeletonTaskGroup rowCount={4} index={0} />
            <SkeletonTaskGroup rowCount={3} index={1} />
          </div>
        ) : !hasGroups ? (
          <div
            className="bg-surface"
            style={{
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-card)',
              padding: '48px 16px',
            }}
          >
            <EmptyState
              icon={Plus}
              title="No task groups yet"
              description={
                isAdmin
                  ? 'Create your first group to start organising tasks'
                  : 'Nothing has been set up on this board yet'
              }
              actionLabel={isAdmin ? 'Create first group' : undefined}
              onAction={isAdmin ? handleOpenGroupModal : undefined}
            />
          </div>
        ) : (
          groups.map((group, idx) => {
            const groupTasks = tasksByGroup[group._id] || [];
            const doneCount = groupTasks.filter(
              (t) => t.status === 'done'
            ).length;
            const isCollapsed = collapsed.has(group._id);
            const isEditingHere =
              editingTaskId != null &&
              groupTasks.some((t) => t._id === editingTaskId);
            const needsOverflowVisible = !isCollapsed;

            return (
              <div
                key={group._id}
                className={`bg-surface ${
                  needsOverflowVisible ? 'overflow-visible' : 'overflow-hidden'
                }`}
                style={{
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <TaskGroupHeader
                  name={group.name}
                  colorDot={GROUP_DOT_CYCLE[idx % GROUP_DOT_CYCLE.length]}
                  totalCount={groupTasks.length}
                  doneCount={doneCount}
                  collapsed={isCollapsed}
                  onToggle={() => toggleGroup(group._id)}
                  onDeleteGroup={isAdmin ? () => handleDeleteGroup(group) : undefined}
                />
                {!isCollapsed && (
                  <TaskTable
                    tasks={groupTasks}
                    members={members}
                    editingTaskId={editingTaskId}
                    isCreating={isAdmin}
                    createKey={newTaskKeysByGroup[group._id] || 0}
                    isAdmin={isAdmin}
                    highlightedTaskId={highlightedTaskId}
                    onOpenTask={handleOpenTask}
                    onStatusClick={handleStatusClick}
                    onPriorityClick={handlePriorityClick}
                    onActionsClick={isAdmin ? handleActionsClick : undefined}
                    onSaveNew={(payload) => handleSaveNewTask(group._id, payload)}
                    onSaveEdit={handleSaveEditTask}
                    onCancelEdit={handleCancelEdit}
                  />
                )}
              </div>
            );
          })
        )}
      </section>

      {/* Status chip menu */}
      {statusMenu && (
        <StatusMenu
          anchorEl={statusMenu.anchor}
          value={statusMenu.task.status}
          onSelect={handleStatusSelect}
          onClose={() => setStatusMenu(null)}
        />
      )}

      {/* Priority chip menu */}
      {priorityMenu && (
        <PriorityMenu
          anchorEl={priorityMenu.anchor}
          value={priorityMenu.task.priority}
          onSelect={handlePrioritySelect}
          onClose={() => setPriorityMenu(null)}
        />
      )}

      {/* Row actions menu (Edit / Delete) */}
      {actionsMenu && (
        <TaskActionsMenu
          anchorEl={actionsMenu.anchor}
          onEdit={handleMenuEdit}
          onDelete={handleMenuDelete}
          onClose={() => setActionsMenu(null)}
        />
      )}

      {/* Delete confirmation */}
      <Modal
        isOpen={!!taskPendingDelete}
        onClose={() => setTaskPendingDelete(null)}
        title="Delete task?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setTaskPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p
          className="font-body"
          style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}
        >
          Are you sure you want to delete{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>
            {taskPendingDelete?.name}
          </strong>
          ? This will also remove any comments attached to it. This action
          cannot be undone.
        </p>
      </Modal>

      {/* Delete group confirmation */}
      <Modal
        isOpen={!!groupPendingDelete}
        onClose={() => { if (!deletingGroup) setGroupPendingDelete(null); }}
        title="Delete group?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setGroupPendingDelete(null)}
              disabled={deletingGroup}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDeleteGroup} disabled={deletingGroup}>
              {deletingGroup ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p
          className="font-body"
          style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}
        >
          Are you sure you want to delete the group{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>
            {groupPendingDelete?.name}
          </strong>
          ? This will permanently delete all tasks and comments inside it. This
          action cannot be undone.
        </p>
      </Modal>

      {/* New group modal */}
      <Modal
        isOpen={groupModalOpen}
        onClose={handleCloseGroupModal}
        title="New Group"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={handleCloseGroupModal}
              disabled={creatingGroup}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitNewGroup}
              disabled={creatingGroup}
            >
              {creatingGroup ? 'Creating…' : 'Create Group'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmitNewGroup} className="flex flex-col gap-3">
          <Input
            label="Group Name"
            required
            placeholder="e.g. To Do"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            autoFocus
          />
          {groupModalError && (
            <p
              className="font-body text-xs"
              style={{ color: 'var(--color-status-stuck)' }}
            >
              {groupModalError}
            </p>
          )}
          {/* Hidden submit so <Enter> submits the form */}
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
      </Modal>

      {/* Dim overlay for notification highlight */}
      {highlightedTaskId && (
        <div
          className="macan-highlight-overlay"
          onClick={() => setHighlightedTaskId(null)}
        />
      )}

      {/* Task comment panel */}
      <CommentPanel
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={handleCloseTask}
      />
    </PageWrapper>
  );
};

export default BoardDetailPage;

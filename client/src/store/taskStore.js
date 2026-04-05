import { create } from 'zustand';
import * as taskService from '../services/taskService';

/**
 * useTaskStore — tracks tasks (and their groups) for the board detail view.
 *
 * Tasks are keyed by their group id in `tasksByGroup` so each group's table
 * can read its slice independently without re-rendering the whole board.
 */
const useTaskStore = create((set, get) => ({
  groups: [],
  tasksByGroup: {},   // { [groupId]: Task[] }
  loading: false,
  error: null,

  /**
   * Fetch all groups for a board, then fetch all tasks for the board and
   * bucket them by group id. A single /api/tasks?board=:id call avoids the
   * N+1 per-group roundtrip.
   */
  fetchBoardData: async (boardId) => {
    if (!boardId) return;
    set({ loading: true, error: null });
    try {
      const [groups, tasks] = await Promise.all([
        taskService.getGroups(boardId),
        taskService.getTasks(boardId),
      ]);

      const tasksByGroup = {};
      for (const g of groups) tasksByGroup[g._id] = [];
      for (const t of tasks) {
        const gid = t.group;
        if (!gid) continue;
        if (!tasksByGroup[gid]) tasksByGroup[gid] = [];
        tasksByGroup[gid].push(t);
      }

      set({ groups, tasksByGroup, loading: false });
    } catch (err) {
      set({ loading: false, error: err });
      throw err;
    }
  },

  /**
   * Replace the tasks for a single group (used after inline edits/refetches).
   */
  setGroupTasks: (groupId, tasks) =>
    set((s) => ({
      tasksByGroup: { ...s.tasksByGroup, [groupId]: tasks },
    })),

  /**
   * Append a task to its group bucket.
   */
  addTask: (task) =>
    set((s) => {
      const gid = task.group;
      if (!gid) return s;
      const existing = s.tasksByGroup[gid] || [];
      return {
        tasksByGroup: { ...s.tasksByGroup, [gid]: [...existing, task] },
      };
    }),

  /**
   * Replace a task in place within its group bucket.
   */
  updateTask: (task) =>
    set((s) => {
      const gid = task.group;
      if (!gid) return s;
      const existing = s.tasksByGroup[gid] || [];
      return {
        tasksByGroup: {
          ...s.tasksByGroup,
          [gid]: existing.map((t) => (t._id === task._id ? task : t)),
        },
      };
    }),

  /**
   * Remove a task by id from any group bucket it currently lives in.
   */
  deleteTask: (id) =>
    set((s) => {
      const next = {};
      for (const [gid, list] of Object.entries(s.tasksByGroup)) {
        next[gid] = list.filter((t) => t._id !== id);
      }
      return { tasksByGroup: next };
    }),

  addGroup: (group) =>
    set((s) => ({
      groups: [...s.groups, group],
      tasksByGroup: { ...s.tasksByGroup, [group._id]: [] },
    })),

  updateGroupLocal: (group) =>
    set((s) => ({
      groups: s.groups.map((g) => (g._id === group._id ? group : g)),
    })),

  removeGroup: (groupId) =>
    set((s) => {
      const nextGroups = s.groups.filter((g) => g._id !== groupId);
      const { [groupId]: _removed, ...rest } = s.tasksByGroup;
      return { groups: nextGroups, tasksByGroup: rest };
    }),

  clear: () => set({ groups: [], tasksByGroup: {}, error: null }),

  // Helpers
  getTasksForGroup: (groupId) => get().tasksByGroup[groupId] || [],
}));

export default useTaskStore;

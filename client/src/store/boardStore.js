import { create } from 'zustand';
import * as boardService from '../services/boardService';

/**
 * Merge new `labels` / `statuses` into the board record in-place. Returns
 * a new boards array reference so React notices the change.
 */
const replaceBoardChips = (boards, boardId, key, list) =>
  boards.map((b) =>
    b._id === boardId ? { ...b, [key]: list } : b
  );

const useBoardStore = create((set, get) => ({
  boards: [],
  loading: false,
  error: null,

  fetchBoards: async (orgId) => {
    if (!orgId) return [];
    set({ loading: true, error: null });
    try {
      const boards = await boardService.getBoards(orgId);
      set({ boards, loading: false });
      return boards;
    } catch (err) {
      set({ loading: false, error: err });
      throw err;
    }
  },

  createBoard: async (payload) => {
    const board = await boardService.createBoard(payload);
    set((s) => ({ boards: [board, ...s.boards] }));
    return board;
  },

  updateBoard: async (id, payload) => {
    const board = await boardService.updateBoard(id, payload);
    set((s) => ({
      boards: s.boards.map((b) => (b._id === id ? board : b)),
    }));
    return board;
  },

  deleteBoard: async (id) => {
    await boardService.deleteBoard(id);
    set((s) => ({ boards: s.boards.filter((b) => b._id !== id) }));
  },

  // Local-only helpers
  addBoardLocal: (board) =>
    set((s) => ({ boards: [board, ...s.boards] })),

  updateBoardLocal: (board) =>
    set((s) => ({
      boards: s.boards.map((b) => (b._id === board._id ? board : b)),
    })),

  removeBoardLocal: (id) =>
    set((s) => ({ boards: s.boards.filter((b) => b._id !== id) })),

  clearBoards: () => set({ boards: [], error: null }),

  // --- Labels --------------------------------------------------------------

  addLabel: async (boardId, payload) => {
    const labels = await boardService.addLabel(boardId, payload);
    set((s) => ({ boards: replaceBoardChips(s.boards, boardId, 'labels', labels) }));
    return labels;
  },

  updateLabel: async (boardId, labelId, payload) => {
    const labels = await boardService.updateLabel(boardId, labelId, payload);
    set((s) => ({ boards: replaceBoardChips(s.boards, boardId, 'labels', labels) }));
    return labels;
  },

  deleteLabel: async (boardId, labelId) => {
    const labels = await boardService.deleteLabel(boardId, labelId);
    set((s) => ({ boards: replaceBoardChips(s.boards, boardId, 'labels', labels) }));
    return labels;
  },

  reorderLabels: async (boardId, orderedIds) => {
    const labels = await boardService.reorderLabels(boardId, orderedIds);
    set((s) => ({ boards: replaceBoardChips(s.boards, boardId, 'labels', labels) }));
    return labels;
  },

  // --- Statuses ------------------------------------------------------------

  addStatus: async (boardId, payload) => {
    const statuses = await boardService.addStatus(boardId, payload);
    set((s) => ({ boards: replaceBoardChips(s.boards, boardId, 'statuses', statuses) }));
    return statuses;
  },

  updateStatusChip: async (boardId, statusId, payload) => {
    const statuses = await boardService.updateStatus(boardId, statusId, payload);
    set((s) => ({ boards: replaceBoardChips(s.boards, boardId, 'statuses', statuses) }));
    return statuses;
  },

  deleteStatus: async (boardId, statusId) => {
    const statuses = await boardService.deleteStatus(boardId, statusId);
    set((s) => ({ boards: replaceBoardChips(s.boards, boardId, 'statuses', statuses) }));
    return statuses;
  },

  reorderStatuses: async (boardId, orderedIds) => {
    const statuses = await boardService.reorderStatuses(boardId, orderedIds);
    set((s) => ({ boards: replaceBoardChips(s.boards, boardId, 'statuses', statuses) }));
    return statuses;
  },

  // Helpers
  getBoardById: (id) => get().boards.find((b) => b._id === id) || null,
}));

export default useBoardStore;

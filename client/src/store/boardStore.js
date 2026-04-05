import { create } from 'zustand';
import * as boardService from '../services/boardService';

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

  /**
   * Create a board via the API and prepend it to the local list.
   */
  createBoard: async (payload) => {
    const board = await boardService.createBoard(payload);
    set((s) => ({ boards: [board, ...s.boards] }));
    return board;
  },

  /**
   * Update a board via the API and replace it in the local list.
   */
  updateBoard: async (id, payload) => {
    const board = await boardService.updateBoard(id, payload);
    set((s) => ({
      boards: s.boards.map((b) => (b._id === id ? board : b)),
    }));
    return board;
  },

  /**
   * Delete a board via the API and remove it from the local list.
   */
  deleteBoard: async (id) => {
    await boardService.deleteBoard(id);
    set((s) => ({ boards: s.boards.filter((b) => b._id !== id) }));
  },

  // Local-only helpers (used by other flows that already have a board object)
  addBoardLocal: (board) =>
    set((s) => ({ boards: [board, ...s.boards] })),

  updateBoardLocal: (board) =>
    set((s) => ({
      boards: s.boards.map((b) => (b._id === board._id ? board : b)),
    })),

  removeBoardLocal: (id) =>
    set((s) => ({ boards: s.boards.filter((b) => b._id !== id) })),

  clearBoards: () => set({ boards: [], error: null }),

  // Helpers
  getBoardById: (id) => get().boards.find((b) => b._id === id) || null,
}));

export default useBoardStore;

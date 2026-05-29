const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  getBoards,
  createBoard,
  updateBoard,
  deleteBoard,
  reorderBoards,
  listLabels,
  addLabel,
  updateLabel,
  deleteLabel,
  reorderLabels,
  listStatuses,
  addStatus,
  updateStatus,
  deleteStatus,
  reorderStatuses,
} = require('../controllers/boardController');

const router = express.Router();

// All board routes require authentication
router.use(authMiddleware);

// GET /api/boards?org=:orgId — list boards for an organisation
router.get('/', getBoards);

// POST /api/boards — create a board (admin-only, enforced in controller)
router.post('/', createBoard);

// PUT /api/boards/reorder — reorder boards within an organisation
// Must come BEFORE /:id so "reorder" isn't parsed as a board id.
router.put('/reorder', reorderBoards);

// PUT /api/boards/:id — update a board (admin-only)
router.put('/:id', updateBoard);

// DELETE /api/boards/:id — delete a board + cascade (admin-only)
router.delete('/:id', deleteBoard);

// --- Labels (per board) ---------------------------------------------------
// reorder must come BEFORE the /:lid routes so it isn't matched as a label id
router.get('/:id/labels',            listLabels);
router.post('/:id/labels',           addLabel);
router.put('/:id/labels/reorder',    reorderLabels);
router.put('/:id/labels/:lid',       updateLabel);
router.delete('/:id/labels/:lid',    deleteLabel);

// --- Statuses (per board) -------------------------------------------------
router.get('/:id/statuses',          listStatuses);
router.post('/:id/statuses',         addStatus);
router.put('/:id/statuses/reorder',  reorderStatuses);
router.put('/:id/statuses/:sid',     updateStatus);
router.delete('/:id/statuses/:sid',  deleteStatus);

module.exports = router;

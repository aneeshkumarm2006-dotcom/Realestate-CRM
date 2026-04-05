const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  getBoards,
  createBoard,
  updateBoard,
  deleteBoard,
} = require('../controllers/boardController');

const router = express.Router();

// All board routes require authentication
router.use(authMiddleware);

// GET /api/boards?org=:orgId — list boards for an organisation
router.get('/', getBoards);

// POST /api/boards — create a board (admin-only, enforced in controller)
router.post('/', createBoard);

// PUT /api/boards/:id — update a board (admin-only)
router.put('/:id', updateBoard);

// DELETE /api/boards/:id — delete a board + cascade (admin-only)
router.delete('/:id', deleteBoard);

module.exports = router;

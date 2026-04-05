const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  getComments,
  addComment,
} = require('../controllers/commentController');

const router = express.Router();

// All comment routes require authentication
router.use(authMiddleware);

// GET  /api/tasks/:taskId/comments — list comments for a task
// POST /api/tasks/:taskId/comments — add a comment to a task
router.get('/tasks/:taskId/comments', getComments);
router.post('/tasks/:taskId/comments', addComment);

module.exports = router;

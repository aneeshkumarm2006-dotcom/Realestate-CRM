const express = require('express');
const authMiddleware = require('../middleware/auth');
const { updateUpload } = require('../config/cloudinary');
const {
  getUpdates,
  addUpdate,
  deleteUpdate,
  uploadAttachment,
} = require('../controllers/updateController');

const router = express.Router();

router.use(authMiddleware);

// GET    /api/tasks/:taskId/updates                  — list updates
// POST   /api/tasks/:taskId/updates                  — create update
// DELETE /api/tasks/:taskId/updates/:id              — delete update
router.get('/tasks/:taskId/updates', getUpdates);
router.post('/tasks/:taskId/updates', addUpdate);
router.delete('/tasks/:taskId/updates/:id', deleteUpdate);

// POST /api/tasks/:taskId/updates/attachments — upload file → Cloudinary
router.post(
  '/tasks/:taskId/updates/attachments',
  updateUpload.single('file'),
  uploadAttachment
);

module.exports = router;

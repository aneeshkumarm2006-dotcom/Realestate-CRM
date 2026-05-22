const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  getTasks,
  getMyTasks,
  getCalendarTasks,
  getSubitems,
  createTask,
  updateTask,
  deleteTask,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  reorderChecklist,
} = require('../controllers/taskController');

const router = express.Router();

// All task routes require authentication
router.use(authMiddleware);

// GET /api/tasks/my — current user's assigned + personal tasks
router.get('/my', getMyTasks);

// GET /api/tasks/calendar?month=:m&year=:y&org=:orgId — tasks for the calendar
router.get('/calendar', getCalendarTasks);

// GET /api/tasks?board=:id&group=:id — list tasks for a board/group
router.get('/', getTasks);

// POST /api/tasks — create task (board task: admin only; personal: any user)
router.post('/', createTask);

// PUT /api/tasks/:id — update task (perms enforced in controller)
router.put('/:id', updateTask);

// DELETE /api/tasks/:id — delete task (admin only for board tasks)
router.delete('/:id', deleteTask);

// GET /api/tasks/:id/subitems — fetch direct children of a task
router.get('/:id/subitems', getSubitems);

// Checklist routes — any task member can mutate
router.post('/:id/checklist', addChecklistItem);
router.put('/:id/checklist/reorder', reorderChecklist);
router.put('/:id/checklist/:itemId', updateChecklistItem);
router.delete('/:id/checklist/:itemId', deleteChecklistItem);

module.exports = router;

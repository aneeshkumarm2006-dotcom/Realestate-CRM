const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  listAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  runAutomationNow,
  getRunLog,
} = require('../controllers/automationController');

const router = express.Router();

router.use(authMiddleware);

// Board-scoped
router.get('/boards/:boardId/automations', listAutomations);
router.post('/boards/:boardId/automations', createAutomation);

// Automation-scoped
router.put('/automations/:id', updateAutomation);
router.delete('/automations/:id', deleteAutomation);
router.post('/automations/:id/run-now', runAutomationNow);
// Run log — member-level read of the last 20 firings (F4.6).
router.get('/automations/:id/run-log', getRunLog);

module.exports = router;

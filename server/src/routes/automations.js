const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  listAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  runAutomationNow,
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

module.exports = router;

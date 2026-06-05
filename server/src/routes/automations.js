const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  listAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  runAutomationNow,
  getRunLog,
  getActionRunLog,
  getActionCatalog,
} = require('../controllers/automationController');
const {
  listRecipes,
  createFromRecipe,
} = require('../controllers/automationRecipeController');

const router = express.Router();

router.use(authMiddleware);

// Board-scoped
router.get('/boards/:boardId/automations', listAutomations);
router.post('/boards/:boardId/automations', createAutomation);

// F5 action catalogue — static, authenticated. Registered before the
// `/automations/:id` param routes so the literal path isn't captured as an `:id`.
router.get('/automations/action-catalog', getActionCatalog);

// F6 recipe library — literal paths, registered before `/automations/:id` so
// `recipes` / `from-recipe` aren't captured as an `:id`.
router.get('/automations/recipes', listRecipes);
router.post('/automations/from-recipe/:slug', createFromRecipe);

// Automation-scoped
router.put('/automations/:id', updateAutomation);
router.delete('/automations/:id', deleteAutomation);
router.post('/automations/:id/run-now', runAutomationNow);
// Run log — member-level read of the last 20 firings (F4.6).
router.get('/automations/:id/run-log', getRunLog);
// Per-action audit rows (F5.3) — member-level.
router.get('/automations/:id/run-log/actions', getActionRunLog);

module.exports = router;

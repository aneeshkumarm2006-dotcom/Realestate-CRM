const express = require('express');
const authMiddleware = require('../middleware/auth');
const { requireOrgAdmin } = require('../middleware/roleCheck');
const {
  createOrg,
  getOrg,
  joinOrg,
  listMembers,
  removeMember,
  regenerateInvite,
  sendInvite,
} = require('../controllers/orgController');

const router = express.Router();

// All org routes require authentication
router.use(authMiddleware);

// Create org
router.post('/', createOrg);

// Join via invite code
router.post('/join/:inviteCode', joinOrg);

// Get org details
router.get('/:id', getOrg);

// List members
router.get('/:id/members', listMembers);

// Remove member (admin only)
router.delete('/:id/members/:userId', requireOrgAdmin, removeMember);

// Regenerate invite code (admin only)
router.post('/:id/regenerate-invite', requireOrgAdmin, regenerateInvite);

// Send invite email (admin only)
router.post('/:id/send-invite', requireOrgAdmin, sendInvite);

module.exports = router;

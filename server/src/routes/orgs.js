const express = require('express');
const authMiddleware = require('../middleware/auth');
const { requireOrgAdmin, requireOrgOwner } = require('../middleware/roleCheck');
const {
  createOrg,
  getOrg,
  joinOrg,
  listMembers,
  removeMember,
  changeRole,
  regenerateInvite,
  sendInvite,
  deleteOrg,
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

// Change member role (admin only)
router.put('/:id/members/:userId/role', requireOrgAdmin, changeRole);

// Regenerate invite code (admin only)
router.post('/:id/regenerate-invite', requireOrgAdmin, regenerateInvite);

// Send invite email (admin only)
router.post('/:id/send-invite', requireOrgAdmin, sendInvite);

// Delete the organisation (owner only — primary admin, not extra admins)
router.delete('/:id', requireOrgOwner, deleteOrg);

module.exports = router;

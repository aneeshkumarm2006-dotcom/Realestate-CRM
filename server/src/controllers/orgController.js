const crypto = require('crypto');
const Organisation = require('../models/Organisation');
const User = require('../models/User');
const { sendInviteEmail } = require('../services/emailService');

/**
 * Generate a short, unique invite code.
 */
const generateInviteCode = () => {
  return crypto.randomBytes(6).toString('hex'); // 12-char hex
};

/**
 * POST /api/orgs — Create a new organisation.
 * The creator becomes admin and first member.
 */
const createOrg = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Organisation name is required' });
    }

    const userId = req.user.userId;

    const org = await Organisation.create({
      name: name.trim(),
      admin: userId,
      members: [userId],
      inviteCode: generateInviteCode(),
    });

    // Attach org to user's organisations list
    await User.findByIdAndUpdate(userId, {
      $addToSet: { organisations: org._id },
    });

    return res.status(201).json({ org });
  } catch (err) {
    console.error('createOrg error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * GET /api/orgs/:id — Get organisation details with populated members.
 */
const getOrg = async (req, res) => {
  try {
    const org = await Organisation.findById(req.params.id)
      .populate('members', 'name email profilePic')
      .populate('admin', 'name email profilePic');

    if (!org) {
      return res.status(404).json({ error: 'Organisation not found' });
    }

    // Only members can view org details
    const isMember = org.members.some(
      (m) => m._id.toString() === req.user.userId
    );
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this organisation' });
    }

    return res.json({ org });
  } catch (err) {
    console.error('getOrg error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * POST /api/orgs/join/:inviteCode — Join an organisation via invite code.
 */
const joinOrg = async (req, res) => {
  try {
    const { inviteCode } = req.params;
    const userId = req.user.userId;

    const org = await Organisation.findOne({ inviteCode });
    if (!org) {
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    const alreadyMember = org.members.some((m) => m.toString() === userId);
    if (!alreadyMember) {
      org.members.push(userId);
      await org.save();
      await User.findByIdAndUpdate(userId, {
        $addToSet: { organisations: org._id },
      });
    }

    return res.json({ org });
  } catch (err) {
    console.error('joinOrg error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * GET /api/orgs/:id/members — List members of an organisation.
 */
const listMembers = async (req, res) => {
  try {
    const org = await Organisation.findById(req.params.id).populate(
      'members',
      'name email profilePic createdAt'
    );
    if (!org) {
      return res.status(404).json({ error: 'Organisation not found' });
    }

    const isMember = org.members.some(
      (m) => m._id.toString() === req.user.userId
    );
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this organisation' });
    }

    return res.json({
      members: org.members,
      adminId: org.admin.toString(),
    });
  } catch (err) {
    console.error('listMembers error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * DELETE /api/orgs/:id/members/:userId — Remove a member (admin only).
 */
const removeMember = async (req, res) => {
  try {
    const { id: orgId, userId: targetUserId } = req.params;

    const org = await Organisation.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: 'Organisation not found' });
    }

    // Admin cannot remove themselves
    if (org.admin.toString() === targetUserId) {
      return res.status(400).json({ error: 'Admin cannot be removed' });
    }

    org.members = org.members.filter((m) => m.toString() !== targetUserId);
    await org.save();

    await User.findByIdAndUpdate(targetUserId, {
      $pull: { organisations: org._id },
    });

    return res.json({ message: 'Member removed', org });
  } catch (err) {
    console.error('removeMember error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * POST /api/orgs/:id/regenerate-invite — Generate a new invite code (admin only).
 */
const regenerateInvite = async (req, res) => {
  try {
    const org = await Organisation.findById(req.params.id);
    if (!org) {
      return res.status(404).json({ error: 'Organisation not found' });
    }

    org.inviteCode = generateInviteCode();
    await org.save();

    return res.json({ inviteCode: org.inviteCode });
  } catch (err) {
    console.error('regenerateInvite error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * POST /api/orgs/:id/send-invite — Send an invite email to a given address (admin only).
 */
const sendInvite = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const org = await Organisation.findById(req.params.id);
    if (!org) {
      return res.status(404).json({ error: 'Organisation not found' });
    }

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const inviteLink = `${clientUrl}/onboarding?invite=${org.inviteCode}`;

    await sendInviteEmail({
      to: email.trim(),
      orgName: org.name,
      inviteLink,
      inviteCode: org.inviteCode,
    });

    return res.json({ message: 'Invite sent successfully' });
  } catch (err) {
    console.error('sendInvite error:', err);
    return res.status(500).json({ error: 'Failed to send invite' });
  }
};

module.exports = {
  createOrg,
  getOrg,
  joinOrg,
  listMembers,
  removeMember,
  regenerateInvite,
  sendInvite,
};

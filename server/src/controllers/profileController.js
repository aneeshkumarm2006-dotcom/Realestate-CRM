const User = require('../models/User');

/**
 * PUT /api/profile — Update the current user's display name.
 */
const updateProfile = async (req, res) => {
  try {
    const { name } = req.body;

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { name: name.trim() },
      { new: true }
    ).select('-__v');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (err) {
    console.error('updateProfile error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * POST /api/profile/upload-avatar — Upload a new profile picture.
 * Multer + Cloudinary have already uploaded and transformed the image.
 * Here we just persist the resulting URL to the user record.
 */
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // multer-storage-cloudinary stores the Cloudinary URL on req.file.path
    const url = req.file.path || req.file.secure_url;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { profilePic: url },
      { new: true }
    ).select('-__v');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user, profilePic: url });
  } catch (err) {
    console.error('uploadAvatar error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  updateProfile,
  uploadAvatar,
};

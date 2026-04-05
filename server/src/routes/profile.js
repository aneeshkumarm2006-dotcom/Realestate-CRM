const express = require('express');
const authMiddleware = require('../middleware/auth');
const { avatarUpload } = require('../config/cloudinary');
const {
  updateProfile,
  uploadAvatar,
} = require('../controllers/profileController');

const router = express.Router();

router.use(authMiddleware);

// PUT /api/profile — update display name
router.put('/', updateProfile);

// POST /api/profile/upload-avatar — multipart upload
router.post('/upload-avatar', avatarUpload.single('avatar'), uploadAvatar);

module.exports = router;

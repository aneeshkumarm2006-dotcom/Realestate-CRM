const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Cloudinary storage for profile avatars.
 * Uploads go directly to Cloudinary with face-crop 200x200 webp.
 * See Macan_TechStack.md Section 8.5.
 */
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'macan/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      {
        width: 200,
        height: 200,
        crop: 'fill',
        gravity: 'face',
        format: 'webp',
      },
    ],
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = {
  cloudinary,
  avatarUpload,
};

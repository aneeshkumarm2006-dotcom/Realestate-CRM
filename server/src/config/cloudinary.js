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

/**
 * Cloudinary storage for task update attachments (images, PDFs, docs).
 * Files keep their original format and live under macan/updates/. The
 * `resource_type: 'auto'` lets Cloudinary infer images vs raw files.
 */
const updateAttachmentStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: 'macan/updates',
    resource_type: 'auto',
    public_id: `${Date.now()}-${(file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')}`,
  }),
});

const updateUpload = multer({
  storage: updateAttachmentStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB per file
});

/**
 * Cloudinary storage for task-level attachments (uploaded from the Files tab).
 * Same shape as update attachments, but isolated under `macan/tasks/` so files
 * can be audited and pruned per surface.
 */
const taskAttachmentStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: 'macan/tasks',
    resource_type: 'auto',
    public_id: `${Date.now()}-${(file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')}`,
  }),
});

const taskAttachmentUpload = multer({
  storage: taskAttachmentStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB per file
});

module.exports = {
  cloudinary,
  avatarUpload,
  updateUpload,
  taskAttachmentUpload,
};

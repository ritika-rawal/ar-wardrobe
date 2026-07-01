import multer from 'multer';

// In-memory storage: the file lands in req.file.buffer and is then persisted into
// MongoDB (see routes/uploads.js -> persistUpload) so uploads survive restarts on
// hosts with ephemeral filesystems.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image uploads are allowed'));
};

export const upload = multer({ storage, fileFilter, limits: { fileSize: 8 * 1024 * 1024 } });

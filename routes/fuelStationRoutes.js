const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fuelStationController = require('../controllers/fuelStationController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads', 'fuel-stations');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const suffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${suffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf|doc|docx/;
    const isAllowed = allowed.test(path.extname(file.originalname).toLowerCase());
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم.'));
    }
  },
});

router.use(authMiddleware);

router.get('/', fuelStationController.getFuelStations);
router.get('/:id', fuelStationController.getFuelStationById);
router.post('/', upload.array('attachments', 15), fuelStationController.createFuelStation);

module.exports = router;

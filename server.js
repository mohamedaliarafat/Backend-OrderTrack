const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

// ===============================
// 📦 IMPORT ROUTES
// ===============================
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const activityRoutes = require('./routes/activityRoutes');
const customerRoutes = require('./routes/customerRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const driverRoutes = require('./routes/driverRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const reportRoutes = require('./routes/reportRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const userRoutes = require('./routes/userRoutes');
const fuelStationRoutes = require('./routes/fuelStationRoutes');
const maintenanceRecordRoutes = require('./routes/maintenanceRecordRoutes');
const technicianReportRoutes = require('./routes/technicianReportRoutes');
const alertRoutes = require('./routes/alertRoutes');
const approvalRequestRoutes = require('./routes/approvalRequestRoutes');
const technicianLocationRoutes = require('./routes/technicianLocationRoutes');
const stationRoutes = require('./routes/stationRoutes');

const app = express();

// ===============================
// 🔐 TRUST PROXY (NGINX + HTTPS)
// ===============================
app.set('trust proxy', 1);

// ===============================
// 🌍 CORS CONFIG (IMPORTANT)
// ===============================
const allowedOrigins = [
  'https://albuhairaalarabia.com',
  'https://www.albuhairaalarabia.com',
  'https://system-albuhairaalarabia.cloud',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Mobile apps / Postman
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.options('*', cors());

// ===============================
// 🧩 MIDDLEWARES
// ===============================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===============================
// 🗄️ DATABASE
// ===============================
mongoose.connect(
  process.env.MONGODB_URL ||
    'mongodb+srv://nasser66:Qwert1557@cluster0.odv4fdk.mongodb.net/',
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
)
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// ===============================
// 🚏 API ROUTES
// ===============================
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/fuel-stations', fuelStationRoutes);
app.use('/api/maintenance-records', maintenanceRecordRoutes);
app.use('/api/technician-reports', technicianReportRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/approval-requests', approvalRequestRoutes);
app.use('/api/technician-locations', technicianLocationRoutes);
app.use('/api/stations', stationRoutes);

// ===============================
// 🏠 ROOT
// ===============================
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Fuel Supply Tracking System API',
  });
});

// ===============================
// 🧪 API ROOT (IMPORTANT FIX)
// ===============================
app.get('/api', (req, res) => {
  res.json({
    status: 'OK',
    message: 'API is running',
    version: '1.0.0',
  });
});

// ===============================
// ❌ 404 HANDLER
// ===============================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// ===============================
// ❌ ERROR HANDLER
// ===============================
app.use((err, req, res, next) => {
  console.error('🔥 ERROR:', err.message);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// ===============================
// 🚀 START SERVER
// ===============================
const PORT = process.env.PORT || 6030;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

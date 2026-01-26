// const express = require('express');
// const mongoose = require('mongoose');
// const cors = require('cors');
// const dotenv = require('dotenv');
// const path = require('path');

// // Load environment variables
// dotenv.config();

// // Import routes
// const authRoutes = require('./routes/authRoutes');
// const orderRoutes = require('./routes/orderRoutes');
// const activityRoutes = require('./routes/activityRoutes');
// const customerRoutes = require('./routes/customerRoutes'); 
// const notificationRoutes = require('./routes/notificationRoutes');
// const driverRoutes = require('./routes/driverRoutes');
// const supplierRoutes = require('./routes/supplierRoutes');
// const reportRoutes = require('./routes/reportRoutes');
// const deviceRoutes = require('./routes/deviceRoutes');
// const maintenanceRoutes = require('./routes/maintenanceRoutes');
// const userRoutes = require('./routes/userRoutes');
// const fuelStationRoutes = require('./routes/fuelStationRoutes');
// const maintenanceRecordRoutes = require('./routes/maintenanceRecordRoutes');
// const technicianReportRoutes = require('./routes/technicianReportRoutes');
// const alertRoutes = require('./routes/alertRoutes');
// const approvalRequestRoutes = require('./routes/approvalRequestRoutes');
// const technicianLocationRoutes = require('./routes/technicianLocationRoutes');
// const stationRoutes = require('./routes/stationRoutes');


// // Initialize Express app
// const app = express();

// // Middleware
// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // Database connection
// mongoose.connect(process.env.MONGODB_URL || 'mongodb+srv://nasser66:Qwert1557@cluster0.odv4fdk.mongodb.net/', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// })
// .then(() => console.log('✅ MongoDB Connected Successfully'))
// .catch(err => console.error('❌ MongoDB Connection Error:', err));

// // Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/orders', orderRoutes);
// app.use('/api/activities', activityRoutes);
// app.use('/api/customers', customerRoutes); 
// app.use('/api/notifications', notificationRoutes);
// app.use('/api/drivers', driverRoutes);
// app.use('/api/suppliers', supplierRoutes);
// app.use('/api/reports', reportRoutes);
// app.use('/api/devices', deviceRoutes);
// app.use('/api/maintenance', maintenanceRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/fuel-stations', fuelStationRoutes);
// app.use('/api/maintenance-records', maintenanceRecordRoutes);
// app.use('/api/technician-reports', technicianReportRoutes);
// app.use('/api/alerts', alertRoutes);
// app.use('/api/approval-requests', approvalRequestRoutes);
// app.use('/api/technician-locations', technicianLocationRoutes);
// app.use('/api/stations', stationRoutes);

// // Root endpoint
// app.get('/', (req, res) => {
//   res.json({ message: 'Fuel Supply Tracking System API' });
// });

// // Error handling middleware
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).json({ error: 'Something went wrong!' });
// });

// // Start server
// const PORT = process.env.PORT || 6030;
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });



const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const cron = require('node-cron');
const moment = require('moment');

// Load environment variables
dotenv.config();

// ===============================
// MODELS
// ===============================
const Maintenance = require('./models/Maintenance');

// ===============================
// ROUTES
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

// ===============================
// APP INIT
// ===============================
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===============================
// DATABASE
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
// ROUTES
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
// 🕒 MONTHLY MAINTENANCE CRON
// ===============================
cron.schedule('5 0 1 * *', async () => {
  console.log('🕒 Running monthly maintenance creation job...');

  try {
    const newMonth = moment().format('YYYY-MM');
    const prevMonth = moment().subtract(1, 'month').format('YYYY-MM');

    // آخر سجل لكل مركبة من الشهر السابق
    const lastRecords = await Maintenance.aggregate([
      { $match: { inspectionMonth: prevMonth } },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$plateNumber',
          record: { $first: '$$ROOT' }
        }
      }
    ]);

    for (const item of lastRecords) {
      const old = item.record;

      // منع التكرار لو السجل اتعمل يدوي
      const exists = await Maintenance.findOne({
        plateNumber: old.plateNumber,
        inspectionMonth: newMonth
      });

      if (exists) continue;

      const daysInMonth = moment(newMonth, 'YYYY-MM').daysInMonth();
      const dailyChecks = [];

      for (let d = 1; d <= daysInMonth; d++) {
        dailyChecks.push({
          date: moment(`${newMonth}-${d}`, 'YYYY-MM-DD').toDate(),
          status: 'pending'
        });
      }

      await Maintenance.create({
        // ===== COPY STATIC DATA =====
        driverId: old.driverId,
        driverName: old.driverName,
        tankNumber: old.tankNumber,
        plateNumber: old.plateNumber,
        driverLicenseNumber: old.driverLicenseNumber,
        driverLicenseExpiry: old.driverLicenseExpiry,
        vehicleLicenseNumber: old.vehicleLicenseNumber,
        vehicleLicenseExpiry: old.vehicleLicenseExpiry,
        vehicleType: old.vehicleType,
        fuelType: old.fuelType,

        vehicleOperatingCardNumber: old.vehicleOperatingCardNumber,
        vehicleOperatingCardIssueDate: old.vehicleOperatingCardIssueDate,
        vehicleOperatingCardExpiryDate: old.vehicleOperatingCardExpiryDate,

        driverOperatingCardName: old.driverOperatingCardName,
        driverOperatingCardNumber: old.driverOperatingCardNumber,
        driverOperatingCardIssueDate: old.driverOperatingCardIssueDate,
        driverOperatingCardExpiryDate: old.driverOperatingCardExpiryDate,

        vehicleRegistrationSerialNumber: old.vehicleRegistrationSerialNumber,
        vehicleRegistrationNumber: old.vehicleRegistrationNumber,
        vehicleRegistrationIssueDate: old.vehicleRegistrationIssueDate,
        vehicleRegistrationExpiryDate: old.vehicleRegistrationExpiryDate,

        insuranceNumber: old.insuranceNumber,
        insuranceExpiry: old.insuranceExpiry,

        // ===== MONTH DATA =====
        inspectionMonth: newMonth,
        inspectedBy: old.inspectedBy,
        inspectedByName: old.inspectedByName,

        dailyChecks,
        totalDays: daysInMonth,
        completedDays: 0,
        pendingDays: daysInMonth,
        monthlyStatus: 'غير مكتمل',

        // ===== RESET STATES =====
        lastOdometerReading: old.lastOdometerReading,
        lastOilChangeOdometer: old.lastOilChangeOdometer,
        totalDistanceSinceOilChange: old.totalDistanceSinceOilChange,

        status: 'active'
      });
    }

    console.log(`✅ Monthly maintenance created for ${newMonth}`);
  } catch (error) {
    console.error('❌ Monthly maintenance cron failed:', error.message);
  }
});

// ===============================
// ROOT
// ===============================
app.get('/', (req, res) => {
  res.json({ message: 'Fuel Supply Tracking System API' });
});

// ===============================
// ERROR HANDLER
// ===============================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 6030;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

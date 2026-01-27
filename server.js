// // const express = require('express');
// // const mongoose = require('mongoose');
// // const cors = require('cors');
// // const dotenv = require('dotenv');
// // const path = require('path');

// // // Load environment variables
// // dotenv.config();

// // // Import routes
// // const authRoutes = require('./routes/authRoutes');
// // const orderRoutes = require('./routes/orderRoutes');
// // const activityRoutes = require('./routes/activityRoutes');
// // const customerRoutes = require('./routes/customerRoutes'); 
// // const notificationRoutes = require('./routes/notificationRoutes');
// // const driverRoutes = require('./routes/driverRoutes');
// // const supplierRoutes = require('./routes/supplierRoutes');
// // const reportRoutes = require('./routes/reportRoutes');
// // const deviceRoutes = require('./routes/deviceRoutes');
// // const maintenanceRoutes = require('./routes/maintenanceRoutes');
// // const userRoutes = require('./routes/userRoutes');
// // const fuelStationRoutes = require('./routes/fuelStationRoutes');
// // const maintenanceRecordRoutes = require('./routes/maintenanceRecordRoutes');
// // const technicianReportRoutes = require('./routes/technicianReportRoutes');
// // const alertRoutes = require('./routes/alertRoutes');
// // const approvalRequestRoutes = require('./routes/approvalRequestRoutes');
// // const technicianLocationRoutes = require('./routes/technicianLocationRoutes');
// // const stationRoutes = require('./routes/stationRoutes');


// // // Initialize Express app
// // const app = express();

// // // Middleware
// // app.use(cors());
// // app.use(express.json());
// // app.use(express.urlencoded({ extended: true }));
// // app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // // Database connection
// // mongoose.connect(process.env.MONGODB_URL || 'mongodb+srv://nasser66:Qwert1557@cluster0.odv4fdk.mongodb.net/', {
// //   useNewUrlParser: true,
// //   useUnifiedTopology: true,
// // })
// // .then(() => console.log('✅ MongoDB Connected Successfully'))
// // .catch(err => console.error('❌ MongoDB Connection Error:', err));

// // // Routes
// // app.use('/api/auth', authRoutes);
// // app.use('/api/orders', orderRoutes);
// // app.use('/api/activities', activityRoutes);
// // app.use('/api/customers', customerRoutes); 
// // app.use('/api/notifications', notificationRoutes);
// // app.use('/api/drivers', driverRoutes);
// // app.use('/api/suppliers', supplierRoutes);
// // app.use('/api/reports', reportRoutes);
// // app.use('/api/devices', deviceRoutes);
// // app.use('/api/maintenance', maintenanceRoutes);
// // app.use('/api/users', userRoutes);
// // app.use('/api/fuel-stations', fuelStationRoutes);
// // app.use('/api/maintenance-records', maintenanceRecordRoutes);
// // app.use('/api/technician-reports', technicianReportRoutes);
// // app.use('/api/alerts', alertRoutes);
// // app.use('/api/approval-requests', approvalRequestRoutes);
// // app.use('/api/technician-locations', technicianLocationRoutes);
// // app.use('/api/stations', stationRoutes);

// // // Root endpoint
// // app.get('/', (req, res) => {
// //   res.json({ message: 'Fuel Supply Tracking System API' });
// // });

// // // Error handling middleware
// // app.use((err, req, res, next) => {
// //   console.error(err.stack);
// //   res.status(500).json({ error: 'Something went wrong!' });
// // });

// // // Start server
// // const PORT = process.env.PORT || 6030;
// // app.listen(PORT, () => {
// //   console.log(`🚀 Server running on port ${PORT}`);
// // });



// const express = require('express');
// const mongoose = require('mongoose');
// const cors = require('cors');
// const dotenv = require('dotenv');
// const path = require('path');
// const cron = require('node-cron');
// const moment = require('moment');

// // Load environment variables
// dotenv.config();

// // ===============================
// // MODELS
// // ===============================
// const Maintenance = require('./models/Maintenance');

// // ===============================
// // ROUTES
// // ===============================
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

// // ===============================
// // APP INIT
// // ===============================
// const app = express();

// // Middleware
// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // ===============================
// // DATABASE
// // ===============================
// mongoose.connect(
//   process.env.MONGODB_URL ||
//     'mongodb+srv://nasser66:Qwert1557@cluster0.odv4fdk.mongodb.net/',
//   {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   }
// )
// .then(() => console.log('✅ MongoDB Connected Successfully'))
// .catch(err => console.error('❌ MongoDB Connection Error:', err));

// // ===============================
// // ROUTES
// // ===============================
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

// // ===============================
// // 🕒 MONTHLY MAINTENANCE CRON
// // ===============================
// cron.schedule('5 0 1 * *', async () => {
//   console.log('🕒 Running monthly maintenance creation job...');

//   try {
//     const newMonth = moment().format('YYYY-MM');
//     const prevMonth = moment().subtract(1, 'month').format('YYYY-MM');

//     // آخر سجل لكل مركبة من الشهر السابق
//     const lastRecords = await Maintenance.aggregate([
//       { $match: { inspectionMonth: prevMonth } },
//       {
//         $sort: { createdAt: -1 }
//       },
//       {
//         $group: {
//           _id: '$plateNumber',
//           record: { $first: '$$ROOT' }
//         }
//       }
//     ]);

//     for (const item of lastRecords) {
//       const old = item.record;

//       // منع التكرار لو السجل اتعمل يدوي
//       const exists = await Maintenance.findOne({
//         plateNumber: old.plateNumber,
//         inspectionMonth: newMonth
//       });

//       if (exists) continue;

//       const daysInMonth = moment(newMonth, 'YYYY-MM').daysInMonth();
//       const dailyChecks = [];

//       for (let d = 1; d <= daysInMonth; d++) {
//         dailyChecks.push({
//           date: moment(`${newMonth}-${d}`, 'YYYY-MM-DD').toDate(),
//           status: 'pending'
//         });
//       }

//       await Maintenance.create({
//         // ===== COPY STATIC DATA =====
//         driverId: old.driverId,
//         driverName: old.driverName,
//         tankNumber: old.tankNumber,
//         plateNumber: old.plateNumber,
//         driverLicenseNumber: old.driverLicenseNumber,
//         driverLicenseExpiry: old.driverLicenseExpiry,
//         vehicleLicenseNumber: old.vehicleLicenseNumber,
//         vehicleLicenseExpiry: old.vehicleLicenseExpiry,
//         vehicleType: old.vehicleType,
//         fuelType: old.fuelType,

//         vehicleOperatingCardNumber: old.vehicleOperatingCardNumber,
//         vehicleOperatingCardIssueDate: old.vehicleOperatingCardIssueDate,
//         vehicleOperatingCardExpiryDate: old.vehicleOperatingCardExpiryDate,

//         driverOperatingCardName: old.driverOperatingCardName,
//         driverOperatingCardNumber: old.driverOperatingCardNumber,
//         driverOperatingCardIssueDate: old.driverOperatingCardIssueDate,
//         driverOperatingCardExpiryDate: old.driverOperatingCardExpiryDate,

//         vehicleRegistrationSerialNumber: old.vehicleRegistrationSerialNumber,
//         vehicleRegistrationNumber: old.vehicleRegistrationNumber,
//         vehicleRegistrationIssueDate: old.vehicleRegistrationIssueDate,
//         vehicleRegistrationExpiryDate: old.vehicleRegistrationExpiryDate,

//         insuranceNumber: old.insuranceNumber,
//         insuranceExpiry: old.insuranceExpiry,

//         // ===== MONTH DATA =====
//         inspectionMonth: newMonth,
//         inspectedBy: old.inspectedBy,
//         inspectedByName: old.inspectedByName,

//         dailyChecks,
//         totalDays: daysInMonth,
//         completedDays: 0,
//         pendingDays: daysInMonth,
//         monthlyStatus: 'غير مكتمل',

//         // ===== RESET STATES =====
//         lastOdometerReading: old.lastOdometerReading,
//         lastOilChangeOdometer: old.lastOilChangeOdometer,
//         totalDistanceSinceOilChange: old.totalDistanceSinceOilChange,

//         status: 'active'
//       });
//     }

//     console.log(`✅ Monthly maintenance created for ${newMonth}`);
//   } catch (error) {
//     console.error('❌ Monthly maintenance cron failed:', error.message);
//   }
// });

// // ===============================
// // ROOT
// // ===============================
// app.get('/', (req, res) => {
//   res.json({ message: 'Fuel Supply Tracking System API' });
// });

// // ===============================
// // ERROR HANDLER
// // ===============================
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).json({ error: 'Something went wrong!' });
// });

// // ===============================
// // START SERVER
// // ===============================
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
// ROUTES - نظام التتبع الأصلي
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
// ROUTES - نظام شؤون الموظفين الجديد
// ===============================
const EmployeeRoutes = require('./routes/employeeRoutes');
const AttendanceRoutes = require('./routes/attendanceRoutes');
const SalaryRoutes = require('./routes/salaryRoutes');
const AdvanceRoutes = require('./routes/advanceRoutes');
const PenaltyRoutes = require('./routes/penaltyRoutes');
const LocationRoutes = require('./routes/locationRoutes');

// ===============================
// APP INIT
// ===============================
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
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
// ROUTES - نظام التتبع
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
// ROUTES - نظام شؤون الموظفين
// ===============================
app.use('/api/employees', EmployeeRoutes);
app.use('/api/attendance', AttendanceRoutes);
app.use('/api/salaries', SalaryRoutes);
app.use('/api/advances', AdvanceRoutes);
app.use('/api/penalties', PenaltyRoutes);
app.use('/api/locations', LocationRoutes);

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
// 🕒 CRON JOBS لنظام شؤون الموظفين
// ===============================

// 1. توليد سجلات حضور تلقائية للموظفين النشطين
cron.schedule('0 23 * * *', async () => {
  console.log('🕒 Creating daily attendance records...');
  try {
    const Employee = require('./models/Employee');
    const Attendance = require('./models/Attendance');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const employees = await Employee.find({ 
      status: 'نشط',
      'fingerprintEnrolled': true 
    });
    
    for (const employee of employees) {
      const existingRecord = await Attendance.findOne({
        employeeId: employee._id,
        date: today
      });
      
      if (!existingRecord) {
        const attendance = new Attendance({
          employeeId: employee._id,
          date: today,
          status: 'غياب' // سيتم تغييرها عند الحضور الفعلي
        });
        
        await attendance.save();
      }
    }
    
    console.log(`✅ Created attendance records for ${employees.length} employees`);
  } catch (error) {
    console.error('❌ Daily attendance cron failed:', error.message);
  }
});

// 2. تحديث حالة السلف المتأخرة
cron.schedule('0 0 1 * *', async () => {
  console.log('🕒 Updating overdue advances...');
  try {
    const Advance = require('./models/Advance');
    
    const today = new Date();
    const overdueAdvances = await Advance.find({
      status: 'قسط',
      'repayments.status': 'مستحق',
      'repayments.dueDate': { $lt: today }
    });
    
    for (const advance of overdueAdvances) {
      advance.repayments.forEach(repayment => {
        if (repayment.status === 'مستحق' && repayment.dueDate < today) {
          repayment.status = 'متأخر';
        }
      });
      
      advance.status = 'متأخر';
      await advance.save();
    }
    
    console.log(`✅ Updated ${overdueAdvances.length} overdue advances`);
  } catch (error) {
    console.error('❌ Overdue advances cron failed:', error.message);
  }
});

// 3. تنبيهات انتهاء العقود والإقامات
cron.schedule('0 8 * * *', async () => {
  console.log('🕒 Checking contract and residency expiries...');
  try {
    const Employee = require('./models/Employee');
    // const Alert = require('./models/hr/Alert.model');
    
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(today.getMonth() + 1);
    
    // الموظفين الذين تنتهي عقودهم خلال الشهر القادم
    const expiringContracts = await Employee.find({
      status: 'نشط',
      contractEndDate: { 
        $gte: today,
        $lte: nextMonth 
      }
    });
    
    // الموظفين الذين تنتهي إقاماتهم خلال الشهر القادم
    const expiringResidencies = await Employee.find({
      status: 'نشط',
      residencyExpiryDate: { 
        $gte: today,
        $lte: nextMonth 
      }
    });
    
    // إنشاء تنبيهات
    for (const employee of expiringContracts) {
      const daysLeft = Math.ceil((employee.contractEndDate - today) / (1000 * 60 * 60 * 24));
      
      const existingAlert = await Alert.findOne({
        employeeId: employee._id,
        type: 'contract_expiry',
        'metadata.daysLeft': daysLeft
      });
      
      if (!existingAlert) {
        const alert = new Alert({
          employeeId: employee._id,
          type: 'contract_expiry',
          title: `انتهاء عقد الموظف ${employee.name}`,
          message: `ينتهي عقد الموظف ${employee.name} بعد ${daysLeft} يوم`,
          priority: daysLeft <= 7 ? 'high' : daysLeft <= 30 ? 'medium' : 'low',
          metadata: {
            employeeName: employee.name,
            contractEndDate: employee.contractEndDate,
            daysLeft: daysLeft
          },
          status: 'unread'
        });
        
        await alert.save();
      }
    }
    
    for (const employee of expiringResidencies) {
      const daysLeft = Math.ceil((employee.residencyExpiryDate - today) / (1000 * 60 * 60 * 24));
      
      const existingAlert = await Alert.findOne({
        employeeId: employee._id,
        type: 'residency_expiry',
        'metadata.daysLeft': daysLeft
      });
      
      if (!existingAlert) {
        const alert = new Alert({
          employeeId: employee._id,
          type: 'residency_expiry',
          title: `انتهاء إقامة الموظف ${employee.name}`,
          message: `تنتهي إقامة الموظف ${employee.name} بعد ${daysLeft} يوم`,
          priority: daysLeft <= 7 ? 'high' : daysLeft <= 30 ? 'medium' : 'low',
          metadata: {
            employeeName: employee.name,
            residencyExpiryDate: employee.residencyExpiryDate,
            daysLeft: daysLeft
          },
          status: 'unread'
        });
        
        await alert.save();
      }
    }
    
    console.log(`✅ Created alerts for ${expiringContracts.length} contracts and ${expiringResidencies.length} residencies`);
  } catch (error) {
    console.error('❌ Expiry alerts cron failed:', error.message);
  }
});

// ===============================
// ROOT ENDPOINT
// ===============================
app.get('/', (req, res) => {
  res.json({ 
    message: 'Fuel Supply Tracking System API',
    version: '2.0.0',
    modules: {
      tracking: 'نظام تتبع الوقود',
      hr: 'نظام شؤون الموظفين',
      maintenance: 'نظام الصيانة'
    },
    endpoints: {
      tracking: '/api',
      hr: '/api/hr',
      docs: 'Coming soon...'
    }
  });
});

// ===============================
// HEALTH CHECK
// ===============================
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// ===============================
// ERROR HANDLER
// ===============================
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ===============================
// 404 HANDLER
// ===============================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`
  });
});

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 6030;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 HR System available at http://localhost:${PORT}/api/hr`);
  console.log(`📊 Tracking System available at http://localhost:${PORT}/api`);
});
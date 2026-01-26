const cron = require('node-cron');
const Maintenance = require('../models/Maintenance');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const { generateDailyChecks } = require('../utils/generateDailyChecks');

cron.schedule('0 0 1 * *', async () => {
  console.log('🔁 Monthly maintenance job started');

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const inspectionMonth = `${year}-${String(month).padStart(2, '0')}`;

  // مدير الصيانة
  const manager = await User.findOne({
    role: 'maintenance_car_management'
  }).select('_id name');

  // كل المركبات النشطة
  const vehicles = await Vehicle.find({ status: 'active' });

  for (const vehicle of vehicles) {
    const exists = await Maintenance.findOne({
      plateNumber: vehicle.plateNumber,
      inspectionMonth
    });

    if (exists) continue;

    await Maintenance.create({
      driverId: vehicle.driverId,
      driverName: vehicle.driverName,
      tankNumber: vehicle.tankNumber,
      plateNumber: vehicle.plateNumber,

      driverLicenseNumber: vehicle.driverLicenseNumber,
      driverLicenseExpiry: vehicle.driverLicenseExpiry,
      vehicleLicenseNumber: vehicle.vehicleLicenseNumber,
      vehicleLicenseExpiry: vehicle.vehicleLicenseExpiry,

      inspectionMonth,
      inspectionDate: new Date(),

      inspectedBy: manager?._id,
      inspectedByName: manager?.name || 'نظام الصيانة',

      dailyChecks: generateDailyChecks(year, month),

      totalDays: new Date(year, month, 0).getDate(),
      completedDays: 0,
      pendingDays: new Date(year, month, 0).getDate(),

      vehicleType: vehicle.vehicleType,
      fuelType: vehicle.fuelType,

      monthlyStatus: 'غير مكتمل',
      status: 'active'
    });

    console.log(`✅ Maintenance created → ${vehicle.plateNumber}`);
  }

  console.log('✅ Monthly maintenance job finished');
});

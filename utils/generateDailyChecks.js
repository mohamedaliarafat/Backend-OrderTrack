module.exports.generateDailyChecks = (year, month) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const checks = [];

  for (let day = 1; day <= daysInMonth; day++) {
    checks.push({
      date: new Date(year, month - 1, day),

      vehicleSafety: 'لم يتم',
      driverSafety: 'لم يتم',
      electricalMaintenance: 'لم يتم',
      mechanicalMaintenance: 'لم يتم',
      tankInspection: 'لم يتم',
      tiresInspection: 'لم يتم',
      brakesInspection: 'لم يتم',
      lightsInspection: 'لم يتم',
      fluidsCheck: 'لم يتم',
      emergencyEquipment: 'لم يتم',

      inspectionResult: 'pending',
      status: 'pending',
      supervisorAction: 'none',

      oilStatus: 'طبيعي'
    });
  }

  return checks;
};

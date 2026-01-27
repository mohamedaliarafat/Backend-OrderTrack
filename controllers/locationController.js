const Location = require('../models/Location');
const Employee = require('../models/Employee');

// إنشاء موقع جديد
exports.createLocation = async (req, res) => {
  try {
    const locationData = req.body;
    
    // توليد كود تلقائي إذا لم يتم توفيره
    if (!locationData.code) {
      const lastLocation = await Location.findOne().sort({ code: -1 });
      let newCode = 'LOC001';
      if (lastLocation && lastLocation.code) {
        const lastNum = parseInt(lastLocation.code.replace('LOC', ''));
        newCode = 'LOC' + String(lastNum + 1).padStart(3, '0');
      }
      locationData.code = newCode;
    }
    
    const location = new Location({
      ...locationData,
      createdBy: req.user._id
    });
    
    await location.save();
    
    res.status(201).json({
      success: true,
      message: 'تم إنشاء الموقع بنجاح',
      data: location
    });
  } catch (error) {
    console.error('Error creating location:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنشاء الموقع',
      error: error.message
    });
  }
};

// تحديث موقع
exports.updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const location = await Location.findById(id);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'الموقع غير موجود'
      });
    }
    
    Object.assign(location, updateData);
    location.updatedAt = new Date();
    
    await location.save();
    
    res.json({
      success: true,
      message: 'تم تحديث الموقع بنجاح',
      data: location
    });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث الموقع',
      error: error.message
    });
  }
};

// الحصول على جميع المواقع
exports.getAllLocations = async (req, res) => {
  try {
    const { isActive, type } = req.query;
    
    const query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (type) query.type = type;
    
    const locations = await Location.find(query)
      .populate('createdBy', 'name')
      .sort({ name: 1 });
    
    res.json({
      success: true,
      data: locations
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب المواقع',
      error: error.message
    });
  }
};

// الحصول على موظفي موقع محدد
exports.getLocationEmployees = async (req, res) => {
  try {
    const { id } = req.params;
    
    const location = await Location.findById(id);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'الموقع غير موجود'
      });
    }
    
    // البحث عن الموظفين المسموح لهم بالموقع
    const employees = await Employee.find({
      'allowedLocations.locationName': location.name,
      status: 'نشط'
    }).select('employeeId name department position allowedLocations');
    
    res.json({
      success: true,
      data: {
        location: {
          id: location._id,
          name: location.name,
          code: location.code,
          type: location.type,
          address: location.address,
          coordinates: location.coordinates,
          radius: location.radius,
          workingHours: location.workingHours
        },
        employees,
        count: employees.length
      }
    });
  } catch (error) {
    console.error('Error fetching location employees:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب موظفي الموقع',
      error: error.message
    });
  }
};

// التحقق من الموقع
exports.verifyLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const { employeeId } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'إحداثيات الموقع مطلوبة'
      });
    }
    
    const userLocation = { latitude: parseFloat(latitude), longitude: parseFloat(longitude) };
    let allowedLocations = [];
    
    if (employeeId) {
      // التحقق من موقع موظف محدد
      const employee = await Employee.findOne({ employeeId }).select('allowedLocations');
      if (employee) {
        allowedLocations = employee.allowedLocations;
      }
    } else {
      // الحصول على جميع المواقع النشطة
      const locations = await Location.find({ isActive: true });
      allowedLocations = locations.map(loc => ({
        locationName: loc.name,
        latitude: loc.coordinates.latitude,
        longitude: loc.coordinates.longitude,
        radius: loc.radius
      }));
    }
    
    // التحقق من وجود الموقع ضمن النطاق المسموح
    let isWithinAllowedLocation = false;
    let matchedLocation = null;
    let minDistance = Infinity;
    
    for (const loc of allowedLocations) {
      const distance = Math.sqrt(
        Math.pow(userLocation.latitude - loc.latitude, 2) +
        Math.pow(userLocation.longitude - loc.longitude, 2)
      ) * 111319.9; // تحويل الدرجات إلى أمتار تقريبياً
      
      if (distance <= loc.radius && distance < minDistance) {
        isWithinAllowedLocation = true;
        matchedLocation = {
          name: loc.locationName,
          distance: Math.round(distance),
          radius: loc.radius
        };
        minDistance = distance;
      }
    }
    
    res.json({
      success: true,
      data: {
        userLocation,
        isWithinAllowedLocation,
        matchedLocation,
        allowedLocations: allowedLocations.map(loc => ({
          name: loc.locationName,
          coordinates: { latitude: loc.latitude, longitude: loc.longitude },
          radius: loc.radius
        }))
      }
    });
    
  } catch (error) {
    console.error('Error verifying location:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في التحقق من الموقع',
      error: error.message
    });
  }
};

// تعطيل/تفعيل موقع
exports.toggleLocationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    const location = await Location.findById(id);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'الموقع غير موجود'
      });
    }
    
    location.isActive = isActive;
    location.updatedAt = new Date();
    
    await location.save();
    
    res.json({
      success: true,
      message: `تم ${isActive ? 'تفعيل' : 'تعطيل'} الموقع بنجاح`,
      data: location
    });
    
  } catch (error) {
    console.error('Error toggling location status:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تغيير حالة الموقع',
      error: error.message
    });
  }
};

// حذف موقع
exports.deleteLocation = async (req, res) => {
  try {
    const { id } = req.params;
    
    const location = await Location.findById(id);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'الموقع غير موجود'
      });
    }
    
    // التحقق من عدم وجود موظفين مرتبطين بالموقع
    const employeesWithLocation = await Employee.find({
      'allowedLocations.locationName': location.name
    });
    
    if (employeesWithLocation.length > 0) {
      return res.status(400).json({
        success: false,
        message: `لا يمكن حذف الموقع لأنه مرتبط بـ ${employeesWithLocation.length} موظف`,
        relatedEmployees: employeesWithLocation.map(emp => emp.employeeId)
      });
    }
    
    await Location.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: 'تم حذف الموقع بنجاح'
    });
    
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في حذف الموقع',
      error: error.message
    });
  }
};
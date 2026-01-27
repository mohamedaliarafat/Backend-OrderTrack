const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Location = require('../models/Location');

// إنشاء موظف جديد
exports.createEmployee = async (req, res) => {
  try {
    const employeeData = req.body;
    
    // توليد رقم موظف تلقائي
    if (!employeeData.employeeId) {
      const lastEmployee = await Employee.findOne().sort({ employeeId: -1 });
      let newId = 'EMP001';
      if (lastEmployee && lastEmployee.employeeId) {
        const lastNum = parseInt(lastEmployee.employeeId.replace('EMP', ''));
        newId = 'EMP' + String(lastNum + 1).padStart(3, '0');
      }
      employeeData.employeeId = newId;
    }
    
    const employee = new Employee({
      ...employeeData,
      createdBy: req.user._id
    });
    
    await employee.save();
    
    res.status(201).json({
      success: true,
      message: 'تم إنشاء الموظف بنجاح',
      data: employee
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنشاء الموظف',
      error: error.message
    });
  }
};

// تحديث بيانات الموظف
exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }
    
    // تحديث البيانات
    Object.assign(employee, updateData);
    employee.updatedBy = req.user._id;
    
    await employee.save();
    
    res.json({
      success: true,
      message: 'تم تحديث بيانات الموظف بنجاح',
      data: employee
    });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث الموظف',
      error: error.message
    });
  }
};

// تسجيل بصمة الموظف
exports.registerFingerprint = async (req, res) => {
  try {
    const { id } = req.params;
    const { fingerprintData } = req.body;
    
    if (!fingerprintData) {
      return res.status(400).json({
        success: false,
        message: 'بيانات البصمة مطلوبة'
      });
    }
    
    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }
    
    // التحقق من عدم تكرار البصمة
    const existingFingerprint = await Employee.findOne({
      fingerprintData,
      _id: { $ne: id }
    });
    
    if (existingFingerprint) {
      return res.status(400).json({
        success: false,
        message: 'البصمة مسجلة بالفعل لموظف آخر'
      });
    }
    
    employee.fingerprintData = fingerprintData;
    employee.fingerprintEnrolled = true;
    employee.fingerprintLastUpdate = new Date();
    
    await employee.save();
    
    res.json({
      success: true,
      message: 'تم تسجيل البصمة بنجاح',
      data: {
        employeeId: employee.employeeId,
        name: employee.name,
        fingerprintEnrolled: employee.fingerprintEnrolled
      }
    });
  } catch (error) {
    console.error('Error registering fingerprint:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تسجيل البصمة',
      error: error.message
    });
  }
};

// تعيين مواقع العمل للموظف
exports.assignLocations = async (req, res) => {
  try {
    const { id } = req.params;
    const { locationIds } = req.body;
    
    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }
    
    // الحصول على بيانات المواقع
    const locations = await Location.find({ _id: { $in: locationIds } });
    
    const allowedLocations = locations.map(loc => ({
      locationName: loc.name,
      latitude: loc.coordinates.latitude,
      longitude: loc.coordinates.longitude,
      radius: loc.radius
    }));
    
    employee.allowedLocations = allowedLocations;
    await employee.save();
    
    res.json({
      success: true,
      message: 'تم تعيين مواقع العمل بنجاح',
      data: {
        employeeId: employee.employeeId,
        name: employee.name,
        locations: allowedLocations
      }
    });
  } catch (error) {
    console.error('Error assigning locations:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تعيين المواقع',
      error: error.message
    });
  }
};

// الحصول على جميع الموظفين
exports.getAllEmployees = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      department,
      status,
      search
    } = req.query;
    
    const query = {};
    
    if (department) query.department = department;
    if (status) query.status = status;
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { nationalId: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    const employees = await Employee.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-fingerprintData'); // استبعاد بيانات البصمة لأسباب أمنية
    
    const total = await Employee.countDocuments(query);
    
    res.json({
      success: true,
      data: employees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب بيانات الموظفين',
      error: error.message
    });
  }
};

// الحصول على موظف محدد
exports.getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const employee = await Employee.findById(id).select('-fingerprintData');
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }
    
    // جلب سجل الحضور لآخر 7 أيام
    const recentAttendance = await Attendance.find({
      employeeId: employee._id,
      date: {
        $gte: new Date(new Date().setDate(new Date().getDate() - 7))
      }
    }).sort({ date: -1 });
    
    res.json({
      success: true,
      data: {
        ...employee.toObject(),
        recentAttendance
      }
    });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب بيانات الموظف',
      error: error.message
    });
  }
};

// تغيير حالة الموظف
exports.changeEmployeeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, terminationDate, terminationReason } = req.body;
    
    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }
    
    employee.status = status;
    if (terminationDate) employee.terminationDate = terminationDate;
    if (terminationReason) employee.terminationReason = terminationReason;
    
    await employee.save();
    
    res.json({
      success: true,
      message: `تم تغيير حالة الموظف إلى ${status}`,
      data: employee
    });
  } catch (error) {
    console.error('Error changing employee status:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تغيير حالة الموظف',
      error: error.message
    });
  }
};

// حذف موظف
exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    
    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }
    
    // التحقق من عدم وجود سجلات مرتبطة
    const hasAttendance = await Attendance.findOne({ employeeId: id });
    const hasSalary = await Salary.findOne({ employeeId: id });
    
    if (hasAttendance || hasSalary) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن حذف الموظف لأنه لديه سجلات مرتبطة'
      });
    }
    
    await Employee.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: 'تم حذف الموظف بنجاح'
    });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في حذف الموظف',
      error: error.message
    });
  }
};

// تصدير بيانات الموظفين
exports.exportEmployees = async (req, res) => {
  try {
    const employees = await Employee.find().select('-fingerprintData');
    
    // تحويل البيانات لصيغة Excel أو CSV
    const csvData = employees.map(emp => ({
      'رقم الموظف': emp.employeeId,
      'الاسم': emp.name,
      'الهوية الوطنية': emp.nationalId,
      'الجنسية': emp.nationality,
      'المدينة': emp.city,
      'القسم': emp.department,
      'الوظيفة': emp.position,
      'تاريخ التعيين': emp.hireDate,
      'تاريخ بداية العقد': emp.contractStartDate,
      'تاريخ نهاية العقد': emp.contractEndDate,
      'الراتب الأساسي': emp.basicSalary,
      'الحالة': emp.status
    }));
    
    res.json({
      success: true,
      data: csvData,
      message: 'بيانات جاهزة للتصدير'
    });
  } catch (error) {
    console.error('Error exporting employees:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تصدير البيانات',
      error: error.message
    });
  }
};
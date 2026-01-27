const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Location = require('../models/Location');
const geolib = require('geolib');

// تسجيل حضور/انصراف بالبصمة
exports.recordAttendance = async (req, res) => {
  try {
    const { fingerprintData, latitude, longitude, deviceId } = req.body;
    const type = req.query.type || 'checkin'; // checkin أو checkout
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // 1. البحث عن الموظف باستخدام البصمة
    const employee = await Employee.findOne({ fingerprintData });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'البصمة غير مسجلة',
        action: 'register'
      });
    }
    
    // 2. التحقق من حالة الموظف
    if (employee.status !== 'نشط') {
      return res.status(400).json({
        success: false,
        message: `الموظف ${employee.status}`,
        employeeName: employee.name,
        status: employee.status
      });
    }
    
    // 3. التحقق من الموقع
    let locationStatus = 'مسموح';
    let isOutsideLocation = false;
    
    if (latitude && longitude && employee.allowedLocations.length > 0) {
      const userLocation = { latitude, longitude };
      let withinAllowedLocation = false;
      
      for (const loc of employee.allowedLocations) {
        const distance = geolib.getDistance(
          userLocation,
          { latitude: loc.latitude, longitude: loc.longitude }
        );
        
        if (distance <= loc.radius) {
          withinAllowedLocation = true;
          break;
        }
      }
      
      if (!withinAllowedLocation) {
        locationStatus = 'خارج النطاق';
        isOutsideLocation = true;
        
        // إذا كان الحضور خارج الموقع
        if (type === 'checkin') {
          return res.status(403).json({
            success: false,
            message: 'يرجى التوجه إلى موقع العمل لتسجيل الحضور',
            employeeName: employee.name,
            locationStatus,
            allowedLocations: employee.allowedLocations
          });
        }
        // إذا كان الانصراف خارج الموقع مسموح به مع تحذير
        if (type === 'checkout') {
          locationStatus = 'خارج النطاق - مع تحذير';
        }
      }
    }
    
    // 4. البحث عن سجل الحضور لليوم
    let attendance = await Attendance.findOne({
      employeeId: employee._id,
      date: today
    });
    
    if (!attendance) {
      // إنشاء سجل جديد إذا لم يوجد
      attendance = new Attendance({
        employeeId: employee._id,
        date: today,
        status: 'حاضر'
      });
    }
    
    // 5. تسجيل الوقت
    if (type === 'checkin') {
      // منع تسجيل حضور مكرر
      if (attendance.checkIn && attendance.checkIn.time) {
        return res.status(400).json({
          success: false,
          message: 'تم تسجيل الحضور مسبقاً',
          checkInTime: attendance.checkIn.time
        });
      }
      
      attendance.checkIn = {
        time: now,
        location: latitude && longitude ? {
          latitude,
          longitude,
          address: 'موقع المستخدم'
        } : null,
        isOutsideLocation,
        locationStatus,
        deviceId,
        fingerprintMatchScore: 95 // قيمة افتراضية
      };
      
      // حساب التأخير
      const workStartTime = new Date(today);
      const [startHour, startMinute] = [8, 0]; // افتراضي 8:00 صباحاً
      workStartTime.setHours(startHour, startMinute, 0, 0);
      
      if (now > workStartTime) {
        const lateMinutes = Math.round((now - workStartTime) / (1000 * 60));
        attendance.checkIn.isLate = true;
        attendance.checkIn.lateMinutes = lateMinutes;
        
        if (lateMinutes > 30) {
          attendance.status = 'متأخر';
        }
      }
      
    } else if (type === 'checkout') {
      // التحقق من وجود حضور قبل الانصراف
      if (!attendance.checkIn || !attendance.checkIn.time) {
        return res.status(400).json({
          success: false,
          message: 'يجب تسجيل الحضور أولاً'
        });
      }
      
      // منع تسجيل انصراف مكرر
      if (attendance.checkOut && attendance.checkOut.time) {
        return res.status(400).json({
          success: false,
          message: 'تم تسجيل الانصراف مسبقاً',
          checkOutTime: attendance.checkOut.time
        });
      }
      
      attendance.checkOut = {
        time: now,
        location: latitude && longitude ? {
          latitude,
          longitude,
          address: 'موقع المستخدم'
        } : null,
        isOutsideLocation,
        deviceId,
        fingerprintMatchScore: 95
      };
      
      // حساب الانصراف المبكر
      const workEndTime = new Date(today);
      const [endHour, endMinute] = [17, 0]; // افتراضي 5:00 مساءً
      workEndTime.setHours(endHour, endMinute, 0, 0);
      
      if (now < workEndTime) {
        const earlyMinutes = Math.round((workEndTime - now) / (1000 * 60));
        attendance.checkOut.isEarly = true;
        attendance.checkOut.earlyMinutes = earlyMinutes;
        
        if (earlyMinutes > 30) {
          attendance.status = 'مبكر';
        }
      }
      
      // حساب ساعات العمل
      if (attendance.checkIn.time) {
        const hoursWorked = (now - attendance.checkIn.time) / (1000 * 60 * 60);
        attendance.totalHours = parseFloat(hoursWorked.toFixed(2));
        
        // حساب الوقت الإضافي
        const regularHours = 8; // 8 ساعات عمل عادية
        if (hoursWorked > regularHours) {
          attendance.overtimeHours = parseFloat((hoursWorked - regularHours).toFixed(2));
        }
      }
    }
    
    await attendance.save();
    
    res.json({
      success: true,
      message: type === 'checkin' ? 'تم تسجيل الحضور بنجاح' : 'تم تسجيل الانصراف بنجاح',
      data: {
        employeeId: employee.employeeId,
        employeeName: employee.name,
        time: now,
        locationStatus,
        attendanceId: attendance._id
      }
    });
    
  } catch (error) {
    console.error('Error recording attendance:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تسجيل الحضور',
      error: error.message
    });
  }
};

// تسجيل حضور يدوي (للمشرفين)
exports.manualAttendance = async (req, res) => {
  try {
    const { employeeId, date, checkInTime, checkOutTime, notes } = req.body;
    
    const employee = await Employee.findOne({ employeeId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }
    
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);
    
    let attendance = await Attendance.findOne({
      employeeId: employee._id,
      date: attendanceDate
    });
    
    if (!attendance) {
      attendance = new Attendance({
        employeeId: employee._id,
        date: attendanceDate,
        status: 'حاضر'
      });
    }
    
    if (checkInTime) {
      attendance.checkIn = {
        time: new Date(checkInTime),
        deviceId: 'manual',
        fingerprintMatchScore: 100
      };
    }
    
    if (checkOutTime) {
      attendance.checkOut = {
        time: new Date(checkOutTime),
        deviceId: 'manual',
        fingerprintMatchScore: 100
      };
      
      // حساب الساعات إذا كان هناك حضور وانصراف
      if (attendance.checkIn && attendance.checkOut) {
        const hoursWorked = (attendance.checkOut.time - attendance.checkIn.time) / (1000 * 60 * 60);
        attendance.totalHours = parseFloat(hoursWorked.toFixed(2));
      }
    }
    
    if (notes) attendance.notes = notes;
    attendance.updatedBy = req.user._id;
    
    await attendance.save();
    
    res.json({
      success: true,
      message: 'تم تسجيل الحضور يدوياً بنجاح',
      data: attendance
    });
    
  } catch (error) {
    console.error('Error in manual attendance:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في التسجيل اليدوي',
      error: error.message
    });
  }
};

// الحصول على سجلات الحضور
exports.getAttendanceRecords = async (req, res) => {
  try {
    const {
      employeeId,
      department,
      startDate,
      endDate,
      status,
      page = 1,
      limit = 50
    } = req.query;
    
    const query = {};
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      query.date = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.date = { $lte: new Date(endDate) };
    }
    
    if (status) query.status = status;
    
    if (employeeId) {
      const employee = await Employee.findOne({ employeeId });
      if (employee) {
        query.employeeId = employee._id;
      }
    }
    
    if (department) {
      const employees = await Employee.find({ department });
      const employeeIds = employees.map(emp => emp._id);
      query.employeeId = { $in: employeeIds };
    }
    
    const attendanceRecords = await Attendance.find(query)
      .populate('employeeId', 'employeeId name department position')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Attendance.countDocuments(query);
    
    // إحصائيات
    const stats = {
      totalRecords: total,
      present: await Attendance.countDocuments({ ...query, status: 'حاضر' }),
      late: await Attendance.countDocuments({ ...query, status: 'متأخر' }),
      absent: await Attendance.countDocuments({ ...query, status: 'غياب' }),
      leave: await Attendance.countDocuments({ ...query, status: 'إجازة' })
    };
    
    res.json({
      success: true,
      data: attendanceRecords,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب سجلات الحضور',
      error: error.message
    });
  }
};

// تقرير حضور الموظف
exports.getEmployeeAttendanceReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { month, year } = req.query;
    
    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }
    
    const reportMonth = month || new Date().getMonth() + 1;
    const reportYear = year || new Date().getFullYear();
    
    const startDate = new Date(reportYear, reportMonth - 1, 1);
    const endDate = new Date(reportYear, reportMonth, 0);
    
    const attendanceRecords = await Attendance.find({
      employeeId: employee._id,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });
    
    // حساب الإحصائيات
    const totalDays = endDate.getDate();
    const workingDays = attendanceRecords.length;
    const presentDays = attendanceRecords.filter(a => a.status === 'حاضر').length;
    const lateDays = attendanceRecords.filter(a => a.status === 'متأخر').length;
    const absentDays = attendanceRecords.filter(a => a.status === 'غياب').length;
    const leaveDays = attendanceRecords.filter(a => a.status === 'إجازة').length;
    
    const totalHours = attendanceRecords.reduce((sum, record) => 
      sum + (record.totalHours || 0), 0);
    const overtimeHours = attendanceRecords.reduce((sum, record) => 
      sum + (record.overtimeHours || 0), 0);
    
    res.json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          employeeId: employee.employeeId,
          name: employee.name,
          department: employee.department,
          position: employee.position
        },
        period: {
          month: reportMonth,
          year: reportYear,
          startDate,
          endDate
        },
        records: attendanceRecords,
        statistics: {
          totalDays,
          workingDays,
          presentDays,
          lateDays,
          absentDays,
          leaveDays,
          totalHours: parseFloat(totalHours.toFixed(2)),
          overtimeHours: parseFloat(overtimeHours.toFixed(2)),
          attendanceRate: ((presentDays / totalDays) * 100).toFixed(2) + '%'
        }
      }
    });
    
  } catch (error) {
    console.error('Error generating attendance report:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنشاء التقرير',
      error: error.message
    });
  }
};

// تحديث سجل حضور
exports.updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'سجل الحضور غير موجود'
      });
    }
    
    // تسجيل التعديل
    if (updateData.status && updateData.status !== attendance.status) {
      attendance.corrections.push({
        field: 'status',
        oldValue: attendance.status,
        newValue: updateData.status,
        changedBy: req.user._id,
        changedAt: new Date()
      });
    }
    
    Object.assign(attendance, updateData);
    attendance.updatedAt = new Date();
    
    await attendance.save();
    
    res.json({
      success: true,
      message: 'تم تحديث سجل الحضور بنجاح',
      data: attendance
    });
    
  } catch (error) {
    console.error('Error updating attendance:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث سجل الحضور',
      error: error.message
    });
  }
};

// تسجيل الإجازات
exports.recordLeave = async (req, res) => {
  try {
    const { employeeId, startDate, endDate, leaveType, notes } = req.body;
    
    const employee = await Employee.findOne({ employeeId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // إنشاء سجلات إجازة لكل يوم
    const leaveRecords = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const date = new Date(d);
      date.setHours(0, 0, 0, 0);
      
      let attendance = await Attendance.findOne({
        employeeId: employee._id,
        date: date
      });
      
      if (!attendance) {
        attendance = new Attendance({
          employeeId: employee._id,
          date: date,
          status: 'إجازة',
          notes: `${leaveType}: ${notes}`
        });
      } else {
        attendance.status = 'إجازة';
        attendance.notes = `${leaveType}: ${notes}`;
      }
      
      await attendance.save();
      leaveRecords.push(attendance);
    }
    
    res.json({
      success: true,
      message: `تم تسجيل إجازة من ${startDate} إلى ${endDate}`,
      data: leaveRecords
    });
    
  } catch (error) {
    console.error('Error recording leave:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تسجيل الإجازة',
      error: error.message
    });
  }
};
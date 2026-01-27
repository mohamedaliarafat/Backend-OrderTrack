const Salary = require('../models/Salary');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Advance = require('../models/Advance');
const Penalty = require('../models/Penalty');

// إنشاء كشف رواتب
exports.createSalarySheet = async (req, res) => {
  try {
    const { month, year, department } = req.body;
    
    // التحقق من عدم تكرار كشف الرواتب
    const existingSalary = await Salary.findOne({ month, year, department });
    if (existingSalary) {
      return res.status(400).json({
        success: false,
        message: `كشف رواتب ${month}/${year} لهذا القسم موجود مسبقاً`
      });
    }
    
    // الحصول على جميع الموظفين النشطين
    const query = { status: 'نشط' };
    if (department) query.department = department;
    
    const employees = await Employee.find(query);
    
    const salaryPromises = employees.map(async (employee) => {
      // حساب إجمالي الدخل
      const basicSalary = employee.basicSalary || 0;
      const housingAllowance = employee.housingAllowance || 0;
      const transportationAllowance = employee.transportationAllowance || 0;
      const otherAllowances = employee.otherAllowances || 0;
      
      // حساب الوقت الإضافي
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      
      const attendanceRecords = await Attendance.find({
        employeeId: employee._id,
        date: { $gte: startDate, $lte: endDate }
      });
      
      const overtimeHours = attendanceRecords.reduce((sum, record) => 
        sum + (record.overtimeHours || 0), 0);
      
      const overtimeRate = (basicSalary / (30 * 8)) * 1.5; // معدل الوقت الإضافي
      const overtimeAmount = overtimeHours * overtimeRate;
      
      const totalEarnings = basicSalary + housingAllowance + 
        transportationAllowance + otherAllowances + overtimeAmount;
      
      // حساب الخصومات
      const deductions = [];
      let totalDeductions = 0;
      
      // خصم السلف
      const advances = await Advance.find({
        employeeId: employee._id,
        status: { $in: ['قسط', 'مسدد'] },
        'repayments.status': 'مستحق',
        'repayments.month': month,
        'repayments.year': year
      });
      
      for (const advance of advances) {
        const installment = advance.repayments.find(
          r => r.month === month && r.year === year && r.status === 'مستحق'
        );
        
        if (installment) {
          deductions.push({
            type: 'سلف',
            description: `قسط سلفة - ${advance.reason}`,
            amount: installment.amount,
            reference: advance._id
          });
          totalDeductions += installment.amount;
        }
      }
      
      // خصم الجزاءات
      const penalties = await Penalty.find({
        employeeId: employee._id,
        status: 'مطبق',
        deducted: false
      });
      
      for (const penalty of penalties) {
        deductions.push({
          type: 'جزاءات',
          description: penalty.description,
          amount: penalty.amount,
          reference: penalty._id
        });
        totalDeductions += penalty.amount;
        
        // تحديث حالة الجزاء
        penalty.deducted = true;
        penalty.deductionMonth = month;
        penalty.deductionYear = year;
        await penalty.save();
      }
      
      const netSalary = totalEarnings - totalDeductions;
      
      // إنشاء كشف الراتب
      const salary = new Salary({
        employeeId: employee._id,
        month,
        year,
        basicSalary,
        housingAllowance,
        transportationAllowance,
        otherAllowances,
        overtimeAmount: parseFloat(overtimeAmount.toFixed(2)),
        bonuses: 0,
        incentives: 0,
        totalEarnings: parseFloat(totalEarnings.toFixed(2)),
        deductions,
        totalDeductions: parseFloat(totalDeductions.toFixed(2)),
        netSalary: parseFloat(netSalary.toFixed(2)),
        status: 'مسودة',
        preparedBy: req.user._id
      });
      
      return salary.save();
    });
    
    const salaries = await Promise.all(salaryPromises);
    
    res.status(201).json({
      success: true,
      message: `تم إنشاء كشف رواتب ${month}/${year}`,
      count: salaries.length,
      data: salaries
    });
    
  } catch (error) {
    console.error('Error creating salary sheet:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنشاء كشف الرواتب',
      error: error.message
    });
  }
};

// اعتماد كشف الرواتب
exports.approveSalarySheet = async (req, res) => {
  try {
    const { month, year, department } = req.body;
    
    const query = { month, year, status: 'مسودة' };
    if (department) query.department = department;
    
    // الحصول على الرواتب غير المعتمدة
    const salaries = await Salary.find(query);
    
    if (salaries.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'لا توجد رواتب مسودة للاعتماد'
      });
    }
    
    // اعتماد جميع الرواتب
    const updatePromises = salaries.map(salary => {
      salary.status = 'معتمد';
      salary.approvedBy = req.user._id;
      salary.approvedAt = new Date();
      return salary.save();
    });
    
    await Promise.all(updatePromises);
    
    res.json({
      success: true,
      message: `تم اعتماد ${salaries.length} كشف راتب`,
      count: salaries.length
    });
    
  } catch (error) {
    console.error('Error approving salary sheet:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في اعتماد كشف الرواتب',
      error: error.message
    });
  }
};

// دفع الرواتب
exports.paySalaries = async (req, res) => {
  try {
    const { salaryIds, paymentDate, paymentMethod } = req.body;
    
    const salaries = await Salary.find({
      _id: { $in: salaryIds },
      status: 'معتمد'
    });
    
    if (salaries.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'لا توجد رواتب معتمدة للدفع'
      });
    }
    
    const updatePromises = salaries.map(salary => {
      salary.status = 'مصرف';
      salary.paymentDate = new Date(paymentDate);
      salary.paymentMethod = paymentMethod;
      salary.paidBy = req.user._id;
      return salary.save();
    });
    
    await Promise.all(updatePromises);
    
    res.json({
      success: true,
      message: `تم دفع ${salaries.length} راتب`,
      count: salaries.length
    });
    
  } catch (error) {
    console.error('Error paying salaries:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في دفع الرواتب',
      error: error.message
    });
  }
};

// الحصول على كشوف الرواتب
exports.getSalarySheets = async (req, res) => {
  try {
    const {
      month,
      year,
      department,
      status,
      employeeId,
      page = 1,
      limit = 50
    } = req.query;
    
    const query = {};
    
    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    if (department) query.department = department;
    if (status) query.status = status;
    
    if (employeeId) {
      const employee = await Employee.findOne({ employeeId });
      if (employee) {
        query.employeeId = employee._id;
      }
    }
    
    const salaries = await Salary.find(query)
      .populate('employeeId', 'employeeId name department position')
      .populate('preparedBy', 'name')
      .populate('approvedBy', 'name')
      .populate('paidBy', 'name')
      .sort({ year: -1, month: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Salary.countDocuments(query);
    
    // إحصائيات
    const stats = {
      totalSalaries: total,
      totalAmount: await Salary.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: "$netSalary" } } }
      ]).then(result => result[0]?.total || 0),
      byStatus: await Salary.aggregate([
        { $match: query },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ])
    };
    
    res.json({
      success: true,
      data: salaries,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching salaries:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب كشوف الرواتب',
      error: error.message
    });
  }
};

// الحصول على كشف راتب موظف
exports.getEmployeeSalary = async (req, res) => {
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
    
    const query = { employeeId: employee._id };
    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    
    const salaries = await Salary.find(query)
      .populate('employeeId', 'employeeId name department position')
      .sort({ year: -1, month: -1 });
    
    res.json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          employeeId: employee.employeeId,
          name: employee.name,
          department: employee.department,
          position: employee.position,
          basicSalary: employee.basicSalary,
          allowances: {
            housing: employee.housingAllowance,
            transportation: employee.transportationAllowance,
            other: employee.otherAllowances
          }
        },
        salaries
      }
    });
    
  } catch (error) {
    console.error('Error fetching employee salary:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب كشف راتب الموظف',
      error: error.message
    });
  }
};

// تحديث كشف الراتب
exports.updateSalary = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const salary = await Salary.findById(id);
    if (!salary) {
      return res.status(404).json({
        success: false,
        message: 'كشف الراتب غير موجود'
      });
    }
    
    // منع تحديث الرواتب المصروفة
    if (salary.status === 'مصرف') {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن تحديث راتب تم صرفه'
      });
    }
    
    // تحديث الحقول المسموح بها
    const allowedUpdates = [
      'bonuses',
      'incentives',
      'deductions',
      'notes',
      'status'
    ];
    
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        salary[field] = updateData[field];
      }
    });
    
    // إعادة حساب الإجمالي إذا تم تحديث الحقول
    if (updateData.bonuses !== undefined || updateData.incentives !== undefined) {
      salary.totalEarnings = salary.basicSalary + salary.housingAllowance +
        salary.transportationAllowance + salary.otherAllowances +
        salary.overtimeAmount + (salary.bonuses || 0) + (salary.incentives || 0);
    }
    
    if (updateData.deductions !== undefined) {
      salary.totalDeductions = salary.deductions.reduce((sum, deduction) => 
        sum + deduction.amount, 0);
    }
    
    salary.netSalary = salary.totalEarnings - salary.totalDeductions;
    salary.updatedAt = new Date();
    
    await salary.save();
    
    res.json({
      success: true,
      message: 'تم تحديث كشف الراتب بنجاح',
      data: salary
    });
    
  } catch (error) {
    console.error('Error updating salary:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث كشف الراتب',
      error: error.message
    });
  }
};

// تصدير كشف الرواتب
exports.exportSalaries = async (req, res) => {
  try {
    const { month, year, department } = req.query;
    
    const query = {};
    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    if (department) query.department = department;
    
    const salaries = await Salary.find(query)
      .populate('employeeId', 'employeeId name bankName iban accountNumber');
    
    // تحويل البيانات لصيغة Excel
    const exportData = salaries.map(salary => ({
      'رقم الموظف': salary.employeeId.employeeId,
      'اسم الموظف': salary.employeeId.name,
      'الشهر': salary.month,
      'السنة': salary.year,
      'الراتب الأساسي': salary.basicSalary,
      'بدل السكن': salary.housingAllowance,
      'بدل المواصلات': salary.transportationAllowance,
      'بدلات أخرى': salary.otherAllowances,
      'وقت إضافي': salary.overtimeAmount,
      'مكافآت': salary.bonuses,
      'حوافز': salary.incentives,
      'إجمالي الدخل': salary.totalEarnings,
      'إجمالي الخصومات': salary.totalDeductions,
      'صافي الراتب': salary.netSalary,
      'اسم البنك': salary.employeeId.bankName,
      'رقم الآيبان': salary.employeeId.iban,
      'رقم الحساب': salary.employeeId.accountNumber,
      'حالة الراتب': salary.status
    }));
    
    res.json({
      success: true,
      data: exportData,
      message: 'بيانات جاهزة للتصدير'
    });
    
  } catch (error) {
    console.error('Error exporting salaries:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تصدير كشوف الرواتب',
      error: error.message
    });
  }
};
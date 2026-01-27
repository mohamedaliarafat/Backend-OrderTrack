const Advance = require('../models/Advance');
const Employee = require('../models/Employee');
const Salary = require('../models/Salary');

// طلب سلفة جديدة
exports.requestAdvance = async (req, res) => {
  try {
    const { employeeId, amount, reason, repaymentMonths } = req.body;
    
    const employee = await Employee.findOne({ employeeId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }
    
    // التحقق من حالة الموظف
    if (employee.status !== 'نشط') {
      return res.status(400).json({
        success: false,
        message: `الموظف ${employee.status} ولا يمكنه طلب سلفة`
      });
    }
    
    // حساب الحد الأقصى للسلفة (ثلاثة أضعاف الراتب)
    const maxAdvance = (employee.basicSalary || 0) * 3;
    if (amount > maxAdvance) {
      return res.status(400).json({
        success: false,
        message: `المبلغ يتجاوز الحد المسموح به (${maxAdvance})`
      });
    }
    
    // التحقق من وجود سلفة سابقة غير مسددة
    const existingAdvances = await Advance.find({
      employeeId: employee._id,
      status: { $in: ['قسط', 'متأخر'] }
    });
    
    const totalDue = existingAdvances.reduce((sum, adv) => 
      sum + (adv.remainingAmount || adv.amount), 0);
    
    if (totalDue > 0) {
      return res.status(400).json({
        success: false,
        message: `لديك سلفات مستحقة بقيمة ${totalDue} يجب سدادها أولاً`
      });
    }
    
    // حساب القسط الشهري
    const monthlyInstallment = amount / repaymentMonths;
    
    const advance = new Advance({
      employeeId: employee._id,
      amount,
      reason,
      repaymentMonths,
      monthlyInstallment: parseFloat(monthlyInstallment.toFixed(2)),
      remainingAmount: amount,
      status: 'معلق',
      createdBy: req.user._id
    });
    
    await advance.save();
    
    res.status(201).json({
      success: true,
      message: 'تم تقديم طلب السلفة بنجاح',
      data: advance
    });
    
  } catch (error) {
    console.error('Error requesting advance:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في طلب السلفة',
      error: error.message
    });
  }
};

// الموافقة على السلفة
exports.approveAdvance = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalNotes, paymentMethod } = req.body;
    
    const advance = await Advance.findById(id).populate('employeeId');
    if (!advance) {
      return res.status(404).json({
        success: false,
        message: 'طلب السلفة غير موجود'
      });
    }
    
    if (advance.status !== 'معلق') {
      return res.status(400).json({
        success: false,
        message: `طلب السلفة حالياً ${advance.status}`
      });
    }
    
    advance.status = 'معتمد';
    advance.approvedBy = req.user._id;
    advance.approvedAt = new Date();
    advance.approvalNotes = approvalNotes;
    advance.paymentMethod = paymentMethod;
    
    // إنشاء جدول التسديد
    const today = new Date();
    const repayments = [];
    
    for (let i = 1; i <= advance.repaymentMonths; i++) {
      const dueDate = new Date(today);
      dueDate.setMonth(dueDate.getMonth() + i);
      
      repayments.push({
        month: dueDate.getMonth() + 1,
        year: dueDate.getFullYear(),
        amount: advance.monthlyInstallment,
        status: 'مستحق',
        dueDate: new Date(dueDate.getFullYear(), dueDate.getMonth(), 1)
      });
    }
    
    advance.repayments = repayments;
    advance.nextDueDate = repayments[0]?.dueDate;
    
    await advance.save();
    
    res.json({
      success: true,
      message: 'تمت الموافقة على السلفة',
      data: advance
    });
    
  } catch (error) {
    console.error('Error approving advance:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الموافقة على السلفة',
      error: error.message
    });
  }
};

// رفض السلفة
exports.rejectAdvance = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    
    const advance = await Advance.findById(id);
    if (!advance) {
      return res.status(404).json({
        success: false,
        message: 'طلب السلفة غير موجود'
      });
    }
    
    if (advance.status !== 'معلق') {
      return res.status(400).json({
        success: false,
        message: `طلب السلفة حالياً ${advance.status}`
      });
    }
    
    advance.status = 'مرفوض';
    advance.approvalNotes = rejectionReason;
    advance.approvedBy = req.user._id;
    advance.approvedAt = new Date();
    
    await advance.save();
    
    res.json({
      success: true,
      message: 'تم رفض طلب السلفة',
      data: advance
    });
    
  } catch (error) {
    console.error('Error rejecting advance:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في رفض السلفة',
      error: error.message
    });
  }
};

// دفع السلفة
exports.payAdvance = async (req, res) => {
  try {
    const { id } = req.params;
    const { paidAt } = req.body;
    
    const advance = await Advance.findById(id).populate('employeeId');
    if (!advance) {
      return res.status(404).json({
        success: false,
        message: 'طلب السلفة غير موجود'
      });
    }
    
    if (advance.status !== 'معتمد') {
      return res.status(400).json({
        success: false,
        message: 'يجب اعتماد السلفة أولاً قبل الدفع'
      });
    }
    
    advance.status = 'مسدد';
    advance.paidAt = new Date(paidAt || Date.now());
    advance.paidBy = req.user._id;
    
    await advance.save();
    
    res.json({
      success: true,
      message: 'تم دفع السلفة بنجاح',
      data: advance
    });
    
  } catch (error) {
    console.error('Error paying advance:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في دفع السلفة',
      error: error.message
    });
  }
};

// تحديث حالة التسديد
exports.updateRepayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { repaymentId, status, salaryId } = req.body;
    
    const advance = await Advance.findById(id);
    if (!advance) {
      return res.status(404).json({
        success: false,
        message: 'طلب السلفة غير موجود'
      });
    }
    
    const repayment = advance.repayments.id(repaymentId);
    if (!repayment) {
      return res.status(404).json({
        success: false,
        message: 'قسط التسديد غير موجود'
      });
    }
    
    repayment.status = status;
    if (salaryId) repayment.salaryId = salaryId;
    if (status === 'مسدد') {
      repayment.paidAt = new Date();
    }
    
    // تحديث المبلغ المتبقي
    const remainingRepayments = advance.repayments.filter(r => r.status === 'مستحق');
    advance.remainingAmount = remainingRepayments.reduce((sum, r) => sum + r.amount, 0);
    
    // تحديث حالة السلفة
    if (advance.remainingAmount === 0) {
      advance.status = 'مسدد';
    } else {
      advance.status = 'قسط';
      advance.nextDueDate = remainingRepayments[0]?.dueDate;
    }
    
    await advance.save();
    
    res.json({
      success: true,
      message: 'تم تحديث حالة القسط',
      data: advance
    });
    
  } catch (error) {
    console.error('Error updating repayment:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث حالة التسديد',
      error: error.message
    });
  }
};

// الحصول على سلفات الموظف
exports.getEmployeeAdvances = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query;
    
    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }
    
    const query = { employeeId: employee._id };
    if (status) query.status = status;
    
    const advances = await Advance.find(query)
      .populate('employeeId', 'employeeId name department')
      .populate('approvedBy', 'name')
      .populate('paidBy', 'name')
      .populate('createdBy', 'name')
      .sort({ requestDate: -1 });
    
    // حساب الإحصائيات
    const totalAdvances = await Advance.countDocuments(query);
    const totalAmount = await Advance.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]).then(result => result[0]?.total || 0);
    
    const totalPaid = await Advance.aggregate([
      { $match: { ...query, status: 'مسدد' } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]).then(result => result[0]?.total || 0);
    
    const totalDue = await Advance.aggregate([
      { $match: { ...query, status: { $in: ['قسط', 'متأخر'] } } },
      { $group: { _id: null, total: { $sum: "$remainingAmount" } } }
    ]).then(result => result[0]?.total || 0);
    
    res.json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          employeeId: employee.employeeId,
          name: employee.name,
          department: employee.department,
          basicSalary: employee.basicSalary
        },
        advances,
        statistics: {
          totalAdvances,
          totalAmount,
          totalPaid,
          totalDue
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching employee advances:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب سلفات الموظف',
      error: error.message
    });
  }
};

// الحصول على جميع السلفات
exports.getAllAdvances = async (req, res) => {
  try {
    const {
      status,
      department,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;
    
    const query = {};
    
    if (status) query.status = status;
    if (startDate || endDate) {
      query.requestDate = {};
      if (startDate) query.requestDate.$gte = new Date(startDate);
      if (endDate) query.requestDate.$lte = new Date(endDate);
    }
    
    if (department) {
      const employees = await Employee.find({ department });
      const employeeIds = employees.map(emp => emp._id);
      query.employeeId = { $in: employeeIds };
    }
    
    const advances = await Advance.find(query)
      .populate('employeeId', 'employeeId name department position')
      .populate('approvedBy', 'name')
      .sort({ requestDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Advance.countDocuments(query);
    
    // إحصائيات
    const stats = {
      totalAdvances: total,
      pending: await Advance.countDocuments({ ...query, status: 'معلق' }),
      approved: await Advance.countDocuments({ ...query, status: 'معتمد' }),
      paid: await Advance.countDocuments({ ...query, status: 'مسدد' }),
      installment: await Advance.countDocuments({ ...query, status: 'قسط' }),
      overdue: await Advance.countDocuments({ ...query, status: 'متأخر' })
    };
    
    res.json({
      success: true,
      data: advances,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching advances:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب السلفات',
      error: error.message
    });
  }
};
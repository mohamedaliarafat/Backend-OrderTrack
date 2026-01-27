const Penalty = require('../models/Penalty');
const Employee = require('../models/Employee');

// إصدار جزاء جديد
exports.issuePenalty = async (req, res) => {
  try {
    const { employeeId, type, description, amount } = req.body;
    
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
        message: `الموظف ${employee.status} ولا يمكن إصدار جزاء له`
      });
    }
    
    const penalty = new Penalty({
      employeeId: employee._id,
      type,
      description,
      amount,
      status: 'معلق',
      issuedBy: req.user._id
    });
    
    await penalty.save();
    
    res.status(201).json({
      success: true,
      message: 'تم إصدار الجزاء بنجاح',
      data: penalty
    });
    
  } catch (error) {
    console.error('Error issuing penalty:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إصدار الجزاء',
      error: error.message
    });
  }
};

// الموافقة على الجزاء
exports.approvePenalty = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalNotes } = req.body;
    
    const penalty = await Penalty.findById(id).populate('employeeId');
    if (!penalty) {
      return res.status(404).json({
        success: false,
        message: 'الجزاء غير موجود'
      });
    }
    
    if (penalty.status !== 'معلق') {
      return res.status(400).json({
        success: false,
        message: `الجزاء حالياً ${penalty.status}`
      });
    }
    
    penalty.status = 'مطبق';
    penalty.approvedBy = req.user._id;
    penalty.approvedAt = new Date();
    penalty.approvalNotes = approvalNotes;
    
    await penalty.save();
    
    res.json({
      success: true,
      message: 'تمت الموافقة على الجزاء',
      data: penalty
    });
    
  } catch (error) {
    console.error('Error approving penalty:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الموافقة على الجزاء',
      error: error.message
    });
  }
};

// إلغاء الجزاء
exports.cancelPenalty = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellationReason } = req.body;
    
    const penalty = await Penalty.findById(id);
    if (!penalty) {
      return res.status(404).json({
        success: false,
        message: 'الجزاء غير موجود'
      });
    }
    
    if (penalty.status === 'ملغي' || penalty.status === 'مسترد') {
      return res.status(400).json({
        success: false,
        message: `الجزاء حالياً ${penalty.status}`
      });
    }
    
    penalty.status = 'ملغي';
    penalty.appeal = {
      requested: true,
      reason: cancellationReason,
      decision: 'ملغي',
      decidedBy: req.user._id,
      decidedAt: new Date()
    };
    
    await penalty.save();
    
    res.json({
      success: true,
      message: 'تم إلغاء الجزاء',
      data: penalty
    });
    
  } catch (error) {
    console.error('Error cancelling penalty:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إلغاء الجزاء',
      error: error.message
    });
  }
};

// استئناف الجزاء من قبل الموظف
exports.appealPenalty = async (req, res) => {
  try {
    const { id } = req.params;
    const { appealReason } = req.body;
    
    const penalty = await Penalty.findById(id);
    if (!penalty) {
      return res.status(404).json({
        success: false,
        message: 'الجزاء غير موجود'
      });
    }
    
    if (penalty.status !== 'مطبق') {
      return res.status(400).json({
        success: false,
        message: 'يمكن استئناف الجزاء المطبق فقط'
      });
    }
    
    penalty.appeal = {
      requested: true,
      reason: appealReason,
      decision: 'قيد المراجعة'
    };
    
    await penalty.save();
    
    res.json({
      success: true,
      message: 'تم تقديم الاستئناف بنجاح',
      data: penalty
    });
    
  } catch (error) {
    console.error('Error appealing penalty:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تقديم الاستئناف',
      error: error.message
    });
  }
};

// البت في الاستئناف
exports.decideAppeal = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, decisionNotes } = req.body;
    
    const penalty = await Penalty.findById(id);
    if (!penalty) {
      return res.status(404).json({
        success: false,
        message: 'الجزاء غير موجود'
      });
    }
    
    if (!penalty.appeal || !penalty.appeal.requested) {
      return res.status(400).json({
        success: false,
        message: 'لا يوجد استئناف مقدم'
      });
    }
    
    penalty.appeal.decision = decision;
    penalty.appeal.decisionNotes = decisionNotes;
    penalty.appeal.decidedBy = req.user._id;
    penalty.appeal.decidedAt = new Date();
    
    if (decision === 'مقبول') {
      penalty.status = 'مسترد';
    }
    
    await penalty.save();
    
    res.json({
      success: true,
      message: `تم البت في الاستئناف: ${decision}`,
      data: penalty
    });
    
  } catch (error) {
    console.error('Error deciding appeal:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في البت في الاستئناف',
      error: error.message
    });
  }
};

// الحصول على جزاءات الموظف
exports.getEmployeePenalties = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, type, startDate, endDate } = req.query;
    
    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }
    
    const query = { employeeId: employee._id };
    
    if (status) query.status = status;
    if (type) query.type = type;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    const penalties = await Penalty.find(query)
      .populate('employeeId', 'employeeId name department')
      .populate('issuedBy', 'name')
      .populate('approvedBy', 'name')
      .sort({ date: -1 });
    
    // حساب الإحصائيات
    const totalPenalties = penalties.length;
    const totalAmount = penalties.reduce((sum, penalty) => sum + penalty.amount, 0);
    const pendingAmount = penalties
      .filter(p => p.status === 'مطبق' && !p.deducted)
      .reduce((sum, penalty) => sum + penalty.amount, 0);
    
    res.json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          employeeId: employee.employeeId,
          name: employee.name,
          department: employee.department
        },
        penalties,
        statistics: {
          totalPenalties,
          totalAmount,
          pendingAmount,
          byStatus: penalties.reduce((acc, penalty) => {
            acc[penalty.status] = (acc[penalty.status] || 0) + 1;
            return acc;
          }, {}),
          byType: penalties.reduce((acc, penalty) => {
            acc[penalty.type] = (acc[penalty.type] || 0) + 1;
            return acc;
          }, {})
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching employee penalties:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب جزاءات الموظف',
      error: error.message
    });
  }
};

// الحصول على جميع الجزاءات
exports.getAllPenalties = async (req, res) => {
  try {
    const {
      status,
      type,
      department,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;
    
    const query = {};
    
    if (status) query.status = status;
    if (type) query.type = type;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    if (department) {
      const employees = await Employee.find({ department });
      const employeeIds = employees.map(emp => emp._id);
      query.employeeId = { $in: employeeIds };
    }
    
    const penalties = await Penalty.find(query)
      .populate('employeeId', 'employeeId name department position')
      .populate('issuedBy', 'name')
      .populate('approvedBy', 'name')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Penalty.countDocuments(query);
    
    // إحصائيات
    const stats = {
      totalPenalties: total,
      totalAmount: await Penalty.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]).then(result => result[0]?.total || 0),
      byStatus: await Penalty.aggregate([
        { $match: query },
        { $group: { _id: "$status", count: { $sum: 1 }, totalAmount: { $sum: "$amount" } } }
      ]),
      byType: await Penalty.aggregate([
        { $match: query },
        { $group: { _id: "$type", count: { $sum: 1 }, totalAmount: { $sum: "$amount" } } }
      ])
    };
    
    res.json({
      success: true,
      data: penalties,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching penalties:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الجزاءات',
      error: error.message
    });
  }
};
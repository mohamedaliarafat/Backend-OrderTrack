const Activity = require('../models/Activity');
const Order = require('../models/Order');

// Get all activities
exports.getActivities = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = {};
    
    if (req.query.orderId) {
      filter.orderId = req.query.orderId;
    }
    
    if (req.query.activityType) {
      filter.activityType = req.query.activityType;
    }
    
    if (req.query.userId) {
      filter.performedBy = req.query.userId;
    }

    const activities = await Activity.find(filter)
      .populate('performedBy', 'name email')
      .populate('orderId', 'orderNumber supplierName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Activity.countDocuments(filter);

    res.json({
      activities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Add manual activity
exports.addActivity = async (req, res) => {
  try {
    const { orderId, activityType, description } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    const activity = new Activity({
      orderId,
      activityType,
      description,
      performedBy: req.user._id,
      performedByName: req.user.name
    });

    await activity.save();

    res.status(201).json({
      message: 'تم إضافة الحركة بنجاح',
      activity
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};
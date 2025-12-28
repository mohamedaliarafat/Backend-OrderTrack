const Notification = require('../models/Notification');
const Order = require('../models/Order');
const User = require('../models/User');
const mongoose = require('mongoose');

// جلب إشعارات المستخدم
exports.getUserNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const notifications = await Notification.find({
      'recipients.user': req.user._id,
      expiresAt: { $gt: new Date() }
    })
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
    
    const total = await Notification.countDocuments({
      'recipients.user': req.user._id,
      expiresAt: { $gt: new Date() }
    });
    
    const unreadCount = await Notification.countDocuments({
      'recipients.user': req.user._id,
      'recipients.read': false,
      expiresAt: { $gt: new Date() }
    });
    
    res.json({
      notifications,
      unreadCount,
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

// تحديث حالة الإشعار كمقروء
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'الإشعار غير موجود' });
    }
    
    // تحديث حالة القراءة للمستخدم الحالي
    const recipientIndex = notification.recipients.findIndex(
      r => r.user.toString() === req.user._id.toString()
    );
    
    if (recipientIndex !== -1) {
      notification.recipients[recipientIndex].read = true;
      notification.recipients[recipientIndex].readAt = new Date();
      await notification.save();
    }
    
    res.json({
      message: 'تم تحديث حالة الإشعار',
      notification
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// تحديث جميع إشعارات المستخدم كمقروءة
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        'recipients.user': req.user._id,
        'recipients.read': false
      },
      {
        $set: {
          'recipients.$.read': true,
          'recipients.$.readAt': new Date()
        }
      }
    );
    
    res.json({
      message: 'تم تحديث جميع الإشعارات كمقروءة'
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// حذف الإشعار
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'الإشعار غير موجود' });
    }
    
    // إزالة المستخدم الحالي من قائمة المستلمين
    notification.recipients = notification.recipients.filter(
      r => r.user.toString() !== req.user._id.toString()
    );
    
    if (notification.recipients.length === 0) {
      await notification.deleteOne();
    } else {
      await notification.save();
    }
    
    res.json({
      message: 'تم حذف الإشعار'
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// إنشاء إشعار يدوي
exports.createNotification = async (req, res) => {
  try {
    const { type, title, message, data, recipients } = req.body;
    
    const notification = new Notification({
      type,
      title,
      message,
      data,
      recipients: recipients.map(userId => ({ user: userId })),
      createdBy: req.user._id
    });
    
    await notification.save();
    
    res.status(201).json({
      message: 'تم إنشاء الإشعار بنجاح',
      notification
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};
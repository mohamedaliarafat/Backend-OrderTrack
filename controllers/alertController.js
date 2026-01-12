const AlertNotification = require('../models/AlertNotification');

exports.getAlerts = async (req, res) => {
  try {
    const filters = {};
    if (req.query.stationId) filters.stationId = req.query.stationId;
    if (req.query.technicianId) filters.technicianId = req.query.technicianId;

    const alerts = await AlertNotification.find(filters).sort({ sentAt: -1 });
    res.json({ alerts });
  } catch (error) {
    res.status(500).json({ error: 'تعذر تحميل التنبيهات.', details: error.message });
  }
};

exports.createAlert = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'مستخدم غير مصرح.' });
    }

    const alert = new AlertNotification({
      alertType: req.body.alertType,
      priority: req.body.priority,
      target: req.body.target,
      technicianId: req.body.technicianId,
      technicianName: req.body.technicianName,
      stationId: req.body.stationId,
      stationName: req.body.stationName,
      title: req.body.title,
      message: req.body.message,
      sendEmail: req.body.sendEmail === 'true' || req.body.sendEmail === true,
      sendSMS: req.body.sendSMS === 'true' || req.body.sendSMS === true,
      sendPush: req.body.sendPush === 'true' || req.body.sendPush === true,
      status: req.body.status || 'جديد',
      sentBy: req.user._id,
      sentByName: req.user.name,
      sentAt: req.body.sentAt ? new Date(req.body.sentAt) : new Date(),
    });

    await alert.save();
    res.status(201).json({ alert });
  } catch (error) {
    res.status(500).json({ error: 'تعذر إرسال التنبيه.', details: error.message });
  }
};

const MaintenanceRecord = require('../models/MaintenanceRecord');

const parseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (_) {
      return [];
    }
  }
  return [];
};

const toDate = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

exports.getMaintenanceRecords = async (req, res) => {
  try {
    const filters = {};

    if (req.query.stationId) filters.stationId = req.query.stationId;
    if (req.query.status) filters.status = req.query.status;

    const records = await MaintenanceRecord.find(filters).sort({ createdAt: -1 });
    res.json({ records });
  } catch (error) {
    res.status(500).json({ error: 'تعذر تحميل سجلات الصيانة.', details: error.message });
  }
};

exports.createMaintenanceRecord = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'مستخدم غير مصرح.' });
    }

    const tasks = parseJsonArray(req.body.tasks).map((task) => ({
      taskName: task.taskName,
      description: task.description,
      status: task.status,
      technicianId: task.technicianId,
      technicianName: task.technicianName,
      startTime: toDate(task.startTime),
      endTime: toDate(task.endTime),
      estimatedHours: task.estimatedHours ?? 0,
      actualHours: task.actualHours ?? 0,
      notes: task.notes,
    }));

    const attachments = parseJsonArray(req.body.attachments).map((attachment) => ({
      filename: attachment.filename,
      path: attachment.path,
      fileType: attachment.fileType,
      uploadedBy: attachment.uploadedBy,
      uploadedByName: attachment.uploadedByName,
      uploadedAt: toDate(attachment.uploadedAt) || new Date(),
    }));

    const record = new MaintenanceRecord({
      stationId: req.body.stationId,
      stationName: req.body.stationName,
      maintenanceType: req.body.maintenanceType,
      priority: req.body.priority,
      status: req.body.status,
      description: req.body.description,
      technicianId: req.body.technicianId,
      technicianName: req.body.technicianName,
      scheduledDate: toDate(req.body.scheduledDate),
      completedDate: toDate(req.body.completedDate),
      estimatedCost: parseFloat(req.body.estimatedCost) || 0,
      actualCost: parseFloat(req.body.actualCost) || 0,
      tasks,
      attachments,
      notes: req.body.notes,
      createdBy: req.user._id,
      createdByName: req.user.name,
    });

    await record.save();
    res.status(201).json({ record });
  } catch (error) {
    res.status(500).json({ error: 'تعذر حفظ سجل الصيانة.', details: error.message });
  }
};

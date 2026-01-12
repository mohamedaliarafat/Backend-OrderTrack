const TechnicianReport = require('../models/TechnicianReport');

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

exports.getTechnicianReports = async (req, res) => {
  try {
    const filters = {};
    if (req.query.stationId) filters.stationId = req.query.stationId;
    if (req.query.technicianId) filters.technicianId = req.query.technicianId;

    const reports = await TechnicianReport.find(filters).sort({ createdAt: -1 });
    res.json({ reports });
  } catch (error) {
    res.status(500).json({ error: 'تعذر تحميل تقارير الفنيين.', details: error.message });
  }
};

exports.createTechnicianReport = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'مستخدم غير مصرح.' });
    }

    const issues = parseJsonArray(req.body.issues).map((issue) => ({
      issueType: issue.issueType,
      severity: issue.severity,
      description: issue.description,
      status: issue.status,
      discoveryDate: toDate(issue.discoveryDate),
      resolutionDate: toDate(issue.resolutionDate),
      resolutionNotes: issue.resolutionNotes,
    }));

    const attachments = (req.files || []).map((file) => ({
      filename: file.originalname,
      path: file.path,
      fileType: file.mimetype,
      uploadedBy: req.user._id,
      uploadedByName: req.user.name,
      uploadedAt: new Date(),
    }));

    const report = new TechnicianReport({
      stationId: req.body.stationId,
      stationName: req.body.stationName,
      technicianId: req.user._id,
      technicianName: req.user.name,
      reportType: req.body.reportType,
      reportTitle: req.body.reportTitle,
      description: req.body.description,
      issues,
      attachments,
      recommendations: req.body.recommendations,
      status: req.body.status || 'قيد المراجعة',
      reportDate: toDate(req.body.reportDate) || new Date(),
      approvalDate: toDate(req.body.approvalDate),
      approvedBy: req.body.approvedBy,
      approvedByName: req.body.approvedByName,
      approvalNotes: req.body.approvalNotes,
      createdBy: req.user._id,
      createdByName: req.user.name,
    });

    await report.save();
    res.status(201).json({ report });
  } catch (error) {
    res.status(500).json({ error: 'تعذر حفظ التقرير.', details: error.message });
  }
};

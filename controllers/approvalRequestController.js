const ApprovalRequest = require('../models/ApprovalRequest');

exports.getApprovalRequests = async (req, res) => {
  try {
    const filters = {};
    if (req.query.stationId) filters.stationId = req.query.stationId;
    if (req.query.status) filters.status = req.query.status;

    const requests = await ApprovalRequest.find(filters).sort({ requestedAt: -1 });
    res.json({ requests });
  } catch (error) {
    res.status(500).json({ error: 'تعذر تحميل طلبات الموافقة.', details: error.message });
  }
};

exports.createApprovalRequest = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'مستخدم غير مصرح.' });
    }

    const attachments = (req.files || []).map((file) => ({
      filename: file.originalname,
      path: file.path,
      fileType: file.mimetype,
      uploadedBy: req.user._id,
      uploadedByName: req.user.name,
      uploadedAt: new Date(),
    }));

    const request = new ApprovalRequest({
      requestType: req.body.requestType,
      stationId: req.body.stationId,
      stationName: req.body.stationName,
      title: req.body.title,
      description: req.body.description,
      amount: parseFloat(req.body.amount) || 0,
      currency: req.body.currency || 'SAR',
      attachments,
      status: req.body.status || 'قيد المراجعة',
      requestedBy: req.user._id,
      requestedByName: req.user.name,
      requestedAt: req.body.requestedAt ? new Date(req.body.requestedAt) : new Date(),
      reviewedBy: req.body.reviewedBy,
      reviewedByName: req.body.reviewedByName,
      reviewedAt: req.body.reviewedAt ? new Date(req.body.reviewedAt) : undefined,
      reviewNotes: req.body.reviewNotes,
      approvedBy: req.body.approvedBy,
      approvedByName: req.body.approvedByName,
      approvedAt: req.body.approvedAt ? new Date(req.body.approvedAt) : undefined,
      approvalNotes: req.body.approvalNotes,
    });

    await request.save();
    res.status(201).json({ request });
  } catch (error) {
    res.status(500).json({ error: 'تعذر إنشاء الطلب.', details: error.message });
  }
};

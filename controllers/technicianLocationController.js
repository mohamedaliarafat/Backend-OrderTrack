const TechnicianLocation = require('../models/TechnicianLocation');

exports.getTechnicianLocations = async (req, res) => {
  try {
    const filters = {};
    if (req.query.stationId) filters.stationId = req.query.stationId;

    const locations = await TechnicianLocation.find(filters).sort({ timestamp: -1 });
    res.json({ locations });
  } catch (error) {
    res.status(500).json({ error: 'تعذر تحميل مواقع الفنيين.', details: error.message });
  }
};

exports.createTechnicianLocation = async (req, res) => {
  try {
    const location = new TechnicianLocation({
      technicianId: req.body.technicianId,
      technicianName: req.body.technicianName,
      stationId: req.body.stationId,
      stationName: req.body.stationName,
      latitude: parseFloat(req.body.latitude) || 0,
      longitude: parseFloat(req.body.longitude) || 0,
      accuracy: parseFloat(req.body.accuracy) || 0,
      speed: parseFloat(req.body.speed) || 0,
      activity: req.body.activity,
      timestamp: req.body.timestamp ? new Date(req.body.timestamp) : new Date(),
      notes: req.body.notes,
    });

    await location.save();
    res.status(201).json({ location });
  } catch (error) {
    res.status(500).json({ error: 'تعذر حفظ الموقع.', details: error.message });
  }
};

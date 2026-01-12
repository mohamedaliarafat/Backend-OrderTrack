const mongoose = require('mongoose');

const technicianLocationSchema = new mongoose.Schema(
  {
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    technicianName: { type: String, trim: true },
    stationId: { type: String, trim: true },
    stationName: { type: String, trim: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number, default: 0 },
    speed: { type: Number, default: 0 },
    activity: { type: String, trim: true },
    timestamp: { type: Date, default: Date.now },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('TechnicianLocation', technicianLocationSchema);

// models/Device.js
const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  token: {
    type: String,
    required: true
  },
  platform: {
    type: String,
    enum: ["web", "android", "ios", "desktop"],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  }
});

deviceSchema.index({ user: 1, token: 1 }, { unique: true });

module.exports = mongoose.model("Device", deviceSchema);

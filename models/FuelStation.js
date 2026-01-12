const mongoose = require('mongoose');

const stationEquipmentSchema = new mongoose.Schema(
  {
    equipmentName: { type: String, required: true, trim: true },
    equipmentType: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    manufacturer: { type: String, trim: true },
    installationDate: Date,
    lastServiceDate: Date,
    nextServiceDate: Date,
    status: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { _id: false },
);

const stationFuelTypeSchema = new mongoose.Schema(
  {
    fuelName: { type: String, required: true, trim: true },
    pricePerLiter: { type: Number, default: 0 },
    availableQuantity: { type: Number, default: 0 },
    capacity: { type: Number, default: 0 },
    tankNumber: { type: String, trim: true },
    lastDeliveryDate: Date,
    nextDeliveryDate: Date,
    status: { type: String, trim: true },
  },
  { _id: false },
);

const stationAttachmentSchema = new mongoose.Schema(
  {
    filename: String,
    fileType: String,
    path: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedByName: String,
    uploadedAt: Date,
  },
  { _id: false },
);

const fuelStationSchema = new mongoose.Schema(
  {
    stationName: { type: String, required: true, trim: true },
    stationCode: { type: String, trim: true },
    address: { type: String, trim: true },
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    googleMapsLink: { type: String, trim: true },
    wazeLink: { type: String, trim: true },
    stationType: { type: String, trim: true },
    status: { type: String, trim: true },
    capacity: { type: Number, default: 0 },
    managerName: { type: String, trim: true },
    managerPhone: { type: String, trim: true },
    managerEmail: { type: String, trim: true },
    region: { type: String, trim: true },
    city: { type: String, trim: true },
    equipment: [stationEquipmentSchema],
    fuelTypes: [stationFuelTypeSchema],
    attachments: [stationAttachmentSchema],
    establishedDate: Date,
    lastMaintenanceDate: Date,
    nextMaintenanceDate: Date,
    totalTechnicians: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByName: { type: String, trim: true },
  },
  {
    timestamps: true,
  },
);

fuelStationSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('FuelStation', fuelStationSchema);

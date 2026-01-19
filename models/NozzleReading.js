const nozzleReadingSchema = new mongoose.Schema({
  pumpId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  pumpNumber: {
    type: String,
    required: true,
  },

  nozzleId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  nozzleNumber: {
    type: Number,
    required: true,
  },

  fuelType: {
    type: String,
    enum: ['بنزين 91', 'بنزين 95', 'ديزل', 'كيروسين'],
    required: true,
  },

  side: {
    type: String,
    enum: ['right', 'left'],
    required: true,
  },

  // Opening
  openingReading: {
    type: Number,
    required: true,
    min: 0,
  },
  openingImageUrl: String,
  openingTime: {
    type: Date,
    default: Date.now,
  },

  // Closing
  closingReading: Number,
  closingImageUrl: String,
  closingTime: Date,

  totalLiters: {
    type: Number,
    default: 0,
  },
  unitPrice: Number,
  totalAmount: {
    type: Number,
    default: 0,
  },

  notes: String,
});

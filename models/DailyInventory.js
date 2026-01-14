const mongoose = require('mongoose');

const dailyInventorySchema = new mongoose.Schema({
  stationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Station',
    required: true
  },
  stationName: {
    type: String,
    required: true
  },
  inventoryDate: {
    type: Date,
    required: true
  },
  arabicDate: {
    type: String
  },
  fuelType: {
    type: String,
    required: true,
    enum: ['بنزين 91', 'بنزين 95', 'ديزل', 'كيروسين']
  },
  // Opening balance from previous day
  previousBalance: {
    type: Number,
    required: true,
    min: 0
  },
  // Fuel received today
  receivedQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  tankerCount: {
    type: Number,
    default: 0
  },
  // Total sales from all pumps
  totalSales: {
    type: Number,
    default: 0,
    min: 0
  },
  pumpCount: {
    type: Number,
    default: 0
  },
  // Calculated balance
  calculatedBalance: {
    type: Number,
    min: 0
  },
  // Actual physical measurement
  actualBalance: {
    type: Number,
    min: 0
  },
  // Difference (shortage/excess)
  difference: {
    type: Number
  },
  differencePercentage: {
    type: Number
  },
  differenceReason: {
    type: String,
    enum: ['عادي', 'تهوية', 'تسريب', 'خطأ في القياس', 'أخرى']
  },
  // Expenses
  expenses: [{
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    description: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: ['مرتبات', 'صيانة', 'كهرباء', 'إيجار', 'أخرى']
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  totalExpenses: {
    type: Number,
    default: 0,
    min: 0
  },
  // Net revenue
  totalRevenue: {
    type: Number,
    default: 0,
    min: 0
  },
  netRevenue: {
    type: Number
  },
  // Status
  status: {
    type: String,
    enum: ['مسودة', 'مكتمل', 'معتمد', 'ملغى'],
    default: 'مسودة'
  },
  preparedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

dailyInventorySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate balance
  if (this.previousBalance !== undefined && this.receivedQuantity !== undefined && this.totalSales !== undefined) {
    this.calculatedBalance = this.previousBalance + this.receivedQuantity - this.totalSales;
  }
  
  // Calculate difference
  if (this.calculatedBalance !== undefined && this.actualBalance !== undefined) {
    this.difference = this.actualBalance - this.calculatedBalance;
    if (this.calculatedBalance > 0) {
      this.differencePercentage = (this.difference / this.calculatedBalance) * 100;
    }
  }
  
  // Calculate total expenses
  if (this.expenses && this.expenses.length > 0) {
    this.totalExpenses = this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  }
  
  // Calculate net revenue
  if (this.totalRevenue !== undefined && this.totalExpenses !== undefined) {
    this.netRevenue = this.totalRevenue - this.totalExpenses;
  }
  
  next();
});

module.exports = mongoose.model('DailyInventory', dailyInventorySchema);
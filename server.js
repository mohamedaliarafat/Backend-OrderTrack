const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const activityRoutes = require('./routes/activityRoutes');
const customerRoutes = require('./routes/customerRoutes'); 
const notificationRoutes = require('./routes/notificationRoutes');
const driverRoutes = require('./routes/driverRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const reportRoutes = require('./routes/reportRoutes');
const deviceRoutes = require('./routes/deviceRoutes');


// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database connection
mongoose.connect(process.env.MONGODB_URL || 'mongodb+srv://nasser66:Qwert1557@cluster0.odv4fdk.mongodb.net/', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/customers', customerRoutes); 
app.use('/api/notifications', notificationRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/devices', deviceRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Fuel Supply Tracking System API' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 6030;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
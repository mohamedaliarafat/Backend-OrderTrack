const Supplier = require('../models/Supplier');
const Activity = require('../models/Activity');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/supplier-documents/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'doc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم'));
    }
  }
}).fields([
  { name: 'documents', maxCount: 10 }
]);

exports.uploadMiddleware = upload;

// Create new supplier
exports.createSupplier = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      const supplierData = req.body;
      
      // Handle document uploads
      if (req.files && req.files.documents) {
        supplierData.documents = req.files.documents.map(file => ({
          filename: file.originalname,
          path: file.path,
          documentType: 'أخرى'
        }));
      }

      // Set createdBy
      supplierData.createdBy = req.user._id;

      // Parse dates
      if (supplierData.contractStartDate) {
        supplierData.contractStartDate = new Date(supplierData.contractStartDate);
      }
      if (supplierData.contractEndDate) {
        supplierData.contractEndDate = new Date(supplierData.contractEndDate);
      }

      // Check if supplier already exists
      const existingSupplier = await Supplier.findOne({ name: supplierData.name });
      if (existingSupplier) {
        return res.status(400).json({ error: 'المورد موجود بالفعل' });
      }

      // Create supplier
      const supplier = new Supplier(supplierData);
      await supplier.save();

      // Log activity
      const activity = new Activity({
        model: 'Supplier',
        modelId: supplier._id,
        activityType: 'إنشاء',
        description: `تم إنشاء مورد جديد: ${supplier.name}`,
        performedBy: req.user._id,
        performedByName: req.user.name,
        changes: {
          'الاسم': supplier.name,
          'الشركة': supplier.company,
          'جهة الاتصال': supplier.contactPerson
        }
      });
      await activity.save();

      res.status(201).json({
        message: 'تم إنشاء المورد بنجاح',
        supplier
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Get all suppliers with filtering and pagination
exports.getSuppliers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    
    if (req.query.name) {
      filter.name = new RegExp(req.query.name, 'i');
    }
    
    if (req.query.company) {
      filter.company = new RegExp(req.query.company, 'i');
    }
    
    if (req.query.supplierType) {
      filter.supplierType = req.query.supplierType;
    }
    
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }
    
    if (req.query.contactPerson) {
      filter.contactPerson = new RegExp(req.query.contactPerson, 'i');
    }

    // Get suppliers
    const suppliers = await Supplier.find(filter)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await Supplier.countDocuments(filter);

    // Get statistics
    const stats = await Supplier.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
          inactive: { $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] } },
          avgRating: { $avg: '$rating' }
        }
      }
    ]);

    res.json({
      suppliers,
      statistics: stats[0] || { total: 0, active: 0, inactive: 0, avgRating: 0 },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Get single supplier
exports.getSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    
    if (!supplier) {
      return res.status(404).json({ error: 'المورد غير موجود' });
    }

    // Get supplier's orders
    const orders = await Order.find({ supplierName: supplier.name })
      .select('orderNumber orderDate status loadingDate quantity')
      .sort({ orderDate: -1 })
      .limit(10);

    // Get supplier's activities
    const activities = await Activity.find({ 
      model: 'Supplier',
      modelId: supplier._id 
    })
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(20);

    // Get supplier statistics
    const orderStats = await Order.aggregate([
      { $match: { supplierName: supplier.name } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          avgRating: { $avg: '$rating' },
          byStatus: {
            $push: {
              status: '$status',
              count: 1
            }
          }
        }
      }
    ]);

    res.json({
      supplier,
      orders,
      activities,
      statistics: orderStats[0] || { totalOrders: 0, totalQuantity: 0, avgRating: 0, byStatus: [] }
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Update supplier
exports.updateSupplier = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      const supplier = await Supplier.findById(req.params.id);
      if (!supplier) {
        return res.status(404).json({ error: 'المورد غير موجود' });
      }

      // Track changes
      const oldData = { ...supplier.toObject() };
      const updates = req.body;

      // Handle document uploads
      if (req.files && req.files.documents) {
        const newDocuments = req.files.documents.map(file => ({
          filename: file.originalname,
          path: file.path,
          documentType: updates.documentType || 'أخرى'
        }));
        updates.documents = [...supplier.documents, ...newDocuments];
      }

      // Parse dates
      if (updates.contractStartDate) {
        updates.contractStartDate = new Date(updates.contractStartDate);
      }
      if (updates.contractEndDate) {
        updates.contractEndDate = new Date(updates.contractEndDate);
      }

      // Set updatedBy
      updates.updatedBy = req.user._id;

      // Update supplier
      Object.assign(supplier, updates);
      await supplier.save();

      // Log changes
      const changes = {};
      Object.keys(updates).forEach(key => {
        if (key !== 'documents' && oldData[key] !== updates[key]) {
          changes[key] = `من: ${oldData[key]} → إلى: ${updates[key]}`;
        }
      });

      if (Object.keys(changes).length > 0) {
        const activity = new Activity({
          model: 'Supplier',
          modelId: supplier._id,
          activityType: 'تعديل',
          description: `تم تعديل بيانات المورد: ${supplier.name}`,
          performedBy: req.user._id,
          performedByName: req.user.name,
          changes
        });
        await activity.save();
      }

      res.json({
        message: 'تم تحديث بيانات المورد بنجاح',
        supplier
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Delete supplier
exports.deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    
    if (!supplier) {
      return res.status(404).json({ error: 'المورد غير موجود' });
    }

    // Check if supplier has orders
    const hasOrders = await Order.exists({ supplierName: supplier.name });
    if (hasOrders) {
      return res.status(400).json({ 
        error: 'لا يمكن حذف المورد لأنه مرتبط بطلبات. يمكنك تعطيله بدلاً من ذلك.' 
      });
    }

    // Delete associated documents
    supplier.documents.forEach(document => {
      if (fs.existsSync(document.path)) {
        fs.unlinkSync(document.path);
      }
    });

    // Log activity before deleting
    const activity = new Activity({
      model: 'Supplier',
      modelId: supplier._id,
      activityType: 'حذف',
      description: `تم حذف المورد: ${supplier.name}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'الاسم': supplier.name,
        'الشركة': supplier.company
      }
    });
    await activity.save();

    // Delete supplier
    await Supplier.findByIdAndDelete(req.params.id);

    res.json({
      message: 'تم حذف المورد بنجاح'
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Delete supplier document
exports.deleteDocument = async (req, res) => {
  try {
    const { supplierId, documentId } = req.params;
    
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      return res.status(404).json({ error: 'المورد غير موجود' });
    }

    const document = supplier.documents.id(documentId);
    if (!document) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }

    // Delete file from server
    if (fs.existsSync(document.path)) {
      fs.unlinkSync(document.path);
    }

    // Remove from array
    supplier.documents.pull(documentId);
    supplier.updatedBy = req.user._id;
    await supplier.save();

    res.json({
      message: 'تم حذف الملف بنجاح'
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Get suppliers statistics
exports.getSuppliersStatistics = async (req, res) => {
  try {
    const stats = await Supplier.aggregate([
      {
        $group: {
          _id: '$supplierType',
          count: { $sum: 1 },
          avgRating: { $avg: '$rating' }
        }
      },
      {
        $project: {
          type: '$_id',
          count: 1,
          avgRating: { $round: ['$avgRating', 2] }
        }
      }
    ]);

    const totalStats = await Supplier.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
          inactive: { $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] } },
          avgRating: { $avg: '$rating' }
        }
      }
    ]);

    res.json({
      byType: stats,
      total: totalStats[0] || { total: 0, active: 0, inactive: 0, avgRating: 0 }
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};

// Search suppliers
exports.searchSuppliers = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.json({ suppliers: [] });
    }

    const suppliers = await Supplier.find({
      $or: [
        { name: new RegExp(query, 'i') },
        { company: new RegExp(query, 'i') },
        { contactPerson: new RegExp(query, 'i') },
        { phone: new RegExp(query, 'i') },
        { email: new RegExp(query, 'i') }
      ],
      isActive: true
    })
    .select('name company contactPerson phone email supplierType rating')
    .limit(20)
    .sort({ name: 1 });

    res.json({ suppliers });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
};
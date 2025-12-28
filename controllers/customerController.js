const Customer = require('../models/Customer');
const Activity = require('../models/Activity');
const mongoose = require('mongoose');

// ===============================
// إنشاء عميل جديد
// ===============================
exports.createCustomer = async (req, res) => {
  try {
    // ✅ تأكد من المستخدم
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: 'غير مصرح' });
    }

    const {
      name,
      phone,
      email,
      address,
      contactPerson,
      contactPersonPhone,
      notes,
      code: providedCode,
    } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'اسم العميل مطلوب' });
    }

    // ✅ توليد الكود
    let code = providedCode;
    if (!code || code.trim().isEmpty) {
      code = await generateCustomerCode(name);
    }

    // ✅ تأكد من عدم التكرار
    const existingCustomer = await Customer.findOne({ code });
    if (existingCustomer) {
      return res.status(400).json({ error: 'كود العميل موجود بالفعل' });
    }

    const customer = new Customer({
      name: name.trim(),
      code,
      phone,
      email,
      address,
      contactPerson,
      contactPersonPhone,
      notes,
      createdBy: req.user._id,
    });

    await customer.save();

    // ✅ تسجيل النشاط
    await Activity.create({
      activityType: 'إنشاء',
      description: `تم إنشاء عميل جديد: ${customer.name} (${customer.code})`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: {
        'اسم العميل': customer.name,
        'كود العميل': customer.code,
      },
    });

    res.status(201).json({
      message: 'تم إنشاء العميل بنجاح',
      customer,
    });
  } catch (error) {
    console.error('CREATE CUSTOMER ERROR:', error);
    res.status(500).json({
      error: error.message || 'حدث خطأ في السيرفر',
    });
  }
};

// ===============================
// توليد كود العميل (آمن)
// ===============================
const generateCustomerCode = async (name) => {
  const safeName = name.replace(/\s+/g, '').toUpperCase();
  const prefix = safeName.substring(0, 3).padEnd(3, 'X');

  let counter = 1;
  let code;

  do {
    code = `${prefix}${counter.toString().padStart(3, '0')}`;
    counter++;
  } while (await Customer.exists({ code }));

  return code;
};

// ===============================
// جلب جميع العملاء
// ===============================
exports.getCustomers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { isActive: true };

    if (req.query.search) {
      filter.$or = [
        { name: new RegExp(req.query.search, 'i') },
        { code: new RegExp(req.query.search, 'i') },
        { phone: new RegExp(req.query.search, 'i') },
      ];
    }

    const customers = await Customer.find(filter)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Customer.countDocuments(filter);

    res.json({
      customers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('GET CUSTOMERS ERROR:', error);
    res.status(500).json({ error: error.message });
  }
};

// ===============================
// جلب عميل محدد
// ===============================
exports.getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('createdBy', 'name');

    if (!customer) {
      return res.status(404).json({ error: 'العميل غير موجود' });
    }

    const Order = require('../models/Order');
    const orders = await Order.find({ customer: customer._id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ customer, recentOrders: orders });
  } catch (error) {
    console.error('GET CUSTOMER ERROR:', error);
    res.status(500).json({ error: error.message });
  }
};

// ===============================
// تحديث العميل
// ===============================
exports.updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'العميل غير موجود' });
    }

    if (req.body.code && req.body.code !== customer.code) {
      const exists = await Customer.findOne({ code: req.body.code });
      if (exists) {
        return res.status(400).json({ error: 'كود العميل موجود بالفعل' });
      }
    }

    Object.assign(customer, req.body);
    await customer.save();

    await Activity.create({
      activityType: 'تعديل',
      description: `تم تعديل بيانات العميل: ${customer.name}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      changes: req.body,
    });

    res.json({
      message: 'تم تحديث بيانات العميل بنجاح',
      customer,
    });
  } catch (error) {
    console.error('UPDATE CUSTOMER ERROR:', error);
    res.status(500).json({ error: error.message });
  }
};

// ===============================
// تعطيل العميل
// ===============================
exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'العميل غير موجود' });
    }

    customer.isActive = false;
    await customer.save();

    await Activity.create({
      activityType: 'حذف',
      description: `تم تعطيل العميل: ${customer.name} (${customer.code})`,
      performedBy: req.user._id,
      performedByName: req.user.name,
    });

    res.json({ message: 'تم تعطيل العميل بنجاح' });
  } catch (error) {
    console.error('DELETE CUSTOMER ERROR:', error);
    res.status(500).json({ error: error.message });
  }
};

// ===============================
// البحث (Autocomplete)
// ===============================
exports.searchCustomers = async (req, res) => {
  try {
    const q = req.query.q || '';
    const customers = await Customer.find({
      isActive: true,
      $or: [
        { name: new RegExp(q, 'i') },
        { code: new RegExp(q, 'i') },
      ],
    })
      .select('_id name code phone')
      .limit(10);

    res.json(customers);
  } catch (error) {
    console.error('SEARCH CUSTOMER ERROR:', error);
    res.status(500).json({ error: error.message });
  }
};

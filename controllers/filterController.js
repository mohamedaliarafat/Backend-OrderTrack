const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Driver = require('../models/Driver');

// ============================================
// 🔍 الحصول على خيارات الفلاتر
// ============================================

exports.getFilterOptions = async (req, res) => {
  try {
    // الحصول على جميع الخيارات المتاحة
    const [
      statuses,
      cities,
      areas,
      productTypes,
      fuelTypes,
      paymentStatuses,
      orderSources,
      mergeStatuses
    ] = await Promise.all([
      // الحالات المتاحة
      Order.distinct('status'),
      
      // المدن والمناطق
      Order.distinct('city'),
      Order.distinct('area'),
      
      // أنواع المنتجات والوقود
      Order.distinct('productType'),
      Order.distinct('fuelType'),
      
      // حالات الدفع
      Order.distinct('paymentStatus'),
      
      // مصادر الطلبات
      Order.distinct('orderSource'),
      
      // حالات الدمج
      Order.distinct('mergeStatus')
    ]);

    // الحصول على العملاء النشطين
    const customers = await Customer.find({ isActive: true })
      .select('_id name code phone city area')
      .limit(100)
      .sort({ name: 1 });

    // الحصول على الموردين النشطين
    const suppliers = await Supplier.find({ isActive: true })
      .select('_id name company contactPerson phone city')
      .limit(100)
      .sort({ name: 1 });

    // الحصول على السائقين النشطين
    const drivers = await Driver.find({ status: 'نشط' })
      .select('_id name licenseNumber phone vehicleType vehicleNumber')
      .limit(100)
      .sort({ name: 1 });

    res.json({
      success: true,
      data: {
        // قوائم الخيارات
        statuses: statuses.filter(s => s).sort(),
        cities: cities.filter(c => c).sort(),
        areas: areas.filter(a => a).sort(),
        productTypes: productTypes.filter(p => p).sort(),
        fuelTypes: fuelTypes.filter(f => f).sort(),
        paymentStatuses: paymentStatuses.filter(p => p).sort(),
        orderSources: orderSources.filter(o => o).sort(),
        mergeStatuses: mergeStatuses.filter(m => m).sort(),
        
        // قوائم الكيانات
        customers: customers.map(c => ({
          value: c._id,
          label: `${c.name} (${c.code})`,
          phone: c.phone,
          city: c.city,
          area: c.area
        })),
        
        suppliers: suppliers.map(s => ({
          value: s._id,
          label: `${s.name} - ${s.company}`,
          contactPerson: s.contactPerson,
          phone: s.phone,
          city: s.city
        })),
        
        drivers: drivers.map(d => ({
          value: d._id,
          label: `${d.name} (${d.licenseNumber})`,
          phone: d.phone,
          vehicleType: d.vehicleType,
          vehicleNumber: d.vehicleNumber
        })),

        // نطاقات التواريخ
        dateRanges: {
          today: 'اليوم',
          yesterday: 'أمس',
          last7days: 'آخر 7 أيام',
          last30days: 'آخر 30 يوم',
          thisMonth: 'هذا الشهر',
          lastMonth: 'الشهر الماضي',
          thisYear: 'هذه السنة',
          custom: 'مخصص'
        },

        // نطاقات المبالغ
        amountRanges: [
          { label: 'أقل من 1,000', min: 0, max: 1000 },
          { label: '1,000 - 5,000', min: 1000, max: 5000 },
          { label: '5,000 - 10,000', min: 5000, max: 10000 },
          { label: '10,000 - 50,000', min: 10000, max: 50000 },
          { label: 'أكثر من 50,000', min: 50000, max: 1000000 }
        ],

        // خيارات التصنيف
        sortOptions: [
          { value: 'orderDate', label: 'تاريخ الطلب' },
          { value: 'loadingDate', label: 'تاريخ التحميل' },
          { value: 'arrivalDate', label: 'تاريخ الوصول' },
          { value: 'totalPrice', label: 'المبلغ الإجمالي' },
          { value: 'quantity', label: 'الكمية' },
          { value: 'createdAt', label: 'تاريخ الإنشاء' },
          { value: 'updatedAt', label: 'تاريخ التحديث' }
        ],

        // اتجاهات التصنيف
        sortOrders: [
          { value: 'desc', label: 'تنازلي (الأحدث أولاً)' },
          { value: 'asc', label: 'تصاعدي (الأقدم أولاً)' }
        ]
      }
    });
  } catch (error) {
    console.error('Get filter options error:', error);
    res.status(500).json({ success: false, error: 'حدث خطأ في جلب خيارات الفلترة' });
  }
};

// ============================================
// 🔄 البحث الذكي
// ============================================

exports.smartSearch = async (req, res) => {
  try {
    const { q, type = 'all', limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ success: true, results: [] });
    }

    const searchRegex = new RegExp(q, 'i');
    const results = [];

    // بحث في الطلبات
    if (type === 'all' || type === 'orders') {
      const orders = await Order.find({
        $or: [
          { orderNumber: searchRegex },
          { customerName: searchRegex },
          { supplierName: searchRegex },
          { driverName: searchRegex }
        ]
      })
      .select('orderNumber orderSource customerName supplierName status orderDate totalPrice')
      .limit(limit)
      .sort({ orderDate: -1 });

      orders.forEach(order => {
        results.push({
          type: 'order',
          id: order._id,
          title: `طلب ${order.orderNumber}`,
          subtitle: `${order.customerName || order.supplierName} - ${order.status}`,
          details: {
            orderNumber: order.orderNumber,
            source: order.orderSource,
            date: order.orderDate,
            amount: order.totalPrice,
            status: order.status
          }
        });
      });
    }

    // بحث في العملاء
    if (type === 'all' || type === 'customers') {
      const customers = await Customer.find({
        $or: [
          { name: searchRegex },
          { code: searchRegex },
          { phone: searchRegex }
        ],
        isActive: true
      })
      .select('name code phone city area')
      .limit(limit)
      .sort({ name: 1 });

      customers.forEach(customer => {
        results.push({
          type: 'customer',
          id: customer._id,
          title: customer.name,
          subtitle: `${customer.code} - ${customer.city || ''}`,
          details: {
            code: customer.code,
            phone: customer.phone,
            city: customer.city,
            area: customer.area
          }
        });
      });
    }

    // بحث في الموردين
    if (type === 'all' || type === 'suppliers') {
      const suppliers = await Supplier.find({
        $or: [
          { name: searchRegex },
          { company: searchRegex },
          { contactPerson: searchRegex },
          { phone: searchRegex }
        ],
        isActive: true
      })
      .select('name company contactPerson phone city supplierType')
      .limit(limit)
      .sort({ name: 1 });

      suppliers.forEach(supplier => {
        results.push({
          type: 'supplier',
          id: supplier._id,
          title: `${supplier.name} - ${supplier.company}`,
          subtitle: supplier.contactPerson,
          details: {
            company: supplier.company,
            contactPerson: supplier.contactPerson,
            phone: supplier.phone,
            type: supplier.supplierType
          }
        });
      });
    }

    // بحث في السائقين
    if (type === 'all' || type === 'drivers') {
      const drivers = await Driver.find({
        $or: [
          { name: searchRegex },
          { licenseNumber: searchRegex },
          { phone: searchRegex },
          { vehicleNumber: searchRegex }
        ],
        status: { $in: ['نشط', 'في إجازة'] }
      })
      .select('name licenseNumber phone vehicleType vehicleNumber')
      .limit(limit)
      .sort({ name: 1 });

      drivers.forEach(driver => {
        results.push({
          type: 'driver',
          id: driver._id,
          title: driver.name,
          subtitle: `${driver.licenseNumber} - ${driver.vehicleNumber || ''}`,
          details: {
            licenseNumber: driver.licenseNumber,
            phone: driver.phone,
            vehicleType: driver.vehicleType,
            vehicleNumber: driver.vehicleNumber
          }
        });
      });
    }

    res.json({
      success: true,
      query: q,
      type,
      count: results.length,
      results
    });
  } catch (error) {
    console.error('Smart search error:', error);
    res.status(500).json({ success: false, error: 'حدث خطأ في البحث' });
  }
};

// ============================================
// 📊 إحصائيات الفلاتر
// ============================================

exports.getFilterStats = async (req, res) => {
  try {
    const { filters } = req.body;

    // بناء فلتر من المدخلات
    const filter = {};
    
    if (filters) {
      // معالجة الفلاتر النصية
      if (filters.search) {
        const searchRegex = new RegExp(filters.search, 'i');
        filter.$or = [
          { orderNumber: searchRegex },
          { customerName: searchRegex },
          { supplierName: searchRegex },
          { driverName: searchRegex }
        ];
      }

      // معالجة فلاتر التاريخ
      if (filters.dateRange) {
        const { field, start, end } = filters.dateRange;
        if (field && start && end) {
          filter[field] = {
            $gte: new Date(start),
            $lte: new Date(end)
          };
        }
      }

      // معالجة الفلاتر الأخرى
      const simpleFilters = ['status', 'city', 'area', 'productType', 'fuelType', 
                            'paymentStatus', 'orderSource', 'mergeStatus'];
      
      simpleFilters.forEach(key => {
        if (filters[key]) {
          filter[key] = filters[key];
        }
      });

      // معالجة فلاتر الكيانات
      if (filters.customerId) {
        filter.customer = filters.customerId;
      }
      if (filters.supplierId) {
        filter.supplier = filters.supplierId;
      }
      if (filters.driverId) {
        filter.driver = filters.driverId;
      }

      // معالجة نطاق المبلغ
      if (filters.amountRange) {
        const { min, max } = filters.amountRange;
        filter.totalPrice = {};
        if (min !== undefined) filter.totalPrice.$gte = parseFloat(min);
        if (max !== undefined) filter.totalPrice.$lte = parseFloat(max);
      }
    }

    // حساب الإحصائيات
    const stats = await Order.aggregate([
      { $match: filter },
      {
        $facet: {
          // الإحصائيات الأساسية
          basicStats: [
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalQuantity: { $sum: '$quantity' },
                totalAmount: { $sum: '$totalPrice' },
                avgAmount: { $avg: '$totalPrice' },
                minAmount: { $min: '$totalPrice' },
                maxAmount: { $max: '$totalPrice' }
              }
            }
          ],
          
          // الإحصائيات حسب الحالة
          statusStats: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalAmount: { $sum: '$totalPrice' },
                avgAmount: { $avg: '$totalPrice' }
              }
            },
            { $sort: { count: -1 } }
          ],
          
          // الإحصائيات حسب المصدر
          sourceStats: [
            {
              $group: {
                _id: '$orderSource',
                count: { $sum: 1 },
                totalAmount: { $sum: '$totalPrice' }
              }
            }
          ],
          
          // الإحصائيات حسب المدينة
          cityStats: [
            {
              $group: {
                _id: '$city',
                count: { $sum: 1 },
                totalAmount: { $sum: '$totalPrice' }
              }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ],
          
          // الإحصائيات حسب الشهر
          monthlyStats: [
            {
              $group: {
                _id: {
                  year: { $year: '$orderDate' },
                  month: { $month: '$orderDate' }
                },
                count: { $sum: 1 },
                totalAmount: { $sum: '$totalPrice' }
              }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 }
          ]
        }
      }
    ]);

    // حساب النسب المئوية
    const basicStats = stats[0]?.basicStats[0] || {};
    const statusStats = stats[0]?.statusStats || [];
    
    const enhancedStatusStats = statusStats.map(stat => ({
      ...stat,
      percentage: basicStats.totalOrders > 0 ? 
        ((stat.count / basicStats.totalOrders) * 100).toFixed(1) : 0
    }));

    res.json({
      success: true,
      filters,
      statistics: {
        basic: basicStats,
        byStatus: enhancedStatusStats,
        bySource: stats[0]?.sourceStats || [],
        byCity: stats[0]?.cityStats || [],
        byMonth: stats[0]?.monthlyStats || []
      },
      summary: {
        totalOrders: basicStats.totalOrders || 0,
        totalAmount: basicStats.totalAmount || 0,
        avgOrderValue: basicStats.avgAmount || 0,
        statusDistribution: enhancedStatusStats.reduce((acc, stat) => {
          acc[stat._id] = stat.percentage;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Filter stats error:', error);
    res.status(500).json({ success: false, error: 'حدث خطأ في حساب الإحصائيات' });
  }
};
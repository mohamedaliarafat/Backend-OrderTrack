const Order = require('../models/Order');
const User = require('../models/User');
const mongoose = require('mongoose');

exports.getCustomerReportData = async (filters) => {
  const customers = await Order.aggregate([
    { $match: {} },
    {
      $group: {
        _id: '$customer',
        customerName: { $first: '$customerName' },
        totalOrders: { $sum: 1 },
        totalAmount: { $sum: '$totalPrice' }
      }
    }
  ]);

  return {
    customers,
    summary: {
      totalCustomers: customers.length,
      totalOrders: customers.reduce((s, i) => s + i.totalOrders, 0),
      totalAmount: customers.reduce((s, i) => s + i.totalAmount, 0)
    }
  };
};

exports.getDriverReportData = async () => {
  const drivers = await Order.aggregate([
    { $match: { driver: { $ne: null } } },
    {
      $group: {
        _id: '$driver',
        driverName: { $first: '$driverName' },
        totalOrders: { $sum: 1 }
      }
    }
  ]);

  return { drivers };
};

exports.getSupplierReportData = async (filters) => {
  const suppliers = await Order.aggregate([
    { $match: { supplier: { $ne: null } } },
    {
      $group: {
        _id: '$supplier',
        supplierName: { $first: '$supplierName' },
        totalOrders: { $sum: 1 },
        totalAmount: { $sum: '$totalPrice' }
      }
    }
  ]);

  return {
    suppliers,
    summary: {
      totalSuppliers: suppliers.length,
      totalOrders: suppliers.reduce((s, i) => s + i.totalOrders, 0),
      totalAmount: suppliers.reduce((s, i) => s + i.totalAmount, 0)
    }
  };
};

exports.getUserReportData = async () => {
  const users = await User.find().select('name email role');
  return { users };
};

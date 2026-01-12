const fs = require('fs');
const FuelStation = require('../models/FuelStation');

const parseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (_) {
      return [];
    }
  }
  return [];
};

const toDate = (value) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

exports.getFuelStations = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const filters = {};

    if (req.query.status) filters.status = req.query.status;
    if (req.query.stationType) filters.stationType = req.query.stationType;
    if (req.query.region) filters.region = new RegExp(req.query.region, 'i');
    if (req.query.city) filters.city = new RegExp(req.query.city, 'i');
    if (req.query.stationName) {
      filters.stationName = new RegExp(req.query.stationName, 'i');
    }

    const total = await FuelStation.countDocuments(filters);
    const stations = await FuelStation.find(filters)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      stations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'تعذر تحميل محطات الوقود.',
      details: error.message,
    });
  }
};

exports.getFuelStationById = async (req, res) => {
  try {
    const station = await FuelStation.findById(req.params.id);
    if (!station) {
      return res.status(404).json({ error: 'لم يتم العثور على المحطة.' });
    }
    res.json({ station });
  } catch (error) {
    res.status(500).json({
      error: 'تعذر تحميل تفاصيل المحطة.',
      details: error.message,
    });
  }
};

exports.createFuelStation = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'مستخدم غير مصرح.' });
    }

    const equipment = parseJsonArray(req.body.equipment);
    const fuelTypes = parseJsonArray(req.body.fuelTypes);
    const attachments = (req.files || []).map((file) => ({
      filename: file.originalname,
      fileType: file.mimetype,
      path: file.path,
      uploadedBy: req.user._id,
      uploadedByName: req.user.name,
      uploadedAt: new Date(),
    }));

    const station = new FuelStation({
      stationName: req.body.stationName,
      stationCode: req.body.stationCode,
      address: req.body.address,
      latitude: parseFloat(req.body.latitude) || 0,
      longitude: parseFloat(req.body.longitude) || 0,
      googleMapsLink: req.body.googleMapsLink,
      wazeLink: req.body.wazeLink,
      stationType: req.body.stationType,
      status: req.body.status,
      capacity: parseFloat(req.body.capacity) || 0,
      managerName: req.body.managerName,
      managerPhone: req.body.managerPhone,
      managerEmail: req.body.managerEmail,
      region: req.body.region,
      city: req.body.city,
      equipment: equipment.map((item) => ({
        equipmentName: item.equipmentName,
        equipmentType: item.equipmentType,
        serialNumber: item.serialNumber,
        manufacturer: item.manufacturer,
        installationDate: toDate(item.installationDate),
        lastServiceDate: toDate(item.lastServiceDate),
        nextServiceDate: toDate(item.nextServiceDate),
        status: item.status,
        notes: item.notes,
      })),
      fuelTypes: fuelTypes.map((item) => ({
        fuelName: item.fuelName,
        pricePerLiter: parseFloat(item.pricePerLiter) || 0,
        availableQuantity: parseFloat(item.availableQuantity) || 0,
        capacity: parseFloat(item.capacity) || 0,
        tankNumber: item.tankNumber,
        lastDeliveryDate: toDate(item.lastDeliveryDate),
        nextDeliveryDate: toDate(item.nextDeliveryDate),
        status: item.status,
      })),
      attachments,
      establishedDate: toDate(req.body.establishedDate),
      lastMaintenanceDate: toDate(req.body.lastMaintenanceDate),
      nextMaintenanceDate: toDate(req.body.nextMaintenanceDate),
      totalTechnicians: parseInt(req.body.totalTechnicians, 10) || 0,
      createdBy: req.user._id,
      createdByName: req.user.name,
    });

    await station.save();

    res.status(201).json({ station });
  } catch (error) {
    res.status(500).json({
      error: 'تعذر حفظ المحطة.',
      details: error.message,
    });
  }
};

const Device = require('../models/Device');

exports.registerDevice = async (req, res) => {
  try {
    const { token, platform } = req.body;

    if (!token || !platform) {
      return res.status(400).json({ error: 'token و platform مطلوبين' });
    }

    const device = await Device.findOneAndUpdate(
      { user: req.user._id, token },
      {
        user: req.user._id,
        token,
        platform,
        isActive: true,
        lastUsedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({ message: '✅ device registered', device });
  } catch (e) {
    // لو unique index عمل duplicate key
    if (e.code === 11000) {
      return res.json({ message: '✅ already registered' });
    }
    console.error(e);
    res.status(500).json({ error: 'حدث خطأ في تسجيل الجهاز' });
  }
};

exports.unregisterDevice = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token مطلوب' });

    await Device.updateOne(
      { user: req.user._id, token },
      { $set: { isActive: false, lastUsedAt: new Date() } }
    );

    res.json({ message: '✅ device unregistered' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'حدث خطأ في إلغاء الجهاز' });
  }
};

exports.pingDevice = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token مطلوب' });

    await Device.updateOne(
      { user: req.user._id, token },
      { $set: { lastUsedAt: new Date(), isActive: true } }
    );

    res.json({ message: '✅ pong' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'حدث خطأ' });
  }
};

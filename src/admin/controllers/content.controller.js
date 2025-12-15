import ContentItem from '../../models/contentItem.model.js';

const normalizeItem = (doc) => {
  const d = doc || {};
  return {
    _id: d._id || null,
    title: d.title || '',
    subtitle: d.subtitle || '',
    description: d.description || '',
    type: d.type || 'campaign',
    placement: d.placement || '',
    images: Array.isArray(d.images) ? d.images.map(img => ({
      _id: img?._id || null,
      url: img?.url || '',
      alt: img?.alt || '',
      status: img?.status || 'active',
      createdAt: img?.createdAt || null,
      updatedAt: img?.updatedAt || null
    })) : [],
    video: { url: d.video?.url || '', thumbnail: d.video?.thumbnail || '' },
    buttons: Array.isArray(d.buttons) ? d.buttons.map(b => ({ label: b?.label || '', url: b?.url || '' })) : [],
    tags: Array.isArray(d.tags) ? d.tags : [],
    status: d.status || 'draft',
    order: typeof d.order === 'number' ? d.order : 0,
    schedule: { startsAt: d.schedule?.startsAt || null, endsAt: d.schedule?.endsAt || null },
    metrics: { impressions: d.metrics?.impressions || 0, clicks: d.metrics?.clicks || 0 },
    createdAt: d.createdAt || null,
    updatedAt: d.updatedAt || null
  };
};

export const getContentOverview = async (req, res) => {
  try {
    const [campaigns, banners, partners, announcements] = await Promise.all([
      ContentItem.countDocuments({ type: 'campaign' }),
      ContentItem.countDocuments({ type: 'banner' }),
      ContentItem.countDocuments({ type: 'partner' }),
      ContentItem.countDocuments({ type: 'announcement' })
    ]);
    return res.status(200).json({ success: true, data: { campaigns, banners, partners, announcements } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const listContent = async (req, res) => {
  try {
    const { page = 1, limit = 12, type, search, status, placement } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (placement) filter.placement = placement;
    if (search) filter.title = { $regex: search, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [rows, total] = await Promise.all([
      ContentItem.find(filter).sort({ order: 1, createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      ContentItem.countDocuments(filter)
    ]);

    const items = rows.map(r => normalizeItem(r));
    return res.status(200).json({ success: true, data: items, pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const getContentById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await ContentItem.findById(id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    return res.status(200).json({ success: true, data: normalizeItem(doc) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const createContent = async (req, res) => {
  try {
    const payload = req.body || {};
    const doc = await ContentItem.create(payload);
    return res.status(201).json({ success: true, data: normalizeItem(doc) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const updateContent = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    const doc = await ContentItem.findByIdAndUpdate(id, { $set: payload }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    return res.status(200).json({ success: true, data: normalizeItem(doc) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const publishContent = async (req, res) => {
  try {
    const { id } = req.params; const { status = 'published', order } = req.body;
    const set = { status };
    if (typeof order === 'number') set.order = order;
    const doc = await ContentItem.findByIdAndUpdate(id, { $set: set }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    return res.status(200).json({ success: true, data: normalizeItem(doc) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const deleteContent = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await ContentItem.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    return res.status(200).json({ success: true, message: 'Deleted', data: normalizeItem(doc) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

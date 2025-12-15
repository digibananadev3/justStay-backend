import mongoose from 'mongoose';
import User from '../../models/user.model.js';
import Property from '../../models/property.model.js';

// ---- Overview counts ----
export const getVerificationOverview = async (req, res) => {
  try {
    const [guestPending, hotelPending, approvedToday, flaggedItems] = await Promise.all([
      User.countDocuments({ kycStatus: 'Pending' }),
      Property.countDocuments({ 'documents.status': 'Pending' }),
      Promise.resolve(0), // placeholder; depends on audit log; can compute verified today across users+properties
      User.aggregate([
        { $match: { flags: { $gt: 0 } } },
        { $count: 'count' }
      ]).then(r => r[0]?.count || 0)
    ]);

    return res.status(200).json({
      success: true,
      data: { guestPending, hotelPending, approvedToday, flaggedItems }
    });
  } catch (error) {
    console.error('Error in getVerificationOverview:', error);
    return res.status(500).json({ success: false, message: 'Error fetching overview' });
  }
};

// ---- Hotel Listing and Badges ----
export const getHotelListingSummary = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const [property, totalRooms, amenitiesAgg] = await Promise.all([
      Property.findById(propertyId).select('photos badges listingStatus documents verificationNotes location basicPropertyDetails').lean(),
      mongoose.model('PropertyRoom').countDocuments({ propertyId }),
      mongoose.model('PropertyRoom').aggregate([
        { $match: { propertyId: new mongoose.Types.ObjectId(propertyId) } },
        { $unwind: { path: '$amenities', preserveNullAndEmptyArrays: true } },
        { $group: { _id: null, set: { $addToSet: '$amenities' } } }
      ])
    ]);
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });
    const images = Array.isArray(property.photos) ? property.photos.length : 0;
    const amenities = amenitiesAgg?.[0]?.set?.filter(Boolean)?.length || 0;
    return res.status(200).json({ success: true, data: { totalRooms, images, amenities, listingStatus: property.listingStatus, badges: property.badges } });
  } catch (error) {
    console.error('Error in getHotelListingSummary:', error);
    return res.status(500).json({ success: false, message: 'Error fetching listing summary' });
  }
};

export const approveHotelListing = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { note } = req.body;
    const updated = await Property.findByIdAndUpdate(
      propertyId,
      { $set: { listingStatus: 'approved', status: 'Accepted', verificationNotes: note || '' } },
      { new: true }
    ).select('listingStatus status verificationNotes');
    if (!updated) return res.status(404).json({ success: false, message: 'Property not found' });
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Error in approveHotelListing:', error);
    return res.status(500).json({ success: false, message: 'Error approving listing' });
  }
};

export const rejectHotelListing = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { note } = req.body;
    const updated = await Property.findByIdAndUpdate(
      propertyId,
      { $set: { listingStatus: 'rejected', status: 'Rejected', verificationNotes: note || '' } },
      { new: true }
    ).select('listingStatus status verificationNotes');
    if (!updated) return res.status(404).json({ success: false, message: 'Property not found' });
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Error in rejectHotelListing:', error);
    return res.status(500).json({ success: false, message: 'Error rejecting listing' });
  }
};

export const updateHotelBadges = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { verifiedBadge, goSafeBadge, hourlyBooking, coupleFriendly } = req.body;
    const set = {};
    if (verifiedBadge !== undefined) set['badges.verifiedBadge'] = !!verifiedBadge;
    if (goSafeBadge !== undefined) set['badges.goSafeBadge'] = !!goSafeBadge;
    if (hourlyBooking !== undefined) set['badges.hourlyBooking'] = !!hourlyBooking;
    if (coupleFriendly !== undefined) set['badges.coupleFriendly'] = !!coupleFriendly;
    const updated = await Property.findByIdAndUpdate(propertyId, { $set: set }, { new: true }).select('badges');
    if (!updated) return res.status(404).json({ success: false, message: 'Property not found' });
    return res.status(200).json({ success: true, data: updated.badges });
  } catch (error) {
    console.error('Error in updateHotelBadges:', error);
    return res.status(500).json({ success: false, message: 'Error updating badges' });
  }
};

export const addHotelFlag = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'message is required' });
    const updated = await Property.findByIdAndUpdate(propertyId, { $addToSet: { flags: message } }, { new: true }).select('flags');
    if (!updated) return res.status(404).json({ success: false, message: 'Property not found' });
    return res.status(200).json({ success: true, data: updated.flags });
  } catch (error) {
    console.error('Error in addHotelFlag:', error);
    return res.status(500).json({ success: false, message: 'Error adding flag' });
  }
};

export const removeHotelFlag = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'message is required' });
    const updated = await Property.findByIdAndUpdate(propertyId, { $pull: { flags: message } }, { new: true }).select('flags');
    if (!updated) return res.status(404).json({ success: false, message: 'Property not found' });
    return res.status(200).json({ success: true, data: updated.flags });
  } catch (error) {
    console.error('Error in removeHotelFlag:', error);
    return res.status(500).json({ success: false, message: 'Error removing flag' });
  }
};

export const requestHotelMoreInfo = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const property = await Property.findById(propertyId).select('_id');
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });
    // Hook to notifications/email here
    return res.status(200).json({ success: true, message: 'Requested more info (stub)' });
  } catch (error) {
    console.error('Error in requestHotelMoreInfo:', error);
    return res.status(500).json({ success: false, message: 'Error requesting more info' });
  }
};

// ---- Single Hotel Verification Detail ----
export const getHotelVerificationDetail = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const property = await Property.findById(propertyId)
      .select('basicPropertyDetails.name location.city status documents verificationNotes bypassAutoCheck createdAt userId')
      .populate('userId', 'firstName lastName email phone')
      .lean();
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });
    return res.status(200).json({ success: true, data: property });
  } catch (error) {
    console.error('Error in getHotelVerificationDetail:', error);
    return res.status(500).json({ success: false, message: 'Error fetching hotel verification detail' });
  }
};

export const updateHotelVerificationNote = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { verificationNotes = '' } = req.body;
    const updated = await Property.findByIdAndUpdate(propertyId, { $set: { verificationNotes } }, { new: true })
      .select('verificationNotes');
    if (!updated) return res.status(404).json({ success: false, message: 'Property not found' });
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Error in updateHotelVerificationNote:', error);
    return res.status(500).json({ success: false, message: 'Error updating verification note' });
  }
};

export const setHotelBypassAutoCheck = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { bypass = true } = req.body;
    const updated = await Property.findByIdAndUpdate(propertyId, { $set: { bypassAutoCheck: !!bypass } }, { new: true })
      .select('bypassAutoCheck');
    if (!updated) return res.status(404).json({ success: false, message: 'Property not found' });
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Error in setHotelBypassAutoCheck:', error);
    return res.status(500).json({ success: false, message: 'Error updating bypass flag' });
  }
};

export const resendHotelVerificationRequest = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const property = await Property.findById(propertyId).select('_id');
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });
    // Integrate notifications here
    return res.status(200).json({ success: true, message: 'Hotel verification request resent (stub)' });
  } catch (error) {
    console.error('Error in resendHotelVerificationRequest:', error);
    return res.status(500).json({ success: false, message: 'Error resending verification request' });
  }
};

export const updateHotelSingleDocument = async (req, res) => {
  try {
    const { propertyId, documentId } = req.params;
    const { status } = req.body;
    const property = await Property.findById(propertyId);
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });
    const doc = property.documents.id(documentId);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    if (status) doc.status = status;
    await property.save();
    return res.status(200).json({ success: true, data: property.documents });
  } catch (error) {
    console.error('Error in updateHotelSingleDocument:', error);
    return res.status(500).json({ success: false, message: 'Error updating document' });
  }
};

// ---- Single Guest Verification Detail ----
export const getGuestVerificationDetail = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId)
      .select('firstName lastName email phone kycStatus kycDocuments kycNotes bypassAutoCheck flags createdAt')
      .lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Error in getGuestVerificationDetail:', error);
    return res.status(500).json({ success: false, message: 'Error fetching user verification detail' });
  }
};

export const updateGuestVerificationNote = async (req, res) => {
  try {
    const { userId } = req.params;
    const { kycNotes = '' } = req.body;
    const updated = await User.findByIdAndUpdate(userId, { $set: { kycNotes } }, { new: true })
      .select('kycNotes');
    if (!updated) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Error in updateGuestVerificationNote:', error);
    return res.status(500).json({ success: false, message: 'Error updating verification note' });
  }
};

export const setGuestBypassAutoCheck = async (req, res) => {
  try {
    const { userId } = req.params;
    const { bypass = true } = req.body;
    const updated = await User.findByIdAndUpdate(userId, { $set: { bypassAutoCheck: !!bypass } }, { new: true })
      .select('bypassAutoCheck');
    if (!updated) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Error in setGuestBypassAutoCheck:', error);
    return res.status(500).json({ success: false, message: 'Error updating bypass flag' });
  }
};

export const resendGuestVerificationRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('email phone');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    // Integrate with notification service/email/SMS if available.
    return res.status(200).json({ success: true, message: 'Verification request resent (stub)' });
  } catch (error) {
    console.error('Error in resendGuestVerificationRequest:', error);
    return res.status(500).json({ success: false, message: 'Error resending verification request' });
  }
};

export const updateGuestSingleDocument = async (req, res) => {
  try {
    const { userId, documentId } = req.params;
    const { status } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const doc = user.kycDocuments.id(documentId);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    if (status) doc.status = status;
    await user.save();
    return res.status(200).json({ success: true, data: user.kycDocuments });
  } catch (error) {
    console.error('Error in updateGuestSingleDocument:', error);
    return res.status(500).json({ success: false, message: 'Error updating document' });
  }
};

// ---- Guests (Users) ----
export const listGuestVerifications = async (req, res) => {
  try {
    const { search = '', status, page = 1, limit = 10 } = req.query;
    const query = {};
    if (status) query.kycStatus = status;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [items, total] = await Promise.all([
      User.find(query)
        .select('firstName lastName email phone kycStatus kycDocuments flags createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query)
    ]);

    return res.status(200).json({ success: true, data: items, pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    console.error('Error in listGuestVerifications:', error);
    return res.status(500).json({ success: false, message: 'Error fetching guest verifications' });
  }
};

export const updateGuestKycStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { kycStatus } = req.body; // Pending | Verified | Rejected | Not_started
    const updated = await User.findByIdAndUpdate(userId, { $set: { kycStatus } }, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Error in updateGuestKycStatus:', error);
    return res.status(500).json({ success: false, message: 'Error updating KYC status' });
  }
};

export const updateGuestDocuments = async (req, res) => {
  try {
    const { userId } = req.params;
    const { documents } = req.body; // [{documentId, status}]
    if (!Array.isArray(documents) || documents.length === 0) return res.status(400).json({ success: false, message: 'documents array is required' });

    const user = await User.findById(userId).select('kycDocuments');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const map = new Map(documents.map(d => [String(d.documentId), d.status]));
    user.kycDocuments = user.kycDocuments.map(d => {
      const id = String(d._id);
      if (map.has(id)) d.status = map.get(id);
      return d;
    });
    await user.save();
    return res.status(200).json({ success: true, data: user.kycDocuments });
  } catch (error) {
    console.error('Error in updateGuestDocuments:', error);
    return res.status(500).json({ success: false, message: 'Error updating documents' });
  }
};

export const flagGuest = async (req, res) => {
  try {
    const { userId } = req.params;
    const { flags = 1 } = req.body;
    const updated = await User.findByIdAndUpdate(userId, { $inc: { flags } }, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Error in flagGuest:', error);
    return res.status(500).json({ success: false, message: 'Error flagging guest' });
  }
};

// ---- Hotels (Properties) ----
export const listHotelVerifications = async (req, res) => {
  try {
    const { search = '', status, page = 1, limit = 10 } = req.query;
    const query = {};
    if (status) query['documents.status'] = status;
    if (search) {
      query.$or = [
        { 'basicPropertyDetails.name': { $regex: search, $options: 'i' } },
        { 'location.city': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [items, total] = await Promise.all([
      Property.find(query)
        .select('basicPropertyDetails.name location.city documents userId createdAt')
        .populate('userId', 'firstName lastName email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Property.countDocuments(query)
    ]);

    return res.status(200).json({ success: true, data: items, pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    console.error('Error in listHotelVerifications:', error);
    return res.status(500).json({ success: false, message: 'Error fetching hotel verifications' });
  }
};

export const updateHotelDocuments = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { documents } = req.body; // [{documentId, status}]
    if (!Array.isArray(documents) || documents.length === 0) return res.status(400).json({ success: false, message: 'documents array is required' });

    const property = await Property.findById(propertyId).select('documents');
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

    const map = new Map(documents.map(d => [String(d.documentId), d.status]));
    property.documents = property.documents.map(d => {
      const id = String(d._id);
      if (map.has(id)) d.status = map.get(id);
      return d;
    });
    await property.save();
    return res.status(200).json({ success: true, data: property.documents });
  } catch (error) {
    console.error('Error in updateHotelDocuments:', error);
    return res.status(500).json({ success: false, message: 'Error updating documents' });
  }
};

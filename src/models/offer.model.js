import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  title: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed', 'free_night'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  minStay: {
    type: Number,
    min: 1,
    default: 1
  },
  minAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  validFrom: {
    type: Date,
    required: true
  },
  validUntil: {
    type: Date,
    required: true
  },
  promoCode: {
    type: String,
    uppercase: true,
    trim: true,
    maxlength: 20
  },
  isActive: {
    type: Boolean,
    default: true
  },
  usageLimit: {
    type: Number,
    min: 1
  },
  usedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  properties: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property'
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  metadata: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: Date,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
offerSchema.index({ promoCode: 1 }, { unique: true, sparse: true });
offerSchema.index({ validFrom: 1, validUntil: 1 });

// Virtual for checking if offer is currently active
offerSchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  return this.isActive && 
         this.validFrom <= now && 
         this.validUntil >= now &&
         (this.usageLimit ? this.usedCount < this.usageLimit : true);
});

// Pre-save hook to update updatedAt and updatedBy
offerSchema.pre('save', function(next) {
  this.metadata.updatedAt = new Date();
  next();
});

const Offer = mongoose.model('Offer', offerSchema);

export default Offer;

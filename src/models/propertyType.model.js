import mongoose from 'mongoose';

const propertyTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  isActive: {
    type: Boolean,
    default: true
  },
  icon: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
propertyTypeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Create a compound index for case-insensitive search
propertyTypeSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

const PropertyType = mongoose.model('PropertyType', propertyTypeSchema);

export default PropertyType;

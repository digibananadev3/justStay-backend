import mongoose from "mongoose";

const { Schema } = mongoose;

const favoriteSchema = new Schema(
  {
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true, 
      index: true 
    },
    propertyId: { 
      type: Schema.Types.ObjectId, 
      ref: "Property", 
      required: true,
      index: true 
    },
    addedAt: { 
      type: Date, 
      default: Date.now 
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500
    },
    tags: [{
      type: String,
      trim: true
    }]
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound index to ensure a user can't favorite the same property multiple times
favoriteSchema.index({ userId: 1, propertyId: 1 }, { unique: true });

// Virtual population for property details
favoriteSchema.virtual('property', {
  ref: 'Property',
  localField: 'propertyId',
  foreignField: '_id',
  justOne: true
});

const Favorite = mongoose.model("Favorite", favoriteSchema);

export default Favorite;

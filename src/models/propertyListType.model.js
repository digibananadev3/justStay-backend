import mongoose from 'mongoose';

const { Schema } = mongoose;

const propertyListTypeSchema = new Schema(
  {
    propertyTypeId: {
      type: Schema.Types.ObjectId,
      ref: 'PropertyType',
    },
    propertyTypeName: {
      type: String,
      trim: true,
      minlength: 2,
      maxlength: 100
    },
    PropertyListTypeName:{
      type: String,
      trim: true,
      minlength: 2,
      maxlength: 100
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    icon: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

const PropertyListType = mongoose.model('PropertyListType', propertyListTypeSchema);
export default PropertyListType;

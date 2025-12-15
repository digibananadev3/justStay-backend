const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a room name'],
      trim: true,
      maxlength: [100, 'Name cannot be more than 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Please add a description'],
      maxlength: [1000, 'Description cannot be more than 1000 characters'],
    },
    pricePerNight: {
      type: Number,
      required: [true, 'Please add a price per night'],
      min: [0, 'Price cannot be negative'],
    },
    address: {
      type: String,
      required: [true, 'Please add an address'],
    },
    guestCapacity: {
      type: Number,
      required: [true, 'Please add guest capacity'],
      min: [1, 'Guest capacity must be at least 1'],
    },
    numOfBeds: {
      type: Number,
      required: [true, 'Please add number of beds'],
      min: [1, 'Number of beds must be at least 1'],
    },
    internet: {
      type: Boolean,
      default: false,
    },
    breakfast: {
      type: Boolean,
      default: false,
    },
    airConditioned: {
      type: Boolean,
      default: false,
    },
    petsAllowed: {
      type: Boolean,
      default: false,
    },
    roomCleaning: {
      type: Boolean,
      default: true,
    },
    ratings: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: 'User',
          required: true,
        },
        rating: {
          type: Number,
          required: true,
          min: 1,
          max: 5,
        },
        comment: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    images: [
      {
        public_id: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
      },
    ],
    category: {
      type: String,
      required: [true, 'Please add a category'],
      enum: ['King', 'Single', 'Twins', 'Suite', 'Deluxe'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Cascade delete bookings when a room is deleted
roomSchema.pre('remove', async function (next) {
  await this.model('Booking').deleteMany({ room: this._id });
  next();
});

// Reverse populate with virtuals
roomSchema.virtual('bookings', {
  ref: 'Booking',
  localField: '_id',
  foreignField: 'room',
  justOne: false,
});

// Calculate average rating
roomSchema.methods.getAverageRating = function () {
  if (this.ratings.length === 0) return 0;
  const sum = this.ratings.reduce((acc, item) => item.rating + acc, 0);
  return sum / this.ratings.length;
};

module.exports = mongoose.model('Room', roomSchema);

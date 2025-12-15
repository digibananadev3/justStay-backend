import mongoose from 'mongoose';

const appUsageSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  deviceInfo: {
    platform: String, // 'android', 'ios', 'web'
    osVersion: String,
    appVersion: String,
    deviceModel: String,
    deviceId: String
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  screens: [{
    name: String, // Screen/route name
    startTime: Date,
    endTime: Date,
    duration: Number // in seconds
  }],
  actions: [{
    type: {
      type: String, // 'screen_view', 'button_click', 'search', etc.
      required: true
    },
    name: String, // Action name/identifier
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: mongoose.Schema.Types.Mixed // Additional data
  }],
  networkType: String, // 'wifi', 'cellular', 'offline'
  appState: {
    isBackground: Boolean,
    isActive: Boolean
  },
  ipAddress: String,
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: [Number] // [longitude, latitude]
  },
  lastActive: Date
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for faster querying
appUsageSchema.index({ userId: 1, startTime: -1 });
appUsageSchema.index({ 'actions.timestamp': -1 });
appUsageSchema.index({ location: '2dsphere' });

const AppUsage = mongoose.model('AppUsage', appUsageSchema);

export default AppUsage;

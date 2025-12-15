import mongoose from "mongoose";

const { Schema } = mongoose;

const mediaImageSchema = new Schema(
  {
    url: { type: String, required: true },
    alt: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" }
  },
  { _id: true, timestamps: true }
);

const buttonSchema = new Schema(
  {
    label: { type: String, default: "" },
    url: { type: String, default: "" }
  },
  { _id: false }
);

const contentItemSchema = new Schema(
  {
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    description: { type: String, default: "" },

    // one model to support 4 tabs via type/placement
    type: { type: String, enum: [
      "campaign", // Marketing Campaigns
      "banner",   // Platform banners
      "partner",  // Partner promotions
      "announcement" // Announcements/Notifications
    ], default: "campaign", index: true },

    placement: { type: String, default: "" }, // e.g., homepage, app, partners

    images: { type: [mediaImageSchema], default: [] },
    video: {
      url: { type: String, default: "" },
      thumbnail: { type: String, default: "" }
    },

    buttons: { type: [buttonSchema], default: [] },
    tags: { type: [String], default: [] },

    status: { type: String, enum: ["draft", "published", "archived"], default: "draft", index: true },
    order: { type: Number, default: 0 },

    schedule: {
      startsAt: { type: Date },
      endsAt: { type: Date }
    },

    metrics: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 }
    },

    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

const ContentItem = mongoose.model("ContentItem", contentItemSchema);
export default ContentItem;

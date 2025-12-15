import mongoose from "mongoose";
import SupportKBCategory from "../models/supportKBCategory.model.js";
import SupportKBArticle from "../models/supportKBArticle.model.js";

// Categories
export const createKBCategory = async (req, res) => {
  try {
    const { name, slug, order = 0 } = req.body;
    if (!name || !slug) return res.status(400).json({ success: false, message: "name and slug are required" });
    const cat = await SupportKBCategory.create({ name, slug, order });
    res.status(201).json({ success: true, message: "Category created", data: cat });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const listKBCategories = async (req, res) => {
  try {
    const cats = await SupportKBCategory.find().sort({ order: 1, createdAt: 1 });
    // articleCount could be added via aggregation; simple count here
    res.status(200).json({ success: true, data: cats });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// Articles
export const createKBArticle = async (req, res) => {
  try {
    const { title, slug, summary, content, category, tags = [], published = true, order = 0 } = req.body;
    if (!title || !slug || !content || !category)
      return res.status(400).json({ success: false, message: "title, slug, content, category are required" });

    const art = await SupportKBArticle.create({ title, slug, summary, content, category, tags, published, order });
    res.status(201).json({ success: true, message: "Article created", data: art });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const updateKBArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const upd = req.body;
    const art = await SupportKBArticle.findByIdAndUpdate(id, upd, { new: true, runValidators: true });
    if (!art) return res.status(404).json({ success: false, message: "Article not found" });
    res.status(200).json({ success: true, message: "Article updated", data: art });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const listArticlesByCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      SupportKBArticle.find({ category: id, published: true })
        .select("title summary slug order createdAt")
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      SupportKBArticle.countDocuments({ category: id, published: true }),
    ]);

    res.status(200).json({ success: true, count: items.length, total, page: Number(page), limit: Number(limit), data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const getKBArticleById = async (req, res) => {
  try {
    const { id } = req.params;
    const art = await SupportKBArticle.findById(id).populate("category", "name slug");
    if (!art) return res.status(404).json({ success: false, message: "Article not found" });
    res.status(200).json({ success: true, data: art });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const getKBArticleBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const art = await SupportKBArticle.findOne({ slug }).populate("category", "name slug");
    if (!art) return res.status(404).json({ success: false, message: "Article not found" });
    res.status(200).json({ success: true, data: art });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const searchKBArticles = async (req, res) => {
  try {
    const { q = "", page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const [items, total] = await Promise.all([
      SupportKBArticle.find({ published: true, $or: [{ title: rx }, { summary: rx }, { content: rx }, { tags: rx }] })
        .select("title summary slug createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      SupportKBArticle.countDocuments({ published: true, $or: [{ title: rx }, { summary: rx }, { content: rx }, { tags: rx }] }),
    ]);

    res.status(200).json({ success: true, count: items.length, total, page: Number(page), limit: Number(limit), data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

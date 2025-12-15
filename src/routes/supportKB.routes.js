import express from "express";
import {
  createKBCategory,
  listKBCategories,
  createKBArticle,
  updateKBArticle,
  listArticlesByCategory,
  getKBArticleById,
  getKBArticleBySlug,
  searchKBArticles
} from "../controllers/supportKB.controller.js";

const router = express.Router();

// Categories
router.post("/kb/categories", createKBCategory);
router.get("/kb/categories", listKBCategories);

// Articles
router.post("/kb/articles", createKBArticle);
router.patch("/kb/articles/:id", updateKBArticle);
router.get("/kb/categories/:id/articles", listArticlesByCategory);
router.get("/kb/articles/:id", getKBArticleById);
router.get("/kb/articles/slug/:slug", getKBArticleBySlug);
router.get("/kb/search", searchKBArticles);

export default router;

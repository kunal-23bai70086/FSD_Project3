import express from "express";
import Post from "../models/Post.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRole } from "../middleware/authorizeRole.js";
import { body, validationResult, param } from "express-validator";
import axios from "axios";

const router = express.Router();
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://user-service:4001/users";

// Create post (protected: authenticated users and admins)
router.post(
  "/",
  verifyToken,
  authorizeRole(["user", "admin"]),
  [
    body("userId").notEmpty().isMongoId(),
    body("title").notEmpty().isLength({ min: 3 }),
    body("content").notEmpty().isLength({ min: 1 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      // Check if user exists
      const userRes = await axios.get(`${USER_SERVICE_URL}/${req.body.userId}`);
      const user = userRes.data;

      const post = await Post.create({
        userId: req.body.userId,
        title: req.body.title,
        content: req.body.content,
      });

      res.status(201).json({ ...post._doc, user });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Get all posts with user info (admin only)
router.get("/", verifyToken, authorizeRole(["admin"]), async (req, res) => {
  try {
    const posts = await Post.find();
    const results = await Promise.all(posts.map(async (post) => {
      try {
        const userRes = await axios.get(`${USER_SERVICE_URL}/${post.userId}`);
        return { ...post._doc, user: userRes.data };
      } catch {
        return { ...post._doc, user: null };
      }
    }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single post by id with user info
router.get(
  "/:id",
  [param("id").isMongoId()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ error: "Post not found" });
      try {
        const userRes = await axios.get(`${USER_SERVICE_URL}/${post.userId}`);
        return res.json({ ...post._doc, user: userRes.data });
      } catch {
        return res.json({ ...post._doc, user: null });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Update a post (title/content)
router.put(
  "/:id",
  [param("id").isMongoId(), body("title").optional().isLength({ min: 3 }), body("content").optional().isLength({ min: 1 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const updates = {};
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.content !== undefined) updates.content = req.body.content;

      const post = await Post.findByIdAndUpdate(req.params.id, updates, { new: true });
      if (!post) return res.status(404).json({ error: "Post not found" });
      res.json(post);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Delete a post
router.delete("/:id", async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
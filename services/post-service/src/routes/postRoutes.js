import express from "express";
import Post from "../models/Post.js";
import axios from "axios";

const router = express.Router();
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://user-service:4001/users";

// Create post
router.post("/", async (req, res) => {
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
});

// Get all posts with user info
router.get("/", async (req, res) => {
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

export default router;
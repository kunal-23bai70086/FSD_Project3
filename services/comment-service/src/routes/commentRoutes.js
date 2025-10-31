import express from "express";
import Comment from "../models/Comment.js";
import axios from "axios";

const router = express.Router();
const POST_SERVICE_URL = process.env.POST_SERVICE_URL || "http://post-service:4002/posts";
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://user-service:4001/users";

// Create comment
router.post("/", async (req, res) => {
  try {
    // Validate user and post exist
    const [userRes, postRes] = await Promise.all([
      axios.get(`${USER_SERVICE_URL}/${req.body.userId}`),
      axios.get(`${POST_SERVICE_URL}/${req.body.postId}`)
    ]);

    const comment = await Comment.create(req.body);

    res.status(201).json({
      ...comment._doc,
      user: userRes.data,
      post: postRes.data,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all comments with related data
router.get("/", async (req, res) => {
  try {
    const comments = await Comment.find();
    const enriched = await Promise.all(comments.map(async (c) => {
      const [userRes, postRes] = await Promise.allSettled([
        axios.get(`${USER_SERVICE_URL}/${c.userId}`),
        axios.get(`${POST_SERVICE_URL}/${c.postId}`)
      ]);

      return {
        ...c._doc,
        user: userRes.status === "fulfilled" ? userRes.value.data : null,
        post: postRes.status === "fulfilled" ? postRes.value.data : null,
      };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
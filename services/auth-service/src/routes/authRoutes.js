import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import User from "../models/User.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// Register new user (accepts optional `role`, defaults to 'user')
router.post(
  "/register",
  [
    body("username").notEmpty().isLength({ min: 3 }),
    body("email").isEmail(),
    body("password").isLength({ min: 6 }),
    body("role").optional().isIn(["user", "admin"]),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { username, email, password, role = "user" } = req.body;
      const hashed = await bcrypt.hash(password, 10);
      const user = await User.create({ username, email, password: hashed, role });
      res.status(201).json({ id: user._id, username, email, role });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Login
router.post(
  "/login",
  [
    body("email").isEmail(),
    body("password").isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ error: "User not found" });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: process.env.TOKEN_EXPIRES_IN || "1h" }
      );
      res.json({ token });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;
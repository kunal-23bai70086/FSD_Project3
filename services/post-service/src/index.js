import express from "express";
import mongoose from "mongoose";
import postRoutes from "./routes/postRoutes.js";

const app = express();
app.use(express.json());

// Routes
app.use("/posts", postRoutes);

// Health Route
app.get("/", (req, res) => {
  res.json({ service: "Post Service", status: "running" });
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("Connected to Post MongoDB"))
.catch((err) => console.error("MongoDB connection error:", err));

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => {
  console.log(`Post Service running on port ${PORT}`);
});
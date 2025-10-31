import express from "express";
import mongoose from "mongoose";
import commentRoutes from "./routes/commentRoutes.js";

const app = express();
app.use(express.json());

// Routes
app.use("/comments", commentRoutes);

// Health Route
app.get("/", (req, res) => {
  res.json({ service: "Comment Service", status: "running" });
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("Connected to Comment MongoDB"))
.catch((err) => console.error("MongoDB connection error:", err));

const PORT = process.env.PORT || 4003;
app.listen(PORT, () => {
  console.log(`Comment Service running on port ${PORT}`);
});
import express from "express";
import mongoose from "mongoose";
import userRoutes from "./routes/userRoutes.js";

const app = express();
app.use(express.json());

// Routes
app.use("/users", userRoutes);

// Health/API base route
app.get("/", (req, res) => {
  res.json({ service: "User Service", status: "running" });
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("Connected to User MongoDB"))
.catch((err) => console.error("MongoDB connection error:", err));

// Start server
const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
});
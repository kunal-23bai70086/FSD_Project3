import express from "express";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoutes.js";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());
app.use("/auth", authRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Auth DB connected"))
  .catch(err => console.error(err));

app.listen(4004, () => console.log("Auth service on port 4004"));
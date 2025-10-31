import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
app.use(express.json());

app.use("/users", createProxyMiddleware({ target: "http://user-service:4001", changeOrigin: true }));
app.use("/posts", createProxyMiddleware({ target: "http://post-service:4002", changeOrigin: true }));
app.use("/comments", createProxyMiddleware({ target: "http://comment-service:4003", changeOrigin: true }));

app.get("/", (req, res) => res.send("API Gateway running"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Gateway listening on port ${PORT}`));
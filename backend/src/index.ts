import express from "express";
import { sanitizeMiddleware } from "./middleware/sanitize";
import { authRateLimiter } from "./middleware/rateLimiter";
import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profiles";
import connectionRoutes from "./routes/connections";
import postRoutes from "./routes/posts";
import feedRoutes from "./routes/feed";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(sanitizeMiddleware);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Auth routes with rate limiting
app.use("/api/auth", authRateLimiter, authRoutes);

// Profile routes
app.use("/api/profiles", profileRoutes);

// Connection routes
app.use("/api/connections", connectionRoutes);

// Post routes
app.use("/api/posts", postRoutes);

// Feed routes
app.use("/api/feed", feedRoutes);

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

export default app;

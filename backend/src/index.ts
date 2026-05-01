import express from "express";
import helmet from "helmet";
import { corsMiddleware } from "./middleware/cors";
import { sanitizeMiddleware } from "./middleware/sanitize";
import { authRateLimiter, globalRateLimiter, uploadRateLimiter } from "./middleware/rateLimiter";
import { globalErrorHandler } from "./middleware/errorHandler";
import { runMigrations } from "./migrations/run";
import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profiles";
import connectionRoutes from "./routes/connections";
import postRoutes from "./routes/posts";
import feedRoutes from "./routes/feed";
import ipfsRoutes from "./routes/ipfs";

const app = express();
const PORT = process.env.PORT || 3001;

// CORS must be applied before other middleware so preflight requests are handled
app.use(corsMiddleware);
// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disabled — frontend handles CSP
  crossOriginEmbedderPolicy: false, // Allow cross-origin resources (IPFS images)
}));
app.use(express.json());
app.use(sanitizeMiddleware);
// Global rate limiting
app.use(globalRateLimiter);

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

// IPFS routes
app.use("/api/ipfs", ipfsRoutes);

// Global error handler — must be registered AFTER all routes
app.use(globalErrorHandler);

// Run database migrations before starting the server
runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to run database migrations:", err);
    process.exit(1);
  });

export default app;

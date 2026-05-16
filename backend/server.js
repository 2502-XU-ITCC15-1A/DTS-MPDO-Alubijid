require("dotenv").config();

// Validate required environment variables before anything else
const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error("Missing required environment variables:", missingEnv.join(", "));
  process.exit(1);
}

const hasGmailOauth =
  process.env.GMAIL_USER &&
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_REFRESH_TOKEN;
const hasSmtp = process.env.EMAIL_USER && process.env.EMAIL_PASS;
if (!hasGmailOauth && !hasSmtp) {
  console.warn(
    "Warning: no email provider configured. Forgot-password OTP requests will return dev OTP values instead of sending email."
  );
}

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const uploadRoutes = require("./routes/upload");
const backupRoutes = require("./routes/backup");

const app = express();
const PORT = process.env.PORT || 5000;

// Trust Render's proxy so rate limiter can read real client IPs
app.set("trust proxy", 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "https://dts-mpdo-alubijid.netlify.app",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:8080",
  "http://localhost:8081",
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "MPDO Alubijid Backend",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/ping", (_req, res) => {
  res.json({ message: "pong" });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api", uploadRoutes);
app.use("/api", backupRoutes);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[Unhandled Error]", err.message);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`MPDO Backend running on http://localhost:${PORT}`);
});

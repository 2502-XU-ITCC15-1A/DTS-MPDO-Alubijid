const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many OTP requests. Please wait 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many reset attempts. Please wait 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: { error: "Too many upload requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, otpLimiter, resetLimiter, uploadLimiter };

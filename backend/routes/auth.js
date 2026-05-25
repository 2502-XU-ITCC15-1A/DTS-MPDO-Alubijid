const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const { supabaseAdmin } = require("../config/supabase");
const { authLimiter, otpLimiter, resetLimiter } = require("../config/limiters");

// ── Check if email is registered (public — signup flow) ──────────────────────
router.post("/check-email", authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  const { data, error } = await supabaseAdmin
    .from("employees")
    .select("id, name, department")
    .eq("email", email)
    .single();

  if (error || !data) {
    return res.json({ valid: false, message: "Email not registered by admin" });
  }

  res.json({ valid: true, name: data.name, department: data.department });
});

// ── Create account for verified staff (public — signup flow) ──────────────────
router.post("/create-account", authLimiter, async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const { data: employee } = await supabaseAdmin
    .from("employees")
    .select("id")
    .eq("email", email)
    .single();

  if (!employee) {
    return res.status(403).json({ error: "Email not registered by admin" });
  }

  const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) return res.status(400).json({ error: error.message });

  const updates = {};
  if (name) updates.name = name;
  if (req.body.personalEmail) updates.personal_email = req.body.personalEmail;
  if (Object.keys(updates).length > 0) {
    await supabaseAdmin.from("employees").update(updates).eq("email", email);
  }

  res.json({ success: true });
});

// ── Send OTP for password reset ───────────────────────────────────────────────
router.post("/send-otp", otpLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  const { data: employee, error: empErr } = await supabaseAdmin
    .from("employees")
    .select("email, personal_email, name")
    .eq("personal_email", email.toLowerCase().trim())
    .single();

  if (empErr || !employee || !employee.personal_email) {
    return res.json({ success: true });
  }

  const sendTo = employee.personal_email.toLowerCase().trim();
  const otp = String(crypto.randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await supabaseAdmin.from("otp_tokens").delete().eq("email", sendTo);

  const { error: insertErr } = await supabaseAdmin.from("otp_tokens").insert({
    phone: "",
    email: sendTo,
    otp,
    expires_at: expiresAt,
  });

  if (insertErr) return res.status(500).json({ error: "Failed to generate OTP." });

  const sendgridKey = process.env.SENDGRID_API_KEY;

  if (!sendgridKey) {
    console.log(`[OTP DEV] Code for ${sendTo}: ${otp}`);
    return res.json({ success: true, devOtp: otp });
  }

  try {
    const sgMail = require("@sendgrid/mail");
    sgMail.setApiKey(sendgridKey);

    await sgMail.send({
      from: { name: "MPDO Document Tracking", email: "dts.mpdoalubijid@gmail.com" },
      to: sendTo,
      subject: "Your Password Reset OTP — MPDO DTS",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
          <h2 style="color:#0069c0;margin-bottom:4px;">Password Reset</h2>
          <p style="color:#374151;">Hi ${employee.name || "there"},</p>
          <p style="color:#374151;">Use the OTP below to reset your MPDO DTS password. It expires in <strong>10 minutes</strong>.</p>
          <div style="background:#f0f9ff;border:2px dashed #0069c0;border-radius:8px;padding:20px;text-align:center;margin:24px 0;">
            <span style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#0069c0;">${otp}</span>
          </div>
          <p style="color:#6b7280;font-size:13px;">If you did not request this, ignore this email. Do not share this code with anyone.</p>
        </div>
      `,
    });

    console.log(`[OTP] Sent to ${sendTo} via SendGrid`);
    res.json({ success: true });
  } catch (mailErr) {
    console.error("[OTP] SendGrid error:", mailErr.response?.body || mailErr.message);
    res.status(500).json({ error: "Failed to send OTP email." });
  }
});

// ── Verify OTP ────────────────────────────────────────────────────────────────
router.post("/verify-otp", otpLimiter, async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: "Email and OTP required" });

  const { data: token, error } = await supabaseAdmin
    .from("otp_tokens")
    .select("*")
    .eq("email", email.toLowerCase().trim())
    .eq("otp", otp)
    .eq("used", false)
    .single();

  if (error || !token) return res.status(400).json({ error: "Invalid OTP." });

  if (new Date(token.expires_at) < new Date()) {
    return res.status(400).json({ error: "OTP has expired. Please request a new one." });
  }

  await supabaseAdmin.from("otp_tokens").update({ used: true }).eq("id", token.id);

  const resetToken = crypto.randomBytes(48).toString("hex");
  const resetExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await supabaseAdmin.from("otp_tokens").insert({
    phone: "",
    email: token.email,
    otp: resetToken,
    expires_at: resetExpiry,
    used: false,
  });

  res.json({ success: true, resetToken, email: token.email });
});

// ── Reset password using verified reset token ─────────────────────────────────
router.post("/reset-password", resetLimiter, async (req, res) => {
  const { resetToken, password, email } = req.body;
  if (!resetToken || !password || !email) {
    return res.status(400).json({ error: "Token, email and password required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const { data: token, error } = await supabaseAdmin
    .from("otp_tokens")
    .select("*")
    .eq("otp", resetToken)
    .eq("email", email.toLowerCase().trim())
    .eq("used", false)
    .single();

  if (error || !token) return res.status(400).json({ error: "Invalid or expired reset token." });

  if (new Date(token.expires_at) < new Date()) {
    return res.status(400).json({ error: "Reset token has expired. Please start over." });
  }

  // token.email is the personal email — find the matching work email
  const { data: allEmps } = await supabaseAdmin.from("employees").select("email, personal_email");
  const normalizedSearch = token.email.toLowerCase().trim();
  const empRow = allEmps?.find(e => e.personal_email?.toLowerCase().trim() === normalizedSearch);
  if (!empRow) return res.status(404).json({ error: "Auth account not found." });

  // find the Supabase Auth user by work email
  let authUserId = null;
  let page = 1;
  while (!authUserId) {
    const { data: { users, nextPage }, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page });
    if (listErr) return res.status(500).json({ error: "Failed to look up user." });
    const found = users.find((u) => u.email === empRow.email);
    if (found) { authUserId = found.id; break; }
    if (!nextPage) break;
    page++;
  }
  if (!authUserId) return res.status(404).json({ error: "Auth account not found." });

  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, { password });
  if (updateErr) return res.status(500).json({ error: "Failed to reset password." });

  await supabaseAdmin.from("otp_tokens").update({ used: true }).eq("id", token.id);

  res.json({ success: true });
});

module.exports = router;

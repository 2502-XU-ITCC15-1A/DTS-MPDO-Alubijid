require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const { google } = require("googleapis");
const { Readable } = require("stream");
const https = require("https");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

// Supabase admin client (service role)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS — explicit origins only, no wildcards ────────────────────────────────
const allowedOrigins = [
  "https://dts-mpdo-alubijid.netlify.app",
  "http://localhost:5173",
  "http://localhost:4173",
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. server-to-server, health checks)
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

// ── Rate limiters ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
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

const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: { error: "Too many upload requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Auth middleware — verifies Supabase JWT from Authorization header ──────────
async function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized. No token provided." });
  }

  const token = authHeader.split(" ")[1];

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: "Unauthorized. Invalid or expired token." });
  }

  // Attach the verified user to the request
  req.authUser = user;
  next();
}

// ── Admin/Head-staff middleware — must be used after requireAuth ───────────────
async function requireAdminOrHead(req, res, next) {
  const { data: employee, error } = await supabaseAdmin
    .from("employees")
    .select("role")
    .eq("email", req.authUser.email)
    .single();

  if (error || !employee) {
    return res.status(403).json({ error: "Forbidden. Employee record not found." });
  }

  if (employee.role !== "admin" && employee.role !== "head_staff") {
    return res.status(403).json({ error: "Forbidden. Admin or Head Staff access required." });
  }

  req.employeeRole = employee.role;
  next();
}

// ── Admin-only middleware ─────────────────────────────────────────────────────
async function requireAdmin(req, res, next) {
  const { data: employee, error } = await supabaseAdmin
    .from("employees")
    .select("role")
    .eq("email", req.authUser.email)
    .single();

  if (error || !employee) {
    return res.status(403).json({ error: "Forbidden. Employee record not found." });
  }

  if (employee.role !== "admin") {
    return res.status(403).json({ error: "Forbidden. Admin access required." });
  }

  req.employeeRole = employee.role;
  next();
}

// ── Sanitize strings used in Google Drive API queries ────────────────────────
function sanitizeDriveQuery(value) {
  return String(value).replace(/'/g, "\\'").replace(/[^\w\s.\-]/g, "");
}

// Google Drive OAuth2 setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});
const drive = google.drive({ version: "v3", auth: oauth2Client });

const upload = multer({ storage: multer.memoryStorage() });

// ── Health check (public) ─────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "MPDO Alubijid Backend",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ── Ping (public) ─────────────────────────────────────────────────────────────
app.get("/api/ping", (_req, res) => {
  res.json({ message: "pong" });
});

// ── Update own profile (authenticated, can only update own record) ────────────
app.post("/api/user/update-profile", requireAuth, async (req, res) => {
  const { id, name, department, personal_email } = req.body;
  if (!id || !name) {
    return res.status(400).json({ error: "Employee id and name are required." });
  }

  // Verify the authenticated user owns this employee record
  const { data: employee, error: empErr } = await supabaseAdmin
    .from("employees")
    .select("email")
    .eq("id", id)
    .single();

  if (empErr || !employee) {
    return res.status(404).json({ error: "Employee record not found." });
  }

  if (employee.email !== req.authUser.email) {
    return res.status(403).json({ error: "Forbidden. You can only update your own profile." });
  }

  const updates = { name, department };
  if (personal_email !== undefined) updates.personal_email = personal_email || null;

  const { data, error } = await supabaseAdmin
    .from("employees")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message || "Unable to update profile." });
  }

  return res.json({ success: true, profile: data });
});

// ── Change own password (authenticated, can only change own password) ─────────
app.post("/api/user/change-password", requireAuth, async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ error: "Email and new password are required." });
  }

  // Users can only change their own password
  if (email !== req.authUser.email) {
    return res.status(403).json({ error: "Forbidden. You can only change your own password." });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(req.authUser.id, {
    password: newPassword,
  });

  if (updateErr) {
    return res.status(500).json({ error: "Failed to change password." });
  }

  return res.json({ success: true });
});

// ── Get or create a folder by name inside a given parent ─────────────────────
async function getOrCreateFolderIn(name, parentId) {
  const safeName = sanitizeDriveQuery(name);
  const safeParent = sanitizeDriveQuery(parentId);
  const search = await drive.files.list({
    q: `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and '${safeParent}' in parents and trashed=false`,
    fields: "files(id)",
  });
  if (search.data.files.length > 0) return search.data.files[0].id;

  const folder = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id",
  });
  return folder.data.id;
}

// ── Get current month folder name (e.g. "2026-04 - April 2026") ──────────────
function getMonthFolderName(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const monthName = date.toLocaleString("en-US", { month: "long" });
  return `${year}-${month} - ${monthName} ${year}`;
}

// ── Get or create: Root → Month → Document folder ────────────────────────────
async function getOrCreateFolder(documentId, date = new Date()) {
  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const monthName = getMonthFolderName(date);
  const monthFolderId = await getOrCreateFolderIn(monthName, rootId);
  const docFolderId = await getOrCreateFolderIn(documentId, monthFolderId);
  return docFolderId;
}

// ── Helper: initiate resumable upload session ─────────────────────────────────
function initResumableUpload(token, fileName, mimeType, folderId) {
  return new Promise((resolve, reject) => {
    const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
    const options = {
      hostname: "www.googleapis.com",
      path: "/upload/drive/v3/files?uploadType=resumable",
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "Content-Length": Buffer.byteLength(metadata),
        "X-Upload-Content-Type": mimeType || "application/octet-stream",
      },
    };
    const req = https.request(options, (response) => {
      const location = response.headers["location"];
      if (location) resolve(location);
      else reject(new Error(`No Location header. Status: ${response.statusCode}`));
    });
    req.on("error", reject);
    req.write(metadata);
    req.end();
  });
}

// ── Upload file to Google Drive (authenticated) ───────────────────────────────
app.post("/api/upload", requireAuth, uploadLimiter, async (req, res) => {
  try {
    const { documentId, fileName, mimeType, fileBase64 } = req.body;
    if (!fileBase64) return res.status(400).json({ error: "No file provided" });
    if (!documentId) return res.status(400).json({ error: "No documentId provided" });
    if (!fileName) return res.status(400).json({ error: "No fileName provided" });

    // Validate file size (max 20MB base64 ≈ 15MB file)
    if (fileBase64.length > 20 * 1024 * 1024) {
      return res.status(400).json({ error: "File too large. Maximum size is 15MB." });
    }

    const buffer = Buffer.from(fileBase64, "base64");
    const folderId = await getOrCreateFolder(documentId);

    const driveRes = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType: mimeType || "application/octet-stream", body: Readable.from([buffer]) },
      fields: "id, webViewLink",
    });

    // Restrict access to the organization's Google domain only (not public)
    try {
      await drive.permissions.create({
        fileId: driveRes.data.id,
        requestBody: { role: "reader", type: "domain", domain: "alubijid.gov.ph" },
      });
    } catch {
      // Fallback: keep file private if domain sharing fails
      console.warn("Domain permission failed — file remains private to uploader.");
    }

    res.json({ fileId: driveRes.data.id, url: driveRes.data.webViewLink });
  } catch (err) {
    console.error("Upload error:", err.message);
    res.status(500).json({ error: "Upload failed." });
  }
});

// ── Step 1: Get resumable upload URL (authenticated) ─────────────────────────
app.post("/api/get-upload-url", requireAuth, uploadLimiter, async (req, res) => {
  try {
    const { documentId, fileName, mimeType } = req.body;
    if (!documentId || !fileName) return res.status(400).json({ error: "Missing fields" });

    const folderId = await getOrCreateFolder(documentId);
    const { token } = await oauth2Client.getAccessToken();
    if (!token) return res.status(500).json({ error: "Failed to get OAuth token" });

    const uploadUrl = await initResumableUpload(token, fileName, mimeType, folderId);
    res.json({ uploadUrl });
  } catch (err) {
    console.error("Get upload URL error:", err.message);
    res.status(500).json({ error: "Failed to initiate upload." });
  }
});

// ── Step 2: Make file accessible after browser uploads to Drive (authenticated)
app.post("/api/upload-complete", requireAuth, async (req, res) => {
  try {
    const { fileId } = req.body;
    if (!fileId) return res.status(400).json({ error: "Missing fileId" });

    // Restrict to organization domain only
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: "reader", type: "domain", domain: "alubijid.gov.ph" },
      });
    } catch {
      console.warn("Domain permission failed — file remains private.");
    }

    const file = await drive.files.get({ fileId, fields: "webViewLink" });
    res.json({ url: file.data.webViewLink });
  } catch (err) {
    console.error("Upload complete error:", err.message);
    res.status(500).json({ error: "Failed to finalize upload." });
  }
});

// ── Delete Google Drive folder (admin or head staff only) ─────────────────────
app.delete("/api/delete-folder/:documentId", requireAuth, requireAdminOrHead, async (req, res) => {
  try {
    const { documentId } = req.params;
    const safeDocId = sanitizeDriveQuery(documentId);

    const search = await drive.files.list({
      q: `name='${safeDocId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id)",
    });

    if (!search.data.files || search.data.files.length === 0) {
      return res.json({ success: true, message: "No folder found" });
    }

    const folderId = search.data.files[0].id;
    await drive.files.delete({ fileId: folderId });

    res.json({ success: true });
  } catch (err) {
    console.error("Delete folder error:", err.message);
    res.status(500).json({ error: "Failed to delete folder." });
  }
});

// ── Archive a completed document (admin or head staff only) ───────────────────
app.post("/api/archive-document", requireAuth, requireAdminOrHead, async (req, res) => {
  try {
    const { documentId, archivedDate } = req.body;
    if (!documentId) return res.status(400).json({ error: "documentId required" });

    const { error: dbErr } = await supabaseAdmin
      .from("documents")
      .update({ archived: true, updated_at: new Date().toISOString() })
      .eq("id", documentId);
    if (dbErr) return res.status(500).json({ error: dbErr.message });

    try {
      const date = archivedDate ? new Date(archivedDate) : new Date();
      const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      const completedFolderId = await getOrCreateFolderIn("Completed", rootId);
      const monthFolderId = await getOrCreateFolderIn(getMonthFolderName(date), completedFolderId);

      const safeDocId = sanitizeDriveQuery(documentId);
      const search = await drive.files.list({
        q: `name='${safeDocId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id, parents)",
      });

      if (search.data.files && search.data.files.length > 0) {
        const docFolder = search.data.files[0];
        const oldParentId = docFolder.parents ? docFolder.parents[0] : null;
        await drive.files.update({
          fileId: docFolder.id,
          addParents: monthFolderId,
          removeParents: oldParentId || undefined,
          fields: "id, parents",
        });
      }
    } catch (driveErr) {
      console.error("Drive move error (non-fatal):", driveErr.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Archive error:", err.message);
    res.status(500).json({ error: "Failed to archive document." });
  }
});

// ── Check if email is registered (public — needed for signup flow) ─────────────
app.post("/api/check-email", authLimiter, async (req, res) => {
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
app.post("/api/create-account", authLimiter, async (req, res) => {
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

  const { error } = await supabaseAdmin.auth.admin.createUser({
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

// ── Delete employee (admin only) ──────────────────────────────────────────────
app.delete("/api/delete-employee/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Employee ID required." });

  const { data: employee, error: empError } = await supabaseAdmin
    .from("employees")
    .select("email")
    .eq("id", id)
    .single();

  if (empError || !employee) {
    return res.status(404).json({ error: "Employee not found." });
  }

  // Prevent deleting yourself
  if (employee.email === req.authUser.email) {
    return res.status(400).json({ error: "You cannot delete your own account." });
  }

  const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) {
    return res.status(500).json({ error: "Failed to look up auth users." });
  }

  const authUser = users.find((user) => user.email === employee.email);
  if (authUser) {
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
    if (deleteErr) {
      return res.status(500).json({ error: "Failed to delete auth account." });
    }
  }

  await supabaseAdmin
    .from("documents")
    .update({ assigned_to: null })
    .eq("assigned_to", employee.email);

  const { error: deleteEmployeeError } = await supabaseAdmin
    .from("employees")
    .delete()
    .eq("id", id);

  if (deleteEmployeeError) {
    return res.status(500).json({ error: "Failed to delete employee record." });
  }

  res.json({ success: true });
});

// ── Send OTP for password reset ───────────────────────────────────────────────
app.post("/api/send-otp", otpLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  const { data: employee, error: empErr } = await supabaseAdmin
    .from("employees")
    .select("email, personal_email, name")
    .eq("personal_email", email.toLowerCase().trim())
    .single();

  if (empErr || !employee || !employee.personal_email) {
    // Generic message to prevent email enumeration
    return res.json({ success: true });
  }

  const sendTo = employee.personal_email;

  // Generate 8-digit OTP using crypto (more secure than Math.random)
  const otp = String(crypto.randomInt(10000000, 99999999));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await supabaseAdmin.from("otp_tokens").delete().eq("email", sendTo);

  const { error: insertErr } = await supabaseAdmin.from("otp_tokens").insert({
    phone: "",
    email: sendTo,
    otp,
    expires_at: expiresAt,
  });

  if (insertErr) return res.status(500).json({ error: "Failed to generate OTP." });

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (emailUser && emailPass) {
    try {
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || "smtp.gmail.com",
        port: parseInt(process.env.EMAIL_PORT || "587"),
        secure: false,
        auth: { user: emailUser, pass: emailPass },
      });

      await transporter.sendMail({
        from: `"MPDO Document Tracking" <${emailUser}>`,
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

      console.log(`[OTP] Sent to ${sendTo}`);
      res.json({ success: true });
    } catch (mailErr) {
      console.error("[OTP] Email send failed:", mailErr.message);
      res.status(500).json({ error: "Failed to send OTP email." });
    }
  } else {
    // Development mode — log to server console only, never send in response
    console.log(`[OTP DEV] Code for ${sendTo}: ${otp}`);
    res.json({ success: true });
  }
});

// ── Verify OTP ────────────────────────────────────────────────────────────────
app.post("/api/verify-otp", otpLimiter, async (req, res) => {
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

  // Generate a cryptographically secure reset token
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
app.post("/api/reset-password", otpLimiter, async (req, res) => {
  const { resetToken, password, email } = req.body;
  if (!resetToken || !password || !email) {
    return res.status(400).json({ error: "Token, email and password required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  // Require both email AND token — prevents token-only guessing
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

  const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) return res.status(500).json({ error: "Failed to look up user." });

  const authUser = users.find((u) => u.email === token.email);
  if (!authUser) return res.status(404).json({ error: "Auth account not found." });

  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, { password });
  if (updateErr) return res.status(500).json({ error: "Failed to reset password." });

  await supabaseAdmin.from("otp_tokens").update({ used: true }).eq("id", token.id);

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`MPDO Backend running on http://localhost:${PORT}`);
});

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { google } = require("googleapis");
const { Readable } = require("stream");
const https = require("https");
const { createClient } = require("@supabase/supabase-js");

// Supabase admin client (service role)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "MPDO Alubijid Backend",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ── Ping ──────────────────────────────────────────────────────────────────────
app.get("/api/ping", (_req, res) => {
  res.json({ message: process.env.PING_MESSAGE || "pong" });
});

// ── Get or create a subfolder by document ID ─────────────────────────────────
async function getOrCreateFolder(documentId) {
  const parentId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  // Check if folder already exists
  const search = await drive.files.list({
    q: `name='${documentId}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: "files(id)",
  });

  if (search.data.files.length > 0) {
    return search.data.files[0].id;
  }

  // Create the folder
  const folder = await drive.files.create({
    requestBody: {
      name: documentId,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });

  return folder.data.id;
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

// ── Test Google Drive connection ──────────────────────────────────────────────
app.get("/api/test-drive", async (_req, res) => {
  try {
    const { token } = await oauth2Client.getAccessToken();
    if (!token) return res.status(500).json({ ok: false, error: "Could not get access token — check GOOGLE_REFRESH_TOKEN" });
    const list = await drive.files.list({ pageSize: 1, fields: "files(id,name)" });
    res.json({ ok: true, tokenOk: true, sample: list.data.files });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Upload file to Google Drive (multipart form) ─────────────────────────────
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    const { documentId } = req.body;
    if (!documentId) return res.status(400).json({ error: "No documentId provided" });

    console.log(`Uploading "${req.file.originalname}" (${req.file.size} bytes) for document ${documentId}`);

    const folderId = await getOrCreateFolder(documentId);
    console.log(`Drive folder ID: ${folderId}`);

    // Wrap buffer in array so Readable emits the whole chunk at once (not byte-by-byte)
    const driveRes = await drive.files.create({
      requestBody: { name: req.file.originalname, parents: [folderId] },
      media: { mimeType: req.file.mimetype, body: Readable.from([req.file.buffer]) },
      fields: "id, webViewLink",
    });

    console.log(`Uploaded to Drive. File ID: ${driveRes.data.id}`);

    await drive.permissions.create({
      fileId: driveRes.data.id,
      requestBody: { role: "reader", type: "anyone" },
    });

    res.json({ fileId: driveRes.data.id, url: driveRes.data.webViewLink });
  } catch (err) {
    console.error("Upload error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Step 1: Get resumable upload URL ─────────────────────────────────────────
app.post("/api/get-upload-url", async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ── Step 2: Make file public after browser uploads to Drive ───────────────────
app.post("/api/upload-complete", async (req, res) => {
  try {
    const { fileId } = req.body;
    if (!fileId) return res.status(400).json({ error: "Missing fileId" });

    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    const file = await drive.files.get({ fileId, fields: "webViewLink" });
    res.json({ url: file.data.webViewLink });
  } catch (err) {
    console.error("Upload complete error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Delete Google Drive folder for a document ────────────────────────────────
app.delete("/api/delete-folder/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const parentId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    const search = await drive.files.list({
      q: `name='${documentId}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
      fields: "files(id)",
    });

    if (search.data.files.length === 0) {
      return res.json({ success: true, message: "No folder found" });
    }

    const folderId = search.data.files[0].id;
    await drive.files.delete({ fileId: folderId });

    res.json({ success: true });
  } catch (err) {
    console.error("Delete folder error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Check if email is registered by admin ─────────────────────────────────────
app.post("/api/check-email", async (req, res) => {
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

// ── Create account for verified staff ─────────────────────────────────────────
app.post("/api/create-account", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  // Double-check email is in employees table
  const { data: employee } = await supabaseAdmin
    .from("employees")
    .select("id")
    .eq("email", email)
    .single();

  if (!employee) {
    return res.status(403).json({ error: "Email not registered by admin" });
  }

  // Create Supabase auth account (auto-confirmed)
  const { error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) return res.status(400).json({ error: error.message });

  // Update name and personal email in employees table
  const updates = {};
  if (name) updates.name = name;
  if (req.body.personalEmail) updates.personal_email = req.body.personalEmail;
  if (Object.keys(updates).length > 0) {
    await supabaseAdmin.from("employees").update(updates).eq("email", email);
  }

  res.json({ success: true });
});

// ── Delete employee record and Supabase auth user by employee ID ────────────
app.delete("/api/delete-employee/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Employee ID required." });

  const { data: employee, error: empError } = await supabaseAdmin
    .from("employees")
    .select("email")
    .eq("id", id)
    .single();

  if (empError || !employee) {
    return res.status(404).json({ error: empError?.message || "Employee not found." });
  }

  const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) {
    return res.status(500).json({ error: "Failed to look up auth users." });
  }

  const authUser = users.find((user) => user.email === employee.email);
  if (authUser) {
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
    if (deleteErr) {
      return res.status(500).json({ error: deleteErr.message });
    }
  }

  const { error: deleteEmployeeError } = await supabaseAdmin
    .from("employees")
    .delete()
    .eq("id", id);

  if (deleteEmployeeError) {
    return res.status(500).json({ error: deleteEmployeeError.message });
  }

  res.json({ success: true });
});

// ── Send OTP for password reset (email-based) ────────────────────────────────
app.post("/api/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  // Look up employee by personal_email
  const { data: employee, error: empErr } = await supabaseAdmin
    .from("employees")
    .select("email, personal_email, name")
    .eq("personal_email", email.toLowerCase().trim())
    .single();

  if (empErr || !employee || !employee.personal_email) {
    return res.status(404).json({ error: "No account found with this personal email address." });
  }

  const sendTo = employee.personal_email;

  // Generate 6-digit OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  // Invalidate any existing OTPs for this personal email
  await supabaseAdmin.from("otp_tokens").delete().eq("email", sendTo);

  // Store OTP keyed by personal_email
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

      console.log(`[OTP] Sent via email to ${sendTo}`);
      res.json({ success: true });
    } catch (mailErr) {
      console.error("[OTP] Email send failed:", mailErr.message);
      res.status(500).json({ error: `Email failed: ${mailErr.message}` });
    }
  } else {
    // Development mode — return OTP so UI can display it
    console.log(`[OTP DEV] Personal email: ${sendTo} | Code: ${otp}`);
    res.json({ success: true, devOtp: otp });
  }
});

// ── Verify OTP ────────────────────────────────────────────────────────────────
app.post("/api/verify-otp", async (req, res) => {
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

  // Mark OTP as used
  await supabaseAdmin.from("otp_tokens").update({ used: true }).eq("id", token.id);

  // Generate a short-lived reset token
  const resetToken = require("crypto").randomBytes(32).toString("hex");
  const resetExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

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
app.post("/api/reset-password", async (req, res) => {
  const { resetToken, password } = req.body;
  if (!resetToken || !password) return res.status(400).json({ error: "Token and password required" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

  const { data: token, error } = await supabaseAdmin
    .from("otp_tokens")
    .select("*")
    .eq("otp", resetToken)
    .eq("used", false)
    .single();

  if (error || !token) return res.status(400).json({ error: "Invalid or expired reset token." });

  if (new Date(token.expires_at) < new Date()) {
    return res.status(400).json({ error: "Reset token has expired. Please start over." });
  }

  // Get the Supabase auth user by email
  const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) return res.status(500).json({ error: "Failed to look up user." });

  const authUser = users.find((u) => u.email === token.email);
  if (!authUser) return res.status(404).json({ error: "Auth account not found." });

  // Update password
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, { password });
  if (updateErr) return res.status(500).json({ error: updateErr.message });

  // Invalidate the reset token
  await supabaseAdmin.from("otp_tokens").update({ used: true }).eq("id", token.id);

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`MPDO Backend running on http://localhost:${PORT}`);
});

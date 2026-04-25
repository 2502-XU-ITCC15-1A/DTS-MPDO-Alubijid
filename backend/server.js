require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { google } = require("googleapis");
const { Readable } = require("stream");
const { createClient } = require("@supabase/supabase-js");

// Supabase admin client (service role)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Multer — store file in memory before uploading to Drive
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

// ── Upload file to Google Drive (JSON base64) ────────────────────────────────
app.post("/api/upload", async (req, res) => {
  try {
    const { documentId, fileName, mimeType, fileBase64 } = req.body;
    if (!fileBase64) return res.status(400).json({ error: "No file provided" });
    if (!documentId) return res.status(400).json({ error: "No documentId provided" });

    const buffer = Buffer.from(fileBase64, "base64");
    const folderId = await getOrCreateFolder(documentId);

    const driveRes = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType, body: Readable.from(buffer) },
      fields: "id, webViewLink",
    });

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

  // Update name in employees table
  if (name) {
    await supabaseAdmin.from("employees").update({ name }).eq("email", email);
  }

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`MPDO Backend running on http://localhost:${PORT}`);
});

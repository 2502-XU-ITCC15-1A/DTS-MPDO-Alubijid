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

// ── Step 1: Get resumable upload URL ─────────────────────────────────────────
app.post("/api/get-upload-url", async (req, res) => {
  try {
    const { documentId, fileName, mimeType } = req.body;
    if (!documentId || !fileName) return res.status(400).json({ error: "Missing fields" });

    const folderId = await getOrCreateFolder(documentId);
    const initRes = await oauth2Client.request({
      url: "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Upload-Content-Type": mimeType || "application/octet-stream",
      },
      data: { name: fileName, parents: [folderId] },
      responseType: "json",
    });

    const uploadUrl = initRes.headers?.location || initRes.headers?.Location;
    if (!uploadUrl) return res.status(500).json({ error: "No upload URL from Google Drive" });

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

  // Update name in employees table
  if (name) {
    await supabaseAdmin.from("employees").update({ name }).eq("email", email);
  }

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`MPDO Backend running on http://localhost:${PORT}`);
});

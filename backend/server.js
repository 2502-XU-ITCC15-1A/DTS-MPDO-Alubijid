require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { google } = require("googleapis");
const { Readable } = require("stream");

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

// ── Upload file to Google Drive ───────────────────────────────────────────────
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const documentId = req.body.documentId;
    if (!file) return res.status(400).json({ error: "No file provided" });
    if (!documentId) return res.status(400).json({ error: "No documentId provided" });

    // Get or create subfolder named after the document ID
    const folderId = await getOrCreateFolder(documentId);

    // Upload file into that subfolder
    const driveRes = await drive.files.create({
      requestBody: {
        name: file.originalname,
        parents: [folderId],
      },
      media: {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer),
      },
      fields: "id, webViewLink",
    });

    // Make file viewable by anyone with the link
    await drive.permissions.create({
      fileId: driveRes.data.id,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    res.json({
      fileId: driveRes.data.id,
      url: driveRes.data.webViewLink,
    });
  } catch (err) {
    console.error("Upload error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`MPDO Backend running on http://localhost:${PORT}`);
});

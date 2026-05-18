const express = require("express");
const path = require("path");
const { Readable } = require("stream");
const router = express.Router();

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "doc", "docx", "docm", "dot", "dotx",
  "xls", "xlsx", "xlsm", "csv",
  "ppt", "pptx", "pptm", "pps", "ppsx",
  "odt", "ods", "odp",
  "txt", "rtf",
  "gdoc", "gsheet", "gslides",
  "png", "jpg", "jpeg",
]);

const ALLOWED_MIMETYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  "application/vnd.ms-word.document.macroEnabled.12",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "text/csv",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
  "application/vnd.ms-powerpoint.presentation.macroEnabled.12",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "text/plain",
  "application/rtf",
  "image/png",
  "image/jpeg",
]);

function isAllowedFile(fileName, mimeType) {
  const ext = path.extname(fileName).replace(".", "").toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) || ALLOWED_MIMETYPES.has(mimeType);
}
const { drive, oauth2Client } = require("../config/drive");
const { requireAuth, requireAdminOrHead } = require("../middleware/auth");
const { uploadLimiter } = require("../config/limiters");
const {
  sanitizeDriveQuery,
  getOrCreateFolder,
  getOrCreateFolderIn,
  getMonthFolderName,
  initResumableUpload,
} = require("../utils/driveHelpers");
const { supabaseAdmin } = require("../config/supabase");

// ── Upload file to Google Drive ───────────────────────────────────────────────
router.post("/upload", requireAuth, uploadLimiter, async (req, res) => {
  try {
    const { documentId, fileName, mimeType, fileBase64 } = req.body;
    if (!fileBase64) return res.status(400).json({ error: "No file provided" });
    if (!documentId) return res.status(400).json({ error: "No documentId provided" });
    if (!fileName) return res.status(400).json({ error: "No fileName provided" });

    if (!isAllowedFile(fileName, mimeType)) {
      return res.status(400).json({ error: "File type not allowed. Only PDF, Word, Excel, PowerPoint, and text documents are accepted." });
    }

    const buffer = Buffer.from(fileBase64, "base64");
    if (buffer.length > 15 * 1024 * 1024) {
      return res.status(400).json({ error: "File too large. Maximum size is 15MB." });
    }
    const folderId = await getOrCreateFolder(documentId);

    const driveRes = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType: mimeType || "application/octet-stream", body: Readable.from([buffer]) },
      fields: "id, webViewLink",
    });

    try {
      await drive.permissions.create({
        fileId: driveRes.data.id,
        requestBody: { role: "reader", type: "anyone" },
      });
    } catch {
      console.warn("Permission set failed — file may not be viewable.");
    }

    res.json({ fileId: driveRes.data.id, url: driveRes.data.webViewLink });
  } catch (err) {
    console.error("Upload error:", err.message);
    res.status(500).json({ error: "Upload failed." });
  }
});

// ── Step 1: Get resumable upload URL ─────────────────────────────────────────
router.post("/get-upload-url", requireAuth, uploadLimiter, async (req, res) => {
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

// ── Step 2: Make file accessible after browser uploads to Drive ───────────────
router.post("/upload-complete", requireAuth, async (req, res) => {
  try {
    const { fileId } = req.body;
    if (!fileId) return res.status(400).json({ error: "Missing fileId" });

    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: "reader", type: "anyone" },
      });
    } catch {
      console.warn("Permission set failed — file remains private.");
    }

    const file = await drive.files.get({ fileId, fields: "webViewLink" });
    res.json({ url: file.data.webViewLink });
  } catch (err) {
    console.error("Upload complete error:", err.message);
    res.status(500).json({ error: "Failed to finalize upload." });
  }
});

// ── Delete Google Drive folder (admin or head staff only) ─────────────────────
router.delete("/delete-folder/:documentId", requireAuth, requireAdminOrHead, async (req, res) => {
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
router.post("/archive-document", requireAuth, requireAdminOrHead, async (req, res) => {
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

module.exports = router;

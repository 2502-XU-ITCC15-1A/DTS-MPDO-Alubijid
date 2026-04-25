import serverless from "serverless-http";
import express from "express";
import cors from "cors";
import { google } from "googleapis";
import { Readable } from "stream";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: "v3", auth: oauth2Client });

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Check if email is registered by admin
app.post("/api/check-email", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  const { data, error } = await supabaseAdmin
    .from("employees")
    .select("id, name, department")
    .eq("email", email)
    .single();

  if (error || !data) return res.json({ valid: false });
  res.json({ valid: true, name: data.name, department: data.department });
});

// Create account for verified staff
app.post("/api/create-account", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const { data: employee } = await supabaseAdmin
    .from("employees")
    .select("id")
    .eq("email", email)
    .single();

  if (!employee) return res.status(403).json({ error: "Email not registered by admin" });

  const { error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) return res.status(400).json({ error: error.message });

  if (name) {
    await supabaseAdmin.from("employees").update({ name }).eq("email", email);
  }

  res.json({ success: true });
});

// Get or create a subfolder by document ID in Google Drive
async function getOrCreateFolder(documentId: string) {
  const parentId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const search = await drive.files.list({
    q: `name='${documentId}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: "files(id)",
  });
  if (search.data.files!.length > 0) return search.data.files![0].id;

  const folder = await drive.files.create({
    requestBody: {
      name: documentId,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId!],
    },
    fields: "id",
  });
  return folder.data.id;
}

// Step 1 — Get a resumable Google Drive upload URL (browser uploads directly to Drive)
app.post("/api/get-upload-url", async (req, res) => {
  try {
    const { documentId, fileName, mimeType } = req.body;
    if (!documentId || !fileName) return res.status(400).json({ error: "Missing fields" });

    const folderId = await getOrCreateFolder(documentId);
    const token = await oauth2Client.getAccessToken();

    // Initiate a resumable upload session with Google Drive
    const initRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.token}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": mimeType,
        },
        body: JSON.stringify({ name: fileName, parents: [folderId] }),
      }
    );

    if (!initRes.ok) {
      const err = await initRes.text();
      return res.status(500).json({ error: err });
    }

    const uploadUrl = initRes.headers.get("location");
    res.json({ uploadUrl, folderId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Step 2 — After browser uploads to Drive, set file public and return view link
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Google Drive folder for a document
app.delete("/api/delete-folder/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const parentId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    const search = await drive.files.list({
      q: `name='${documentId}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
      fields: "files(id)",
    });

    if (!search.data.files || search.data.files.length === 0) {
      return res.json({ success: true, message: "No folder found" });
    }

    const folderId = search.data.files[0].id!;
    await drive.files.delete({ fileId: folderId });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export const handler = serverless(app);

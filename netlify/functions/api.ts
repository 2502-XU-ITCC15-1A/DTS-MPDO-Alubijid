import serverless from "serverless-http";
import express from "express";
import cors from "cors";
import multer from "multer";
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

const upload = multer({ storage: multer.memoryStorage() });

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

// Delete employee record and auth user by employee id
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

  const { data: userList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) {
    return res.status(500).json({ error: "Failed to look up auth users." });
  }

  const authUser = userList.users?.find((user) => user.email === employee.email);
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

// Get or create a folder by name inside a given parent
async function getOrCreateFolderIn(name: string, parentId: string): Promise<string> {
  const search = await drive.files.list({
    q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: "files(id)",
  });
  if (search.data.files!.length > 0) return search.data.files![0].id!;

  const folder = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id",
  });
  return folder.data.id!;
}

function getMonthFolderName(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const monthName = date.toLocaleString("en-US", { month: "long" });
  return `${year}-${month} - ${monthName} ${year}`;
}

// Get or create: Root → Month → Document folder
async function getOrCreateFolder(documentId: string, date = new Date()): Promise<string> {
  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
  const monthName = getMonthFolderName(date);
  const monthFolderId = await getOrCreateFolderIn(monthName, rootId);
  return await getOrCreateFolderIn(documentId, monthFolderId);
}

// Upload file to Google Drive (multipart form)
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    const { documentId } = req.body;
    if (!documentId) return res.status(400).json({ error: "No documentId provided" });

    const folderId = await getOrCreateFolder(documentId);

    const driveRes = await drive.files.create({
      requestBody: { name: req.file.originalname, parents: [folderId!] },
      media: { mimeType: req.file.mimetype, body: Readable.from([req.file.buffer]) },
      fields: "id, webViewLink",
    });

    await drive.permissions.create({
      fileId: driveRes.data.id!,
      requestBody: { role: "reader", type: "anyone" },
    });

    res.json({ fileId: driveRes.data.id, url: driveRes.data.webViewLink });
  } catch (err: any) {
    console.error("Upload error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete Google Drive folder for a document (searches across all month folders)
app.delete("/api/delete-folder/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;

    const search = await drive.files.list({
      q: `name='${documentId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
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

// Archive a completed document: flag in Supabase + move Drive folder
app.post("/api/archive-document", async (req, res) => {
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
      const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
      const completedFolderId = await getOrCreateFolderIn("Completed", rootId);
      const monthFolderId = await getOrCreateFolderIn(getMonthFolderName(date), completedFolderId);

      const search = await drive.files.list({
        q: `name='${documentId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id, parents)",
      });

      if (search.data.files && search.data.files.length > 0) {
        const docFolder = search.data.files[0];
        const oldParentId = docFolder.parents ? docFolder.parents[0] : undefined;

        await drive.files.update({
          fileId: docFolder.id!,
          addParents: monthFolderId,
          removeParents: oldParentId,
          fields: "id, parents",
        });
      }
    } catch (driveErr: any) {
      console.error("Drive move error (non-fatal):", driveErr.message);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export const handler = serverless(app, {
  binary: ["multipart/form-data", "application/octet-stream", "image/*", "application/pdf"],
});

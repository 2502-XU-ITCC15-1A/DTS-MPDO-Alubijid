const https = require("https");
const { drive } = require("../config/drive");

function sanitizeDriveQuery(value) {
  return String(value).replace(/'/g, "\\'").replace(/[^\w\s.\-]/g, "");
}

function getMonthFolderName(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const monthName = date.toLocaleString("en-US", { month: "long" });
  return `${year}-${month} - ${monthName} ${year}`;
}

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

async function getOrCreateFolder(documentId, date = new Date()) {
  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const monthName = getMonthFolderName(date);
  const monthFolderId = await getOrCreateFolderIn(monthName, rootId);
  const docFolderId = await getOrCreateFolderIn(documentId, monthFolderId);
  return docFolderId;
}

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

module.exports = {
  sanitizeDriveQuery,
  getMonthFolderName,
  getOrCreateFolderIn,
  getOrCreateFolder,
  initResumableUpload,
};

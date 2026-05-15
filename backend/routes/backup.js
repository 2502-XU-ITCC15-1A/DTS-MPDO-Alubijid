const express = require("express");
const { Readable } = require("stream");
const cron = require("node-cron");
const router = express.Router();
const { supabaseAdmin } = require("../config/supabase");
const { drive } = require("../config/drive");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { getOrCreateFolderIn } = require("../utils/driveHelpers");

const BACKUP_TABLES = ["employees", "documents", "document_files", "audit_logs", "otp_tokens"];

async function runBackup() {
  const startedAt = new Date();
  const label = startedAt.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  console.log(`[BACKUP] Starting backup at ${startedAt.toISOString()}...`);

  try {
    const snapshot = { backed_up_at: startedAt.toISOString(), tables: {} };

    for (const table of BACKUP_TABLES) {
      const { data, error } = await supabaseAdmin.from(table).select("*");
      if (error) {
        console.error(`[BACKUP] Failed to fetch table "${table}":`, error.message);
        snapshot.tables[table] = { error: error.message };
      } else {
        snapshot.tables[table] = data;
        console.log(`[BACKUP]   ${table}: ${data.length} rows`);
      }
    }

    const json = JSON.stringify(snapshot, null, 2);
    const buffer = Buffer.from(json, "utf-8");

    const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const backupRootId = await getOrCreateFolderIn("MPDO Backups", rootId);
    const monthLabel = `${startedAt.getFullYear()}-${String(startedAt.getMonth() + 1).padStart(2, "0")}`;
    const monthFolderId = await getOrCreateFolderIn(monthLabel, backupRootId);

    const fileName = `backup-${label}.json`;

    const driveRes = await drive.files.create({
      requestBody: { name: fileName, parents: [monthFolderId] },
      media: { mimeType: "application/json", body: Readable.from([buffer]) },
      fields: "id, webViewLink",
    });

    console.log(`[BACKUP] Saved to Google Drive: ${fileName} (${(buffer.length / 1024).toFixed(1)} KB)`);
    console.log(`[BACKUP] Drive link: ${driveRes.data.webViewLink}`);

    // Keep only the last 30 backups per month folder
    try {
      const list = await drive.files.list({
        q: `'${monthFolderId}' in parents and mimeType='application/json' and trashed=false`,
        orderBy: "createdTime asc",
        fields: "files(id, name, createdTime)",
      });
      const files = list.data.files || [];
      if (files.length > 30) {
        const toDelete = files.slice(0, files.length - 30);
        for (const f of toDelete) {
          await drive.files.delete({ fileId: f.id });
          console.log(`[BACKUP] Deleted old backup: ${f.name}`);
        }
      }
    } catch (cleanupErr) {
      console.warn("[BACKUP] Cleanup warning:", cleanupErr.message);
    }

    return {
      success: true,
      fileName,
      rows: Object.fromEntries(
        Object.entries(snapshot.tables).map(([t, d]) => [t, Array.isArray(d) ? d.length : "error"])
      ),
    };
  } catch (err) {
    console.error("[BACKUP] Backup failed:", err.message);
    throw err;
  }
}

// ── Manual backup trigger (admin only) ───────────────────────────────────────
router.post("/backup", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await runBackup();
    res.json(result);
  } catch (err) {
    console.error("[BACKUP ROUTE]", err.message);
    res.status(500).json({ error: "Backup failed: " + err.message });
  }
});

// ── Get backup history (admin only) ──────────────────────────────────────────
router.get("/backup/history", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    const backupRootSearch = await drive.files.list({
      q: `name='MPDO Backups' and mimeType='application/vnd.google-apps.folder' and '${rootId}' in parents and trashed=false`,
      fields: "files(id)",
    });

    if (!backupRootSearch.data.files || backupRootSearch.data.files.length === 0) {
      return res.json({ backups: [] });
    }

    const backupRootId = backupRootSearch.data.files[0].id;

    const list = await drive.files.list({
      q: `'${backupRootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
      orderBy: "name desc",
    });

    const monthFolders = list.data.files || [];
    const backups = [];

    for (const folder of monthFolders.slice(0, 3)) {
      const files = await drive.files.list({
        q: `'${folder.id}' in parents and mimeType='application/json' and trashed=false`,
        fields: "files(id, name, createdTime, size, webViewLink)",
        orderBy: "createdTime desc",
      });
      for (const f of files.data.files || []) {
        backups.push({
          id: f.id,
          name: f.name,
          createdAt: f.createdTime,
          size: f.size,
          url: f.webViewLink,
          month: folder.name,
        });
      }
    }

    res.json({ backups });
  } catch (err) {
    console.error("[BACKUP HISTORY]", err.message);
    res.status(500).json({ error: "Failed to fetch backup history." });
  }
});

// ── Scheduled daily backup at 11:00 PM Asia/Manila ───────────────────────────
cron.schedule("0 23 * * *", async () => {
  try {
    await runBackup();
  } catch (err) {
    console.error("[BACKUP CRON] Failed:", err.message);
  }
}, { timezone: "Asia/Manila" });

console.log("[BACKUP] Daily backup scheduled at 11:00 PM Asia/Manila");

module.exports = router;

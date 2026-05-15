/**
 * Run this once to upload the MPDO logo to Supabase Storage.
 * Usage: node scripts/upload-logo.js <path-to-logo.png>
 * Example: node scripts/upload-logo.js "C:\Users\Ethan\Desktop\mpdo-logo.png"
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const imagePath = process.argv[2];
if (!imagePath) {
  console.error("Usage: node scripts/upload-logo.js <path-to-image>");
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error("File not found:", imagePath);
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function uploadLogo() {
  const fileBuffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
  const fileName = "mpdo-logo" + ext;

  console.log(`Uploading ${fileName} to Supabase Storage...`);

  // Create bucket if it doesn't exist
  const { error: bucketErr } = await supabase.storage.createBucket("assets", {
    public: true,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/svg+xml"],
    fileSizeLimit: 5 * 1024 * 1024,
  });

  if (bucketErr && !bucketErr.message.includes("already exists")) {
    console.error("Bucket error:", bucketErr.message);
    process.exit(1);
  }

  // Upload file (upsert so re-running is safe)
  const { error: uploadErr } = await supabase.storage
    .from("assets")
    .upload(fileName, fileBuffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadErr) {
    console.error("Upload error:", uploadErr.message);
    process.exit(1);
  }

  // Get public URL
  const { data } = supabase.storage.from("assets").getPublicUrl(fileName);
  console.log("\n✅ Upload successful!");
  console.log("Public URL:", data.publicUrl);
  console.log("\nPaste this URL into your Login.tsx, Signup.tsx, and Dashboard.tsx");
  console.log(`Replace: src="/mpdo-logo.png"`);
  console.log(`With:    src="${data.publicUrl}"`);
}

uploadLogo().catch(console.error);

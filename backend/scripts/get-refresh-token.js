require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { google } = require("googleapis");
const http = require("http");
const url = require("url");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  "http://localhost:3001/oauth2callback"
);

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/gmail.send",
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  prompt: "consent",
});

console.log("\n=== STEP 1: Open this URL in your browser ===\n");
console.log(authUrl);
console.log("\n=== STEP 2: After authorizing, the token will appear below ===\n");

const server = http.createServer(async (req, res) => {
  const qs = new url.URL(req.url, "http://localhost:3001").searchParams;
  const code = qs.get("code");

  if (!code) {
    res.end("No code received.");
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.end("<h2>Success! Check your terminal for the refresh token.</h2>");
    console.log("\n✅ NEW REFRESH TOKEN:");
    console.log(tokens.refresh_token);
    console.log("\nCopy this value and update GOOGLE_REFRESH_TOKEN in Render.\n");
  } catch (err) {
    res.end("Error: " + err.message);
    console.error("Token exchange failed:", err.message);
  } finally {
    server.close();
  }
});

server.listen(3001, () => {
  console.log("Waiting for Google OAuth callback on http://localhost:3001...\n");
});

const fs = require("fs");
const path = require("path");

const apiUrl = (process.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
if (apiUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(apiUrl);
  } catch {
    throw new Error("VITE_API_URL must be an absolute HTTP(S) URL.");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("VITE_API_URL must use HTTP or HTTPS.");
  }
}

const output = `window.FRAUDLENS_CONFIG = Object.freeze({ apiUrl: ${JSON.stringify(apiUrl)} });\n`;
fs.writeFileSync(path.join(__dirname, "..", "public", "runtime-config.js"), output);
console.log(`Frontend API URL configured${apiUrl ? "." : " for same-origin requests."}`);

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const cliScript = resolve(
  fileURLToPath(new URL("..", import.meta.url)),
  "node_modules",
  "supabase",
  "dist",
  "supabase.js",
);
const status = JSON.parse(
  execFileSync(process.execPath, [cliScript, "status", "-o", "json"], {
    encoding: "utf8",
  }),
);
const headers = {
  Authorization: `Bearer ${status.SERVICE_ROLE_KEY}`,
  apikey: status.SERVICE_ROLE_KEY,
};

for (const bucket of ["assignment-files", "submissions"]) {
  const response = await fetch(`${status.API_URL}/storage/v1/bucket/${bucket}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Không xóa được bucket local ${bucket}: HTTP ${response.status}`);
  }

  console.log(`Đã dọn bucket legacy local: ${bucket}`);
}

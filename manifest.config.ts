import { defineManifest } from "@crxjs/vite-plugin";
import { loadEnv } from "vite";

const env = loadEnv(process.env.NODE_ENV ?? "production", process.cwd(), "");
const enableCloudSync = env.VITE_ENABLE_CLOUD_SYNC !== "false";

const hostPermissions = [
  "https://chatgpt.com/*",
  "https://chat.openai.com/*",
  "https://gemini.google.com/*",
  "https://aistudio.google.com/*",
];

if (enableCloudSync) {
  hostPermissions.push("http://127.0.0.1/*", "http://localhost/*");
}

export default defineManifest({
  manifest_version: 3,
  name: "Context Kit",
  version: "0.1.0",
  description:
    "Save AI conversations as reusable context packages and insert them into supported tools.",
  minimum_chrome_version: "114",
  permissions: ["storage", "sidePanel", "scripting", "activeTab", "tabs"],
  host_permissions: hostPermissions,
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  icons: {
    16: "icons/icon-16.png",
    32: "icons/icon-32.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png",
  },
  side_panel: {
    default_path: "src/sidepanel/index.html",
  },
  action: {
    default_title: "Context Kit",
    default_icon: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
    },
  },
  content_scripts: [
    {
      matches: [
        "https://chatgpt.com/*",
        "https://chat.openai.com/*",
        "https://gemini.google.com/*",
        "https://aistudio.google.com/*",
      ],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
});

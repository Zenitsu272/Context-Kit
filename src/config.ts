const env = import.meta.env;

export const appConfig = {
  enableCloudSync: env.VITE_ENABLE_CLOUD_SYNC !== "false",
  privacyPolicyUrl: env.VITE_PRIVACY_POLICY_URL?.trim() || "https://github.com/Zenitsu272/Context-Kit/blob/main/docs/PRIVACY_POLICY_DRAFT.md",
  supportUrl: env.VITE_SUPPORT_URL?.trim() || "https://github.com/Zenitsu272/Context-Kit/issues",
  officialSiteUrl: env.VITE_OFFICIAL_SITE_URL?.trim() || "https://github.com/Zenitsu272/Context-Kit",
  publishSafeBuild: env.VITE_PUBLISH_SAFE_BUILD === "true",
};

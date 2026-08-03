const env = import.meta.env;

export const appConfig = {
  enableCloudSync: env.VITE_ENABLE_CLOUD_SYNC !== "false",
  privacyPolicyUrl: env.VITE_PRIVACY_POLICY_URL?.trim() || "",
  supportUrl: env.VITE_SUPPORT_URL?.trim() || "",
  officialSiteUrl: env.VITE_OFFICIAL_SITE_URL?.trim() || "",
  publishSafeBuild: env.VITE_PUBLISH_SAFE_BUILD === "true",
};

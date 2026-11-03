import type { ContextAsset, ContextPackage } from "../types/context-package";

export function validatePackages(value: unknown): ContextPackage[] {
  const items = Array.isArray(value) ? value : [value];
  if (items.length > 1000)
    throw new Error("Import up to 1,000 packages at a time.");
  return items.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.title !== "string" ||
      !Array.isArray(item.messages)
    ) {
      throw new Error(
        "Invalid Context Kit backup: every package needs a title and messages.",
      );
    }
    const string = (value: unknown, limit = 500000) => {
      if (value == null) return "";
      if (typeof value !== "string" || value.length > limit)
        throw new Error("Backup contains an invalid or oversized text field.");
      return value;
    };
    const list = (value: unknown): string[] => {
      if (value == null) return [];
      if (!Array.isArray(value) || value.length > 500)
        throw new Error("Backup contains an invalid list.");
      return value.map((item) => string(item, 12000));
    };
    if (typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.id))
      throw new Error("Backup has an invalid package ID.");
    if (!["chatgpt", "gemini", "manual", "unsupported"].includes(item.platform))
      throw new Error("Backup has an invalid platform.");
    if (item.messages.length > 20000)
      throw new Error("Backup contains too many messages.");
    for (const date of [item.capturedAt, item.updatedAt]) {
      if (typeof date !== "string" || !Number.isFinite(Date.parse(date)))
        throw new Error("Backup has an invalid date.");
    }
    if (item.assets != null && !Array.isArray(item.assets))
      throw new Error("Invalid attachment list.");
    const assets: ContextAsset[] = (item.assets ?? []).map(
      (asset: ContextAsset) => {
        if (
          !asset ||
          typeof asset.id !== "string" ||
          !/^asset_[a-zA-Z0-9_-]{1,100}$/.test(asset.id) ||
          !["local", "reference"].includes(asset.source)
        )
          throw new Error("Invalid attachment.");
        if (
          !Number.isFinite(asset.size) ||
          asset.size < 0 ||
          asset.size > 20 * 1024 * 1024
        )
          throw new Error("Invalid attachment size.");
        if (asset.sourceUrl && !/^https?:\/\//i.test(asset.sourceUrl))
          throw new Error("Unsafe attachment link.");
        return {
          id: asset.id,
          name: string(asset.name, 500),
          size: asset.size,
          mimeType: string(asset.mimeType, 100),
          source: asset.source,
          sourceUrl: string(asset.sourceUrl, 12000) || undefined,
          text: string(asset.text, 120000) || undefined,
          extraction:
            asset.extraction === "gemini"
              ? "gemini"
              : asset.extraction === "local"
                ? "local"
                : undefined,
          warning: string(asset.warning, 3000) || undefined,
        };
      },
    );
    if (assets.length > 40)
      throw new Error("Too many attachments in a package.");
    return {
      id: item.id,
      title: string(item.title, 1000),
      platform: item.platform,
      sourceUrl: string(item.sourceUrl, 12000),
      capturedAt: item.capturedAt,
      updatedAt: item.updatedAt,
      summary: string(item.summary),
      notes: string(item.notes),
      keyDecisions: list(item.keyDecisions),
      constraints: list(item.constraints),
      openQuestions: list(item.openQuestions),
      tags: list(item.tags),
      reviewWarnings: list(item.reviewWarnings),
      sensitiveFindings: [],
      depth: ["brief", "detailed", "full"].includes(item.depth)
        ? item.depth
        : "detailed",
      extractionConfidence: ["high", "medium", "low"].includes(
        item.extractionConfidence,
      )
        ? item.extractionConfidence
        : "low",
      currentVersion:
        Number.isSafeInteger(item.currentVersion) && item.currentVersion > 0
          ? item.currentVersion
          : 1,
      messages: item.messages.map(
        (message: { role: string; content: unknown }, index: number) => {
          if (
            !message ||
            !["user", "assistant", "system"].includes(message.role)
          )
            throw new Error("Invalid message role.");
          return {
            id: `msg_${index}`,
            role: message.role,
            content: string(message.content),
            position: index + 1,
          };
        },
      ),
      assets,
    };
  });
}

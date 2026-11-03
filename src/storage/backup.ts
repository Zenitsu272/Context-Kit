import type { ContextPackage } from "../types/context-package";
import { validatePackages } from "../core/validation";
import { rescanDraft } from "../core/context";
import { blobToBase64, getAssetBlob, putAssetBlobs } from "./assets";

export async function exportBackup(packages: ContextPackage[]) {
  const files = [];
  let bytes = 0;
  const seen = new Set<string>();
  for (const item of packages)
    for (const asset of item.assets ?? []) {
      if (asset.source !== "local" || seen.has(asset.id)) continue;
      seen.add(asset.id);
      const blob = await getAssetBlob(asset.id);
      if (!blob)
        throw new Error(
          `Original missing for ${asset.name}. Reattach it before exporting a complete backup.`,
        );
      bytes += blob.size;
      if (bytes > 60 * 1024 * 1024)
        throw new Error(
          "Export files in smaller groups (60 MB maximum per backup).",
        );
      files.push({
        id: asset.id,
        mimeType: blob.type,
        data: await blobToBase64(blob),
      });
    }
  const output = JSON.stringify({
    format: "context-kit",
    version: 1,
    packages,
    files,
  });
  if (new Blob([output]).size > 100 * 1024 * 1024)
    throw new Error(
      "Export packages in smaller groups (100 MB maximum per backup).",
    );
  return output;
}

export async function readBackup(text: string): Promise<ContextPackage[]> {
  if (text.length > 100 * 1024 * 1024)
    throw new Error("Backup is too large (100 MB maximum).");
  const value = JSON.parse(text);
  const wrapped = value?.format === "context-kit";
  if (wrapped && value.version !== 1)
    throw new Error("Unsupported backup version.");
  const packages = validatePackages(wrapped ? value.packages : value).map(
    (item) => ({ ...item, ...rescanDraft(item) }),
  );
  const files: { id: string; blob: Blob }[] = [];
  const remap = new Map<string, string>();
  const incoming = wrapped ? value.files : [];
  if (!Array.isArray(incoming) || incoming.length > 500)
    throw new Error("Invalid backup files.");
  const expected = new Map(
    packages
      .flatMap((item) => item.assets ?? [])
      .filter((asset) => asset.source === "local")
      .map((asset) => [asset.id, asset]),
  );
  let totalBytes = 0;
  for (const file of incoming) {
    if (!file || typeof file !== "object")
      throw new Error("Invalid backup attachment.");
    const asset = expected.get(file.id);
    if (
      !asset ||
      remap.has(file.id) ||
      typeof file.data !== "string" ||
      file.data.length > 28 * 1024 * 1024 ||
      typeof file.mimeType !== "string"
    )
      throw new Error("Invalid backup attachment.");
    const bytes = Uint8Array.from(atob(file.data), (char) =>
      char.charCodeAt(0),
    );
    if (bytes.length !== asset.size)
      throw new Error("Attachment size does not match the backup.");
    totalBytes += bytes.length;
    if (totalBytes > 60 * 1024 * 1024)
      throw new Error("Backup files exceed the 60 MB limit.");
    const id = `asset_${crypto.randomUUID()}`;
    remap.set(file.id, id);
    files.push({ id, blob: new Blob([bytes], { type: asset.mimeType }) });
  }
  for (const asset of expected.values()) {
    if (!remap.has(asset.id))
      throw new Error(`Backup is missing the original file: ${asset.name}`);
  }
  for (const item of packages)
    for (const asset of item.assets ?? [])
      asset.id = remap.get(asset.id) ?? asset.id;
  if (files.length) await putAssetBlobs(files);
  return packages;
}

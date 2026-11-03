import type { ContextAsset } from "../types/context-package";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("context-kit-files", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(new Error("Could not open local file storage."));
    };
  }));
}

export async function putAssetBlobs(files: { id: string; blob: Blob }[]) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("files", "readwrite");
    for (const file of files)
      transaction
        .objectStore("files")
        .put({ blob: file.blob, createdAt: Date.now() }, file.id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        new Error(
          "File storage is full or unavailable. Export a backup before freeing space.",
        ),
      );
    transaction.onabort = () =>
      reject(new Error("Files could not be saved. Please try again."));
  });
}

export async function getAssetBlob(id: string): Promise<Blob | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("files").objectStore("files").get(id);
    request.onsuccess = () =>
      resolve(
        request.result instanceof Blob ? request.result : request.result?.blob,
      );
    request.onerror = () =>
      reject(new Error("Could not read the original file."));
  });
}

export async function removeUnusedAssetBlobs(keepIds: Set<string>) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("files", "readwrite");
    const store = transaction.objectStore("files");
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      // A grace period protects files being attached in another panel before its
      // debounced draft save, and recently removed files during undo/editing.
      const createdAt =
        cursor.value instanceof Blob ? 0 : cursor.value.createdAt;
      if (
        !keepIds.has(String(cursor.key)) &&
        createdAt < Date.now() - 24 * 60 * 60 * 1000
      )
        store.delete(cursor.key);
      cursor.continue();
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(new Error("Could not clear unused files."));
  });
}

export async function attachFile(file: File): Promise<ContextAsset> {
  if (file.size > MAX_FILE_SIZE)
    throw new Error(`${file.name} exceeds the 20 MB file limit.`);
  const extensionMime = /\.pdf$/i.test(file.name)
    ? "application/pdf"
    : /\.(txt|md|csv|json|log|py|js|ts|yaml|yml)$/i.test(file.name)
      ? "text/plain"
      : /\.png$/i.test(file.name)
        ? "image/png"
        : /\.jpe?g$/i.test(file.name)
          ? "image/jpeg"
          : /\.webp$/i.test(file.name)
            ? "image/webp"
            : /\.mp4$/i.test(file.name)
              ? "video/mp4"
              : /\.webm$/i.test(file.name)
                ? "video/webm"
                : /\.mov$/i.test(file.name)
                  ? "video/quicktime"
                  : "application/octet-stream";
  const mimeType =
    !file.type || file.type === "application/octet-stream"
      ? extensionMime
      : file.type;
  const blob = file.slice(0, file.size, mimeType);
  const asset: ContextAsset = {
    id: `asset_${crypto.randomUUID()}`,
    name: file.name,
    size: file.size,
    mimeType,
    source: "local",
  };
  if (mimeType === "application/pdf") {
    try {
      const { extractPdfText } = await import("../core/pdf");
      Object.assign(asset, await extractPdfText(blob));
      asset.extraction = "local";
    } catch {
      asset.warning =
        "PDF text could not be read locally (it may be scanned, protected or damaged). Try Read with Gemini, or upload the original to the next tool.";
    }
  } else if (
    (mimeType.startsWith("text/") || mimeType === "application/json") &&
    file.size <= 2 * 1024 * 1024
  ) {
    const text = await file.text();
    asset.text = text.slice(0, 120000);
    asset.extraction = "local";
    if (text.length > 120000)
      asset.warning =
        "Text limited to 120,000 characters. The complete original is saved.";
  }
  await putAssetBlobs([{ id: asset.id, blob }]);
  return asset;
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name.replace(/[\\/:*?"<>|]/g, "_");
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function downloadAsset(asset: ContextAsset) {
  const blob = await getAssetBlob(asset.id);
  if (!blob)
    throw new Error(
      "This attachment is a link only. Open the source, download the file, then attach it here.",
    );
  downloadBlob(blob, asset.name);
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read file bytes."));
    reader.readAsDataURL(blob);
  });
}

import { attachFile } from "../storage/assets";
import type { ContextAsset } from "../types/context-package";

export async function importLinkedFile(
  asset: ContextAsset,
): Promise<ContextAsset> {
  const url = new URL(asset.sourceUrl ?? "");
  if (url.protocol !== "https:")
    throw new Error(
      "Only HTTPS files can be imported. Download this file yourself and attach it here.",
    );
  // This function is invoked synchronously by the Import file click, preserving
  // the user gesture for Edge's origin-specific permission request.
  const granted = await chrome.permissions.request({
    origins: [`${url.origin}/*`],
  });
  if (!granted)
    throw new Error(
      "File access was not granted. You can still download and attach the file yourself.",
    );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url.href, {
      credentials: "include",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok || !response.body)
      throw new Error(
        "The file is unavailable or requires sign-in. Open its source and attach it manually.",
      );
    if (Number(response.headers.get("content-length")) > 20 * 1024 * 1024)
      throw new Error("This file exceeds the 20 MB limit.");
    const mimeType =
      response.headers.get("content-type")?.split(";")[0].trim() ??
      "application/octet-stream";
    if (mimeType === "text/html")
      throw new Error(
        "This link opens a webpage, not a file. Download the original from that page.",
      );
    const reader = response.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 20 * 1024 * 1024)
          throw new Error("This file exceeds the 20 MB limit.");
        chunks.push(new Uint8Array(value));
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    const pathName = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const name = /\.[a-z0-9]{2,6}$/i.test(asset.name)
      ? asset.name
      : /\.[a-z0-9]{2,6}$/i.test(pathName)
        ? pathName
        : asset.name;
    const result = await attachFile(new File(chunks, name, { type: mimeType }));
    return { ...result, sourceUrl: asset.sourceUrl };
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        "File download timed out. Open its source and attach it manually.",
      );
    if (error instanceof TypeError)
      throw new Error(
        "The source blocked this download or redirected to another site. Open it and attach the file manually.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

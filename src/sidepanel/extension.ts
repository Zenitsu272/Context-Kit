import type {
  ContentScriptRequest,
  ExtractedConversation,
  PageStatus,
  SupportedPlatform,
} from "../types/context-package";

export async function getActiveTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

export async function getCurrentPageStatus(): Promise<PageStatus> {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return {
      isSupported: false,
      platform: "unsupported",
      title: "No active tab",
      url: "",
      reason: "Open a supported AI tab to capture or insert context.",
    };
  }

  try {
    return await sendToActiveTab<PageStatus>(tab.id, { type: "GET_PAGE_STATUS" });
  } catch (error) {
    return buildUnavailablePageStatus(tab, error);
  }
}

export async function extractConversation(): Promise<ExtractedConversation> {
  const tabId = await getActiveTabId();
  if (!tabId) {
    throw new Error("No active tab found.");
  }

  return sendToActiveTab<ExtractedConversation>(tabId, {
    type: "EXTRACT_CONVERSATION",
  });
}

export async function extractSelectedText(): Promise<{
  platform: SupportedPlatform;
  title: string;
  url: string;
  text: string;
}> {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  try {
    return await sendToActiveTab(tab.id, {
      type: "EXTRACT_SELECTION",
    });
  } catch (error) {
    if (!isContentScriptUnavailable(error)) {
      throw error;
    }

    const text = await readSelectedTextFromTab(tab.id);
    if (!text) {
      throw new Error("No selected text was found on the current page.");
    }

    return {
      platform: detectPlatformFromUrl(tab.url) ?? "manual",
      title: tab.title?.trim() || "Selected Text",
      url: tab.url ?? "",
      text,
    };
  }
}

export async function insertRenderedContext(text: string) {
  const tabId = await getActiveTabId();
  if (!tabId) {
    throw new Error("No active tab found.");
  }

  await sendToActiveTab<{ ok: boolean }>(tabId, {
    type: "INSERT_RENDERED_CONTEXT",
    payload: { text },
  });
}

async function sendToActiveTab<T>(tabId: number, message: ContentScriptRequest): Promise<T> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    if (!response) {
      throw new Error("No response from content script.");
    }
    if (response.error) {
      throw new Error(response.error);
    }
    return response as T;
  } catch (error) {
    if (isContentScriptUnavailable(error)) {
      throw new Error("Context Kit is not connected to this tab yet.");
    }

    throw new Error(
      error instanceof Error
        ? error.message
        : "The page did not respond. Open ChatGPT or Gemini and try again.",
    );
  }
}

async function readSelectedTextFromTab(tabId: number): Promise<string> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.getSelection()?.toString().trim() ?? "",
    });
    return typeof result?.result === "string" ? result.result : "";
  } catch {
    return "";
  }
}

function buildUnavailablePageStatus(tab: chrome.tabs.Tab, error: unknown): PageStatus {
  const platform = detectPlatformFromUrl(tab.url);
  if (platform) {
    return {
      isSupported: false,
      platform: "unsupported",
      title: tab.title?.trim() || "Supported page needs refresh",
      url: tab.url ?? "",
      reason: "This supported tab is still loading or Context Kit has not connected yet. Refresh the page and try again.",
    };
  }

  return {
    isSupported: false,
    platform: "unsupported",
    title: "Manual capture available",
    url: tab.url ?? "",
    reason: isContentScriptUnavailable(error)
      ? "Open ChatGPT or Gemini for full extraction, or use Manual Context / Capture Selected Text on this page."
      : "Open ChatGPT or Gemini for full extraction, or use Manual Context as a fallback.",
  };
}

function detectPlatformFromUrl(url?: string): Exclude<SupportedPlatform, "manual" | "unsupported"> | null {
  if (!url) {
    return null;
  }

  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes("chatgpt.com") || hostname.includes("chat.openai.com")) {
      return "chatgpt";
    }
    if (hostname.includes("gemini.google.com") || hostname.includes("aistudio.google.com")) {
      return "gemini";
    }
  } catch {
    return null;
  }

  return null;
}

function isContentScriptUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Context Kit is not connected") ||
    message.includes("Could not establish connection") ||
    message.includes("Receiving end does not exist") ||
    message.includes("No response from content script")
  );
}

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

export async function getCurrentPageStatus(): Promise<PageStatus> {
  const tabId = await getActiveTabId();
  if (!tabId) {
    return {
      isSupported: false,
      platform: "unsupported",
      title: "No active tab",
      url: "",
      reason: "Open a supported AI tab to capture or insert context.",
    };
  }

  return sendToActiveTab<PageStatus>(tabId, { type: "GET_PAGE_STATUS" });
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
  const tabId = await getActiveTabId();
  if (!tabId) {
    throw new Error("No active tab found.");
  }

  return sendToActiveTab(tabId, {
    type: "EXTRACT_SELECTION",
  });
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
    throw new Error(
      error instanceof Error
        ? error.message
        : "The page did not respond. Open ChatGPT or Gemini and try again.",
    );
  }
}

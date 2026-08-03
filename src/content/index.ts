import type { ContentScriptRequest, PageStatus } from "../types/context-package";
import { chatgptAdapter } from "./adapters/chatgpt.adapter";
import { geminiAdapter } from "./adapters/gemini.adapter";

const adapters = [chatgptAdapter, geminiAdapter];

function getActiveAdapter() {
  return adapters.find((adapter) => adapter.detect());
}

function getUnsupportedStatus(): PageStatus {
  return {
    isSupported: false,
    platform: "unsupported",
    title: document.title,
    url: window.location.href,
    reason: "This site is not supported yet. Use Manual Context to save notes anyway.",
  };
}

chrome.runtime.onMessage.addListener((message: ContentScriptRequest, _sender, sendResponse) => {
  const activeAdapter = getActiveAdapter();

  (async () => {
    try {
      switch (message.type) {
        case "GET_PAGE_STATUS":
          sendResponse(activeAdapter?.getPageStatus() ?? getUnsupportedStatus());
          return;
        case "EXTRACT_CONVERSATION":
          if (!activeAdapter) {
            throw new Error("Unsupported page");
          }
          sendResponse(activeAdapter.extractConversation());
          return;
        case "EXTRACT_SELECTION": {
          const selectedText = window.getSelection()?.toString().trim() ?? "";
          if (!selectedText) {
            throw new Error("No text is selected on the page.");
          }
          sendResponse({
            platform: activeAdapter?.platform ?? "manual",
            title: activeAdapter?.getPageStatus().title ?? document.title,
            url: window.location.href,
            text: selectedText,
          });
          return;
        }
        case "INSERT_RENDERED_CONTEXT":
          if (!activeAdapter) {
            throw new Error("Unsupported page");
          }
          await activeAdapter.insertIntoPrompt(message.payload.text);
          sendResponse({ ok: true });
          return;
        default:
          sendResponse({ ok: false });
      }
    } catch (error) {
      sendResponse({
        error: error instanceof Error ? error.message : "Unknown content script error",
      });
    }
  })();

  return true;
});

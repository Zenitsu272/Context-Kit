import type { ExtractedConversation, PageStatus } from "../../types/context-package";
import type { PlatformAdapter } from "./types";
import {
  buildMessage,
  cleanText,
  dedupeMessages,
  setEditableValue,
  sortByDocumentOrder,
} from "./shared";

const CHATGPT_PROMPT_SELECTOR = [
  "#prompt-textarea",
  "div[contenteditable='true'][role='textbox'][aria-label='Chat with ChatGPT']",
  "textarea[aria-label='Chat with ChatGPT']",
  "textarea[placeholder='Ask anything']",
].join(", ");

export const chatgptAdapter: PlatformAdapter = {
  platform: "chatgpt",

  detect() {
    return (
      window.location.hostname.includes("chatgpt.com") ||
      window.location.hostname.includes("chat.openai.com")
    );
  },

  getPageStatus(): PageStatus {
    return {
      isSupported: true,
      platform: "chatgpt",
      title: cleanText(document.title.replace(/\s*-\s*ChatGPT\s*$/i, "")) || "ChatGPT conversation",
      url: window.location.href,
    };
  },

  extractConversation(): ExtractedConversation {
    const primaryNodes = [...document.querySelectorAll<HTMLElement>("[data-message-author-role]")];
    const fallbackNodes = sortByDocumentOrder(
      [
        ...[...document.querySelectorAll<HTMLElement>("[data-testid*='user-message']")].map(
          (element) => ({ element, role: "user" as const }),
        ),
        ...[...document.querySelectorAll<HTMLElement>("[data-testid*='assistant-message']")].map(
          (element) => ({ element, role: "assistant" as const }),
        ),
        ...[...document.querySelectorAll<HTMLElement>("main article")].map((element, index) => ({
          element,
          role: index % 2 === 0 ? ("assistant" as const) : ("user" as const),
        })),
      ],
    );

    const messages = dedupeMessages(
      (primaryNodes.length
        ? primaryNodes.map((element, index) => {
            const role =
              element.getAttribute("data-message-author-role") === "user"
                ? "user"
                : "assistant";
            const content = cleanText(element.innerText);
            return content ? buildMessage(role, content, index + 1) : null;
          })
        : fallbackNodes.map(({ element, role }, index) => {
            const content = cleanText(element.innerText);
            return content ? buildMessage(role, content, index + 1) : null;
          })
      ).filter((item): item is NonNullable<typeof item> => Boolean(item)),
    );

    const warnings: string[] = [];
    if (!primaryNodes.length && messages.length) {
      warnings.push("ChatGPT used fallback extraction selectors on this page.");
    }
    if (!messages.length) {
      warnings.push("No conversation messages were reliably detected from this ChatGPT page.");
    }

    return {
      platform: "chatgpt",
      title: this.getPageStatus().title,
      url: window.location.href,
      extractedAt: new Date().toISOString(),
      confidence: messages.length >= 4 ? "high" : messages.length >= 2 ? "medium" : "low",
      messages,
      warnings,
    };
  },

  async insertIntoPrompt(text: string) {
    const promptCandidates = [...document.querySelectorAll<HTMLElement>(CHATGPT_PROMPT_SELECTOR)];
    const element = promptCandidates.find(
      (candidate) => candidate.offsetParent !== null || candidate.getAttribute("role") === "textbox",
    );
    if (!element) {
      throw new Error("ChatGPT prompt box not found.");
    }

    setEditableValue(element, text);
  },
};

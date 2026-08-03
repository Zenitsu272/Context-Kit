import type { ExtractedConversation, PageStatus } from "../../types/context-package";
import type { PlatformAdapter } from "./types";
import {
  buildMessage,
  cleanText,
  dedupeMessages,
  setEditableValue,
  sortByDocumentOrder,
} from "./shared";

const GEMINI_PROMPT_SELECTORS = [
  "div[contenteditable='true'][role='textbox'][aria-label='Enter a prompt for Gemini']",
  ".ql-editor[contenteditable='true']",
  "div[contenteditable='true'][role='textbox']",
  "textarea",
];

function extractGeminiMessages() {
  const candidates = [
    { selector: "user-query", role: "user" as const },
    { selector: "[data-test-id='user-query']", role: "user" as const },
    { selector: ".query-text", role: "user" as const },
    { selector: "model-response", role: "assistant" as const },
    { selector: "message-content", role: "assistant" as const },
    { selector: "[data-test-id='model-response']", role: "assistant" as const },
    { selector: ".model-response-text", role: "assistant" as const },
    { selector: ".response-container-content", role: "assistant" as const },
  ];

  const collected = sortByDocumentOrder(
    candidates.flatMap((candidate) =>
      [...document.querySelectorAll<HTMLElement>(candidate.selector)].map((element) => ({
        element,
        role: candidate.role,
      })),
    ),
  );

  return dedupeMessages(
    collected
      .map(({ element, role }, index) => {
        const content = cleanText(element.innerText);
        return content ? buildMessage(role, content, index + 1) : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
  );
}

export const geminiAdapter: PlatformAdapter = {
  platform: "gemini",

  detect() {
    return (
      window.location.hostname.includes("gemini.google.com") ||
      window.location.hostname.includes("aistudio.google.com")
    );
  },

  getPageStatus(): PageStatus {
    return {
      isSupported: true,
      platform: "gemini",
      title: cleanText(document.title.replace(/\s*-\s*Gemini\s*$/i, "")) || "Gemini conversation",
      url: window.location.href,
    };
  },

  extractConversation(): ExtractedConversation {
    const messages = extractGeminiMessages();
    const warnings: string[] = [];

    if (!messages.length) {
      warnings.push("No conversation messages were reliably detected from this Gemini page.");
    } else if (messages.length < 3) {
      warnings.push("Only a small portion of the Gemini conversation may have been captured.");
    }

    return {
      platform: "gemini",
      title: this.getPageStatus().title,
      url: window.location.href,
      extractedAt: new Date().toISOString(),
      confidence: messages.length >= 4 ? "medium" : messages.length >= 2 ? "low" : "low",
      messages,
      warnings,
    };
  },

  async insertIntoPrompt(text: string) {
    const element = GEMINI_PROMPT_SELECTORS.map((selector) =>
      document.querySelector<HTMLElement>(selector),
    ).find((candidate) => Boolean(candidate) && candidate?.offsetParent !== null);

    if (!element) {
      throw new Error("Gemini prompt box not found.");
    }

    setEditableValue(element, text);
  },
};

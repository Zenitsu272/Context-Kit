import type {
  ContextAsset,
  ExtractedMessage,
  MessageRole,
} from "../../types/context-package";

export function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function buildMessage(
  role: MessageRole,
  content: string,
  position: number,
): ExtractedMessage {
  return {
    id: `${role}_${position}`,
    role,
    content: content.replace(/\r\n?/g, "\n").trim(),
    position,
  };
}

export function dedupeMessages(
  messages: ExtractedMessage[],
): ExtractedMessage[] {
  // Repeated replies ("yes", "try again") are real turns. Deduplicate DOM nodes,
  // never message text, so the transcript remains faithful.
  return messages.filter((message) => message.content.trim());
}

export function setEditableValue(element: HTMLElement, text: string) {
  const existing =
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLInputElement
      ? element.value
      : element.innerText;
  // Preserve the user's unsent prompt. Context is appended and never auto-submitted.
  text = existing.trim() ? `${existing}\n\n${text}` : text;
  if (
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLInputElement
  ) {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    element.focus();
    if (descriptor?.set) {
      descriptor.set.call(element, text);
    } else {
      element.value = text;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  element.focus();
  selectElementContents(element);

  const supportsExecCommand =
    typeof document.execCommand === "function" &&
    document.execCommand("insertText", false, text);

  if (!supportsExecCommand) {
    element.textContent = text;
  }

  element.dispatchEvent(
    new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      data: text,
      inputType: "insertText",
    }),
  );
  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      data: text,
      inputType: "insertText",
    }),
  );
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

export function collectAssetReferences(roots: HTMLElement[]): ContextAsset[] {
  const found = new Map<string, ContextAsset>();
  for (const root of roots)
    for (const element of root.querySelectorAll<
      HTMLImageElement | HTMLAnchorElement | HTMLVideoElement
    >("img, a[href], video")) {
      const isLink = element instanceof HTMLAnchorElement;
      const sourceUrl = isLink
        ? element.href
        : element instanceof HTMLImageElement
          ? element.currentSrc || element.src
          : element.currentSrc || element.src;
      if (!/^https?:\/\//i.test(sourceUrl)) continue;
      const isDocument =
        /\.(pdf|docx?|xlsx?|pptx?|txt|csv|zip)(?:[?#]|$)/i.test(sourceUrl) ||
        (isLink &&
          (element.hasAttribute("download") ||
            /attachment|download|\.pdf/i.test(element.innerText)));
      if (isLink && !isDocument) continue;
      if (
        element instanceof HTMLImageElement &&
        ((element.width && element.width < 80) ||
          /avatar|icon|emoji/i.test(element.alt))
      )
        continue;
      const name =
        (isLink
          ? element.innerText || element.download
          : element instanceof HTMLImageElement
            ? element.alt
            : "Video") ||
        new URL(sourceUrl).pathname.split("/").pop() ||
        "Attachment";
      if (!found.has(sourceUrl))
        found.set(sourceUrl, {
          id: `asset_${crypto.randomUUID()}`,
          name: name.slice(0, 250),
          source: "reference",
          sourceUrl,
          size: 0,
          mimeType: /\.pdf(?:[?#]|$)/i.test(sourceUrl)
            ? "application/pdf"
            : element instanceof HTMLImageElement
              ? "image/*"
              : element instanceof HTMLVideoElement
                ? "video/*"
                : "application/octet-stream",
          warning:
            "Source link only; download and attach the original to extract content. Links may expire or require sign-in.",
        });
    }
  return [...found.values()].slice(0, 40);
}

function selectElementContents(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function sortByDocumentOrder<T extends { element: Element }>(
  items: T[],
): T[] {
  return [...items].sort((left, right) => {
    if (left.element === right.element) {
      return 0;
    }

    const relationship = left.element.compareDocumentPosition(right.element);
    if (relationship & Node.DOCUMENT_POSITION_FOLLOWING) {
      return -1;
    }
    if (relationship & Node.DOCUMENT_POSITION_PRECEDING) {
      return 1;
    }
    return 0;
  });
}

export function extractBySelectors(
  selectors: Array<{ selector: string; role: MessageRole }>,
): ExtractedMessage[] {
  const collected: ExtractedMessage[] = [];
  let position = 1;

  for (const item of selectors) {
    const elements = document.querySelectorAll<HTMLElement>(item.selector);
    elements.forEach((element) => {
      const content = cleanText(element.innerText);
      if (content) {
        collected.push(buildMessage(item.role, content, position));
        position += 1;
      }
    });
  }

  return dedupeMessages(
    collected
      .sort((left, right) => left.position - right.position)
      .map((message, index) => ({
        ...message,
        position: index + 1,
      })),
  );
}

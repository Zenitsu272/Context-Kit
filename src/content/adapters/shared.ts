import type { ExtractedMessage, MessageRole } from "../../types/context-package";

export function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function buildMessage(role: MessageRole, content: string, position: number): ExtractedMessage {
  return {
    id: `${role}_${position}`,
    role,
    content: cleanText(content),
    position,
  };
}

export function dedupeMessages(messages: ExtractedMessage[]): ExtractedMessage[] {
  const seen = new Set<string>();
  return messages.filter((message) => {
    const key = `${message.role}:${message.content}`;
    if (!message.content || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function setEditableValue(element: HTMLElement, text: string) {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
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

export function sortByDocumentOrder<T extends { element: Element }>(items: T[]): T[] {
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
    collected.sort((left, right) => left.position - right.position).map((message, index) => ({
      ...message,
      position: index + 1,
    })),
  );
}

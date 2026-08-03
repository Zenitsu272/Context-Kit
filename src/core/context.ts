import type {
  ContextDraft,
  ContextPackage,
  ExtractedConversation,
  ExtractedMessage,
  MessageRole,
  SupportedPlatform,
} from "../types/context-package";
import { deriveDraftInsights } from "./intelligence";
import { redactSensitiveContent, scanSensitiveContent } from "./safety";

export function createDraftFromConversation(
  conversation: ExtractedConversation,
): ContextDraft {
  const transcript = conversation.messages.map((message) => message.content).join("\n");
  const title =
    conversation.title.trim() ||
    truncate(findFirstMessage(conversation.messages) || "Untitled Context Package", 72);
  const derived = deriveDraftInsights({ title, messages: conversation.messages });

  return {
    title,
    platform: conversation.platform,
    sourceUrl: conversation.url,
    summary: derived.summary,
    keyDecisions: derived.keyDecisions,
    constraints: derived.constraints,
    openQuestions: derived.openQuestions,
    tags: derived.tags,
    sensitiveFindings: scanSensitiveContent(`${title}\n${transcript}`),
    messages: conversation.messages,
    depth: "detailed",
    notes: derived.actionItems.length
      ? `Suggested action items:\n${derived.actionItems.map((item) => `- ${item}`).join("\n")}`
      : "",
    extractionConfidence: conversation.confidence,
    reviewWarnings: buildReviewWarnings(conversation),
  };
}

export function createManualDraft(): ContextDraft {
  return {
    title: "",
    platform: "manual",
    sourceUrl: "",
    summary: "",
    keyDecisions: [],
    constraints: [],
    openQuestions: [],
    tags: [],
    sensitiveFindings: [],
    messages: [],
    depth: "detailed",
    notes: "",
    extractionConfidence: "high",
    reviewWarnings: [],
  };
}

export function createDraftFromSelection(input: {
  platform: SupportedPlatform;
  title: string;
  url: string;
  text: string;
}): ContextDraft {
  const messages = parseTranscript(input.text);
  const title =
    input.title.trim() ||
    truncate(findFirstMessage(messages) || "Selected Context", 72);

  const conversation: ExtractedConversation = {
    platform: input.platform,
    title,
    url: input.url,
    extractedAt: new Date().toISOString(),
    confidence: messages.length > 1 ? "medium" : "low",
    messages,
    warnings:
      messages.length > 1
        ? ["Review the captured text before saving to make sure the message boundaries look right."]
        : ["Only a small amount of selected text was captured. Consider expanding the selection."],
  };

  return createDraftFromConversation(conversation);
}

export function materializePackage(
  draft: ContextDraft,
  existingPackage?: Pick<
    ContextPackage,
    "id" | "capturedAt" | "workspaceId" | "visibility" | "createdBy" | "currentVersion" | "versionCount"
  >,
): ContextPackage {
  const now = new Date().toISOString();

  return {
    id: existingPackage?.id ?? buildId(),
    workspaceId: existingPackage?.workspaceId ?? null,
    visibility: existingPackage?.visibility ?? "private",
    createdBy: existingPackage?.createdBy ?? null,
    currentVersion: existingPackage?.currentVersion ?? 1,
    versionCount: existingPackage?.versionCount ?? 1,
    title: draft.title.trim() || "Untitled Context Package",
    platform: draft.platform,
    sourceUrl: draft.sourceUrl.trim(),
    capturedAt: existingPackage?.capturedAt ?? now,
    updatedAt: now,
    summary: draft.summary.trim(),
    keyDecisions: cleanList(draft.keyDecisions),
    constraints: cleanList(draft.constraints),
    openQuestions: cleanList(draft.openQuestions),
    tags: cleanList(draft.tags).map((item) => item.toLowerCase()),
    sensitiveFindings: draft.sensitiveFindings,
    messages: draft.messages,
    depth: draft.depth,
    notes: draft.notes.trim(),
    extractionConfidence: draft.extractionConfidence,
    reviewWarnings: cleanList(draft.reviewWarnings),
  };
}

export function rescanDraft(draft: ContextDraft): ContextDraft {
  const transcript = draft.messages.map((message) => message.content).join("\n");
  return {
    ...draft,
    sensitiveFindings: scanSensitiveContent(
      [draft.title, draft.summary, draft.notes, transcript].filter(Boolean).join("\n"),
    ),
    reviewWarnings: cleanList(draft.reviewWarnings),
  };
}

export function redactDraftSensitiveContent(draft: ContextDraft): ContextDraft {
  const nextMessages = draft.messages.map((message) => ({
    ...message,
    content: redactSensitiveContent(message.content),
  }));

  return rescanDraft({
    ...draft,
    title: redactSensitiveContent(draft.title),
    summary: redactSensitiveContent(draft.summary),
    keyDecisions: draft.keyDecisions.map(redactSensitiveContent),
    constraints: draft.constraints.map(redactSensitiveContent),
    openQuestions: draft.openQuestions.map(redactSensitiveContent),
    notes: redactSensitiveContent(draft.notes),
    messages: nextMessages,
  });
}

export function summarizePlatform(platform: SupportedPlatform): string {
  switch (platform) {
    case "chatgpt":
      return "ChatGPT";
    case "gemini":
      return "Gemini";
    case "manual":
      return "Manual";
    default:
      return "Unsupported";
  }
}

export function serializeMessages(messages: ExtractedMessage[]): string {
  return messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
}

export function parseTranscript(text: string): ExtractedMessage[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const messages: ExtractedMessage[] = [];
  let currentRole: MessageRole = "user";
  let buffer: string[] = [];

  function flush() {
    const content = normalizeText(buffer.join(" "));
    if (!content) {
      buffer = [];
      return;
    }

    messages.push(buildManualMessage(currentRole, content, messages.length + 1));
    buffer = [];
  }

  for (const line of lines) {
    const match = line.match(/^(user|assistant|system)\s*:\s*(.*)$/i);
    if (match) {
      flush();
      currentRole = match[1].toLowerCase() as MessageRole;
      buffer.push(match[2]);
      continue;
    }

    if (!buffer.length && messages.length === 0) {
      currentRole = "user";
    }

    buffer.push(line);
  }

  flush();

  if (messages.length) {
    return messages;
  }

  const fallback = normalizeText(text);
  return fallback ? [buildManualMessage("user", fallback, 1)] : [];
}

function buildReviewWarnings(conversation: ExtractedConversation): string[] {
  const warnings = [...(conversation.warnings ?? [])];
  const uniqueRoles = new Set(conversation.messages.map((message) => message.role));

  if (conversation.confidence === "low") {
    warnings.push("Extraction confidence is low. Review the transcript carefully before saving.");
  }

  if (conversation.messages.length < 2) {
    warnings.push("Only a small number of messages were detected. Manual cleanup may be needed.");
  }

  if (!uniqueRoles.has("user") || !uniqueRoles.has("assistant")) {
    warnings.push("Only one side of the conversation may have been detected.");
  }

  if (conversation.messages.some((message) => message.content.length < 10)) {
    warnings.push("Some extracted messages are very short and may reflect partial capture.");
  }

  return dedupe(warnings);
}

function buildManualMessage(
  role: MessageRole,
  content: string,
  position: number,
): ExtractedMessage {
  return {
    id: `${role}_${position}`,
    role,
    content,
    position,
  };
}

function buildId(): string {
  return `ctx_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function cleanList(items: string[]): string[] {
  return dedupe(items.map((item) => item.trim()).filter(Boolean));
}

function findFirstMessage(messages: ExtractedMessage[]): string | undefined {
  return messages.find((message) => message.role === "user" || message.role === "assistant")?.content;
}

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 3).trim()}...` : value;
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

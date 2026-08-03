import type { ContextPackage, ExtractedMessage, PromptTemplate, RenderOptions } from "../types/context-package";

export function renderContextPackage(
  contextPackage: ContextPackage,
  options: RenderOptions,
): string {
  const lines: string[] = [];
  const template = options.template ?? "general";
  const includeSummary = options.includeSummary ?? true;
  const includeKeyDecisions = options.includeKeyDecisions ?? options.mode !== "brief";
  const includeConstraints = options.includeConstraints ?? true;
  const includeOpenQuestions = options.includeOpenQuestions ?? options.mode !== "brief";
  const includeNotes = options.includeNotes ?? options.mode === "full";
  const includeMessages = options.includeMessages ?? options.mode !== "brief";

  lines.push(...buildTemplateIntro(template, contextPackage.title, options.focusQuery));

  if (includeSummary) {
    lines.push("");
    lines.push("Summary:");
    lines.push(contextPackage.summary || "No summary provided.");
  }

  if (includeKeyDecisions && contextPackage.keyDecisions.length) {
    lines.push("");
    lines.push("Key Decisions:");
    lines.push(...contextPackage.keyDecisions.map((item) => `- ${item}`));
  }

  if (includeConstraints && contextPackage.constraints.length) {
    lines.push("");
    lines.push("Constraints:");
    lines.push(
      ...(options.mode === "brief"
        ? contextPackage.constraints.slice(0, 3)
        : contextPackage.constraints
      ).map((item) => `- ${item}`),
    );
  }

  if (includeOpenQuestions && contextPackage.openQuestions.length) {
    lines.push("");
    lines.push("Open Questions:");
    lines.push(...contextPackage.openQuestions.map((item) => `- ${item}`));
  }

  if (includeNotes && contextPackage.notes.trim()) {
    lines.push("");
    lines.push("Working Notes:");
    lines.push(contextPackage.notes.trim());
  }

  if (options.mode === "full") {
    lines.push("");
    lines.push("Source:");
    lines.push(
      `Platform: ${contextPackage.platform} | Captured: ${new Date(
        contextPackage.capturedAt,
      ).toLocaleString()} | Version: v${contextPackage.currentVersion ?? 1}`,
    );
    if (contextPackage.sourceUrl) {
      lines.push(contextPackage.sourceUrl);
    }
  }

  if (includeMessages && contextPackage.messages.length) {
    const maxMessages = options.mode === "full" ? 16 : options.mode === "detailed" ? 8 : 4;
    const messages = selectRelevantMessages(contextPackage.messages, options.focusQuery, maxMessages);

    lines.push("");
    lines.push(options.focusQuery ? "Most Relevant Messages:" : options.mode === "full" ? "Transcript:" : "Relevant Messages:");
    lines.push(...messages.map((message) => `[${message.role.toUpperCase()}] ${message.content}`));
  }

  lines.push("");
  lines.push(...buildTemplateOutro(template));

  return lines.join("\n");
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function buildTemplateIntro(template: PromptTemplate, title: string, focusQuery?: string): string[] {
  const lines = [`Context Package: ${title}`];

  switch (template) {
    case "implementation":
      lines.unshift("Use this implementation context before writing code.");
      break;
    case "debug":
      lines.unshift("Use this debugging context before diagnosing the issue.");
      break;
    case "handoff":
      lines.unshift("Use this handoff context to continue work with minimal re-explaining.");
      break;
    case "planning":
      lines.unshift("Use this planning context before proposing scope, milestones, or tradeoffs.");
      break;
    default:
      lines.unshift("Use the following Context Package before answering.");
      break;
  }

  if (focusQuery?.trim()) {
    lines.push(`Focus task: ${focusQuery.trim()}`);
  }

  return lines;
}

function buildTemplateOutro(template: PromptTemplate): string[] {
  switch (template) {
    case "implementation":
      return ["Write the next response as an implementation-oriented answer grounded in this context."];
    case "debug":
      return ["Diagnose the likely cause and suggest concrete debugging steps using this context."];
    case "handoff":
      return ["Continue the work as if you are picking up a teammate handoff using this context."];
    case "planning":
      return ["Propose a plan, tradeoffs, and next steps using this context."];
    default:
      return ["Answer the next user request using this context."];
  }
}

function selectRelevantMessages(
  messages: ExtractedMessage[],
  focusQuery: string | undefined,
  maxMessages: number,
): ExtractedMessage[] {
  if (!focusQuery?.trim()) {
    return messages.slice(0, maxMessages);
  }

  const queryTerms = extractTerms(focusQuery);
  if (!queryTerms.size) {
    return messages.slice(0, maxMessages);
  }

  return [...messages]
    .map((message, index) => ({
      message,
      score: scoreMessage(message, queryTerms) + Math.max(0, 3 - index * 0.1),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, maxMessages)
    .sort((left, right) => left.message.position - right.message.position)
    .map((item) => item.message);
}

function scoreMessage(message: ExtractedMessage, queryTerms: Set<string>): number {
  const terms = extractTerms(message.content);
  let overlap = 0;
  for (const term of queryTerms) {
    if (terms.has(term)) {
      overlap += 1;
    }
  }
  return overlap;
}

function extractTerms(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 2),
  );
}

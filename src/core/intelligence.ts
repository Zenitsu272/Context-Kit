import type { ContextDraft, ContextPackage, ExtractedMessage } from "../types/context-package";

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "have",
  "will",
  "into",
  "your",
  "about",
  "project",
  "using",
  "need",
  "when",
  "should",
  "could",
  "would",
  "there",
  "their",
  "them",
  "then",
  "than",
]);

export interface RelatedPackageSuggestion {
  contextPackage: ContextPackage;
  score: number;
  reasons: string[];
}

export function deriveDraftInsights(input: { title: string; messages: ExtractedMessage[] }) {
  const transcript = input.messages.map((message) => message.content).join("\n");
  return {
    summary: buildSummary(input.messages),
    keyDecisions: detectInsights(input.messages, /(?:we(?:'re)?|use|decision|ship|build|choose|agreed)/i, 5),
    constraints: detectInsights(
      input.messages,
      /(?:must|need to|should|avoid|cannot|can't|limit|budget|constraint|requirement|blocked)/i,
      5,
    ),
    openQuestions: detectOpenQuestions(input.messages, 5),
    tags: detectTags(input.title, transcript),
    actionItems: detectInsights(
      input.messages,
      /(?:todo|action item|next step|follow up|implement|test|fix|deploy|document)/i,
      5,
    ),
  };
}

export function refreshDraftInsights(draft: ContextDraft): ContextDraft {
  const derived = deriveDraftInsights({ title: draft.title, messages: draft.messages });
  const nextNotes = draft.notes.trim()
    ? draft.notes
    : derived.actionItems.length
      ? `Suggested action items:\n${derived.actionItems.map((item) => `- ${item}`).join("\n")}`
      : draft.notes;

  return {
    ...draft,
    summary: derived.summary || draft.summary,
    keyDecisions: derived.keyDecisions,
    constraints: derived.constraints,
    openQuestions: derived.openQuestions,
    tags: derived.tags,
    notes: nextNotes,
  };
}

export function findRelatedPackages(
  draft: Pick<ContextDraft, "title" | "summary" | "tags" | "messages">,
  packages: ContextPackage[],
  excludeId?: string,
  limit = 3,
): RelatedPackageSuggestion[] {
  const draftTerms = extractTerms([draft.title, draft.summary, draft.tags.join(" "), serializeContents(draft.messages)].join(" "));

  return packages
    .filter((item) => item.id !== excludeId)
    .map((contextPackage) => {
      const packageTerms = extractTerms(
        [contextPackage.title, contextPackage.summary, contextPackage.tags.join(" "), serializeContents(contextPackage.messages)].join(" "),
      );
      const overlap = intersectCount(draftTerms, packageTerms);
      const titleMatch = normalize(draft.title) && normalize(contextPackage.title).includes(normalize(draft.title)) ? 5 : 0;
      const tagOverlap = intersectCount(new Set(draft.tags.map(normalize)), new Set(contextPackage.tags.map(normalize))) * 2;
      const summaryOverlap = draft.summary && contextPackage.summary
        ? intersectCount(extractTerms(draft.summary), extractTerms(contextPackage.summary))
        : 0;
      const score = overlap + titleMatch + tagOverlap + summaryOverlap;
      const reasons: string[] = [];
      if (titleMatch) {
        reasons.push("similar title");
      }
      if (tagOverlap) {
        reasons.push("overlapping tags");
      }
      if (summaryOverlap || overlap) {
        reasons.push("similar conversation language");
      }
      return { contextPackage, score, reasons: dedupe(reasons) };
    })
    .filter((item) => item.score > 2)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function buildSummary(messages: ExtractedMessage[]): string {
  const sentences = messages
    .slice(0, 8)
    .flatMap((message) => splitSentences(message.content))
    .filter((sentence) => sentence.length > 30);

  return truncate(sentences.slice(0, 3).join(" "), 420);
}

function detectInsights(messages: ExtractedMessage[], pattern: RegExp, limit: number): string[] {
  const results: string[] = [];

  for (const message of messages) {
    for (const sentence of splitSentences(message.content)) {
      if (pattern.test(sentence)) {
        results.push(truncate(sentence, 160));
      }
      if (results.length >= limit) {
        return dedupe(results);
      }
    }
  }

  return dedupe(results);
}

function detectOpenQuestions(messages: ExtractedMessage[], limit: number): string[] {
  const questions: string[] = [];

  for (const message of messages) {
    for (const sentence of splitSentences(message.content)) {
      if (sentence.includes("?")) {
        questions.push(truncate(sentence, 160));
      }
      if (questions.length >= limit) {
        return dedupe(questions);
      }
    }
  }

  return dedupe(questions);
}

function detectTags(title: string, transcript: string): string[] {
  const tokens = `${title} ${transcript}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3 && !STOP_WORDS.has(token));

  return dedupe(tokens).slice(0, 8);
}

function serializeContents(messages: ExtractedMessage[]): string {
  return messages.map((message) => message.content).join(" ");
}

function extractTerms(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map(normalize)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

function intersectCount(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const item of left) {
    if (right.has(item)) {
      count += 1;
    }
  }
  return count;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((segment) => segment.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 3).trim()}...` : value;
}

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}

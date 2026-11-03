export type SupportedPlatform = "chatgpt" | "gemini" | "manual" | "unsupported";

export type MessageRole = "user" | "assistant" | "system";

export type ContextDepth = "brief" | "detailed" | "full";

export type PromptTemplate =
  | "general"
  | "implementation"
  | "debug"
  | "handoff"
  | "planning";

export interface ContextAsset {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  source: "local" | "reference";
  sourceUrl?: string;
  text?: string;
  extraction?: "local" | "gemini";
  warning?: string;
}

export interface ExtractedMessage {
  id: string;
  role: MessageRole;
  content: string;
  position: number;
}

export interface ExtractedConversation {
  platform: SupportedPlatform;
  title: string;
  url: string;
  extractedAt: string;
  confidence: "high" | "medium" | "low";
  messages: ExtractedMessage[];
  warnings?: string[];
  assets?: ContextAsset[];
}

export interface SensitiveFinding {
  type: string;
  label: string;
  severity: "low" | "medium" | "high";
}

export interface ContextPackage {
  assets?: ContextAsset[];
  id: string;
  workspaceId?: string | null;
  visibility?: "private" | "team" | "selected";
  createdBy?: string | null;
  currentVersion?: number;
  versionCount?: number;
  title: string;
  platform: SupportedPlatform;
  sourceUrl: string;
  capturedAt: string;
  updatedAt: string;
  summary: string;
  keyDecisions: string[];
  constraints: string[];
  openQuestions: string[];
  tags: string[];
  sensitiveFindings: SensitiveFinding[];
  messages: ExtractedMessage[];
  depth: ContextDepth;
  notes: string;
  extractionConfidence: "high" | "medium" | "low";
  reviewWarnings: string[];
}

export interface ContextDraft {
  editingPackageId?: string;
  assets?: ContextAsset[];
  title: string;
  platform: SupportedPlatform;
  sourceUrl: string;
  summary: string;
  keyDecisions: string[];
  constraints: string[];
  openQuestions: string[];
  tags: string[];
  sensitiveFindings: SensitiveFinding[];
  messages: ExtractedMessage[];
  depth: ContextDepth;
  notes: string;
  extractionConfidence: "high" | "medium" | "low";
  reviewWarnings: string[];
}

export interface PageStatus {
  isSupported: boolean;
  platform: SupportedPlatform;
  title: string;
  url: string;
  reason?: string;
}

export interface RenderOptions {
  mode: ContextDepth;
  template?: PromptTemplate;
  focusQuery?: string;
  includeSummary?: boolean;
  includeKeyDecisions?: boolean;
  includeConstraints?: boolean;
  includeOpenQuestions?: boolean;
  includeNotes?: boolean;
  includeMessages?: boolean;
}

export type ContentScriptRequest =
  | { type: "GET_PAGE_STATUS" }
  | { type: "EXTRACT_CONVERSATION" }
  | { type: "EXTRACT_SELECTION" }
  | { type: "INSERT_RENDERED_CONTEXT"; payload: { text: string } };

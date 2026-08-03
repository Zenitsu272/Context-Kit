import type { ExtractedConversation, PageStatus } from "../../types/context-package";

export interface PlatformAdapter {
  platform: "chatgpt" | "gemini";
  detect(): boolean;
  getPageStatus(): PageStatus;
  extractConversation(): ExtractedConversation;
  insertIntoPrompt(text: string): Promise<void>;
}

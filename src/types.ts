export interface Session {
  id: string;
  label: string;
  project: string;
  workingDir: string;
  status: "active" | "idle" | "thinking" | "closed";
  createdAt: number;
  lastActiveAt: number;
  color?: string;
  summary?: string;
  resumeContext?: string;
  claudeSessionId?: string;
  pid?: number;
  pinned?: boolean;
  initialPrompt?: string;
}

export interface PinnedSession {
  label: string;
  project: string;
  workingDir: string;
  color?: string;
  claudeSessionId?: string;
}

export interface SavedSession extends Session {
  transcript: TranscriptEntry[];
  summary: string;
  filesChanged: string[];
  claudeSessionId?: string;
}

export interface TranscriptEntry {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface Project {
  name: string;
  path: string;
  color: string;
  lastSession?: string;
}

export type GridLayout = "solo" | "split" | "quad" | "flex";

export interface PromptTemplate {
  id: string;
  name: string;
  text: string;
  category: string;
}

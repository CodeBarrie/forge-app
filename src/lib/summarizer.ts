import { invoke } from "@tauri-apps/api/core";

/**
 * Generates a concise session summary using the Tauri backend.
 * Called when a session is closed or paused.
 * The summary becomes the resume handshake for the next session.
 */
export async function generateSessionSummary(
  label: string,
  project: string,
  transcript: string
): Promise<string> {
  try {
    console.log(`[summarizer] Calling generate_summary for "${label}", transcript: ${transcript.length} chars`);
    const summary = await invoke<string>("generate_summary", {
      label,
      project,
      transcript,
    });
    console.log(`[summarizer] Got summary: ${summary.slice(0, 100)}...`);
    return summary;
  } catch (err) {
    console.error(`[summarizer] Summary generation failed:`, err);
    return `Session "${label}" closed. No summary available.`;
  }
}

/**
 * Formats a summary as a resume context string to prepend to a new session
 */
export function buildResumeContext(summary: string, project: string): string {
  return [
    `[FORGE — ${project}] Here's context from a previous session:`,
    ``,
    summary,
    ``,
    `This is a fresh session with the above context for reference. What would you like to work on?`,
  ].join("\n");
}

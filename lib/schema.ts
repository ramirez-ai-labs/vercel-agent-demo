import { z } from "zod";

/**
 * Shape the model must return. Using generateObject (not streamText) here
 * because we need a runnable file, not prose — the schema is the contract
 * between "the model wrote something" and "the sandbox can execute it."
 */
export const scriptSchema = z.object({
  language: z
    .enum(["node", "python"])
    .describe("Runtime to execute the script with."),
  filename: z
    .string()
    .describe('File name including extension, e.g. "script.js" or "script.py".'),
  code: z.string().describe("The complete, self-contained script."),
  summary: z
    .string()
    .describe("One sentence explaining what the script does, for display in the UI."),
});

export type GeneratedScript = z.infer<typeof scriptSchema>;

/**
 * Event protocol streamed from /api/agent to the client as newline-delimited
 * JSON. Kept intentionally simple (no SSE framing) since the client just
 * needs ordered progress events, not reconnect/resume semantics.
 */
export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "code"; language: GeneratedScript["language"]; filename: string; code: string; summary: string }
  | { type: "result"; exitCode: number; stdout: string; stderr: string }
  | { type: "error"; message: string }
  | { type: "done" };

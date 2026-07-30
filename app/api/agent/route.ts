import { generateText } from "ai";
import { Sandbox } from "@vercel/sandbox";
import { scriptSchema, type AgentEvent } from "@/lib/schema";
import { z } from "zod";

// Sandbox creation + install + run can take longer than the default
// serverless timeout — bump it. (Hobby caps functions lower than this;
// see README for the plan-specific ceiling.)
export const maxDuration = 60;

export async function POST(request: Request) {
  let prompt: string | undefined;
  try {
    ({ prompt } = await request.json());
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return Response.json({ error: 'Missing "prompt" in request body.' }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      let sandbox: Sandbox | undefined;

      try {
        send({ type: "status", message: "Asking the model to write a script…" });

        const { text } = await generateText({
          model: process.env.AI_MODEL ?? "inclusionai/ling-3.0-flash-free",
          system: [
            "You write small, self-contained scripts that fulfil the user's coding request.",
            "Respond with ONLY a JSON object (no markdown, no extra text). Use this exact format:",
            '{"language":"node"|"python","filename":"script.js|script.py","code":"...","summary":"..."}',
            "Prefer Node.js unless Python is clearly a better fit for the task.",
            "Keep the script under 60 lines. Print results to stdout with console.log or print().",
            "The script must not read from or write to the network, and must not access",
            "the filesystem outside its own working directory. It runs unattended — do not",
            "wait on stdin or any interactive input.",
          ].join(" "),
          prompt,
        });

        let object;
        try {
          object = scriptSchema.parse(JSON.parse(text));
        } catch (parseError) {
          throw new Error(
            `Failed to parse model response as JSON: ${parseError instanceof Error ? parseError.message : "Unknown error"}`
          );
        }

        send({
          type: "code",
          language: object.language,
          filename: object.filename,
          code: object.code,
          summary: object.summary,
        });

        send({ type: "status", message: "Starting a Vercel Sandbox (Firecracker microVM)…" });

        const runtime =
          object.language === "python" ? "python3.13" :
          object.language === "node" ? "node24" :
          (() => { throw new Error(`Unknown language: ${object.language}`); })();

        const cmd =
          object.language === "python" ? "python3" :
          object.language === "node" ? "node" :
          (() => { throw new Error(`Unknown language: ${object.language}`); })();

        sandbox = await Sandbox.create({
          runtime,
          timeout: 30_000,
          persistent: false, // one-off execution — no need to snapshot on stop
        });

        await sandbox.writeFiles([
          { path: object.filename, content: Buffer.from(object.code) },
        ]);

        send({ type: "status", message: `Running ${object.filename} inside the sandbox…` });
        const result = await sandbox.runCommand({ cmd, args: [object.filename] });

        send({
          type: "result",
          exitCode: result.exitCode,
          stdout: await result.stdout(),
          stderr: await result.stderr(),
        });

        send({ type: "done" });
      } catch (error) {
        // This is the friction log in code form: anything that lands here is
        // worth a line in FRICTION_LOG.md if it's a rough edge in the SDKs
        // rather than a bug in this route.
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Unknown error running the agent.",
        });
      } finally {
        if (sandbox) {
          await sandbox.stop().catch(() => {
            // Best-effort cleanup — don't fail the request over it.
          });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

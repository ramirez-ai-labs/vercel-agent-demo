import { generateObject } from "ai";
import { Sandbox } from "@vercel/sandbox";
import { scriptSchema, type AgentEvent } from "@/lib/schema";

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

        const { object } = await generateObject({
          model: process.env.AI_MODEL ?? "openai/gpt-4o-mini",
          schema: scriptSchema,
          system: [
            "You write small, self-contained scripts that fulfil the user's coding request.",
            "Prefer Node.js unless Python is clearly a better fit for the task.",
            "(Soft constraint: defaults to Node for fast provisioning; we don't validate post-generation.)",
            "Keep the script under 60 lines. Print results to stdout with console.log or print().",
            "The script must not read from or write to the network, and must not access",
            "the filesystem outside its own working directory. It runs unattended — do not",
            "wait on stdin or any interactive input.",
          ].join(" "),
          prompt,
        });

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

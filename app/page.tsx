"use client";

import { useRef, useState } from "react";
import type { AgentEvent, GeneratedScript } from "@/lib/schema";

type Result = { exitCode: number; stdout: string; stderr: string };

export default function Home() {
  const [prompt, setPrompt] = useState(
    "Write a script that estimates pi using a Monte Carlo simulation with 100,000 samples."
  );
  const [running, setRunning] = useState(false);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [script, setScript] = useState<GeneratedScript | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);

  async function runAgent(e: React.FormEvent) {
    e.preventDefault();
    if (running || !prompt.trim()) return;

    setRunning(true);
    setStatusLog([]);
    setScript(null);
    setResult(null);
    setError(null);

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });

      if (!res.body) throw new Error("No response stream from /api/agent.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as AgentEvent;
            applyEvent(event);
          } catch (e) {
            console.error("Failed to parse event:", line, e);
            setError("Stream parsing error. Check browser console for details.");
            break;
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setRunning(false);
    }
  }

  function applyEvent(event: AgentEvent) {
    switch (event.type) {
      case "status":
        setStatusLog((log) => [...log, event.message]);
        break;
      case "code":
        setScript({
          language: event.language,
          filename: event.filename,
          code: event.code,
          summary: event.summary,
        });
        break;
      case "result":
        setResult({ exitCode: event.exitCode, stdout: event.stdout, stderr: event.stderr });
        break;
      case "error":
        setError(event.message);
        break;
      case "done":
        break;
    }
  }

  return (
    <main>
      <div className="prompt-line">
        <span className="prompt-symbol">$</span>
        <span>sandbox-agent-demo — Next.js · AI SDK · Vercel Sandbox</span>
      </div>
      <h1>Describe a small coding task</h1>
      <p className="subtitle">
        The model writes a self-contained script, then it runs inside an isolated Vercel
        Sandbox (a Firecracker microVM) — not on this server. Output streams back below.
      </p>

      <form onSubmit={runAgent}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Sort this list of numbers and print the median: [4, 1, 7, 3, 9, 2]"
          disabled={running}
        />
        <button type="submit" disabled={running}>
          {running ? "Running…" : "Run"}
        </button>
      </form>

      {statusLog.length > 0 && (
        <div className="log" style={{ marginBottom: "1.5rem" }}>
          {statusLog.map((message, i) => (
            <div className="log-line" key={i}>
              → {message}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="panel" style={{ marginBottom: "1.5rem" }}>
          <div className="panel-header">Error</div>
          <pre className="stderr">{error}</pre>
        </div>
      )}

      {script && (
        <div className="panel" style={{ marginBottom: "1.5rem" }}>
          <div className="panel-header">
            {script.filename} · {script.language} — {script.summary}
          </div>
          <pre>{script.code}</pre>
        </div>
      )}

      {result && (
        <div className="panel">
          <div className="panel-header">Sandbox output</div>
          {result.stdout && <pre>{result.stdout}</pre>}
          {result.stderr && <pre className="stderr">{result.stderr}</pre>}
          <div className={`exit-code ${result.exitCode === 0 ? "ok" : "fail"}`}>
            exit code {result.exitCode}
          </div>
        </div>
      )}
    </main>
  );
}

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    create: vi.fn(),
  },
}));

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

describe('/api/agent route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects request without prompt', async () => {
    const { POST } = await import('../route');
    const request = new Request('http://localhost/api/agent', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json() as any;

    expect(response.status).toBe(400);
    expect(data.error).toContain('prompt');
  });

  it('rejects non-JSON request', async () => {
    const { POST } = await import('../route');
    const request = new Request('http://localhost/api/agent', {
      method: 'POST',
      body: 'invalid json',
      headers: { 'Content-Type': 'text/plain' },
    });

    const response = await POST(request);
    const data = await response.json() as any;

    expect(response.status).toBe(400);
    expect(data.error).toContain('JSON');
  });

  it('rejects empty prompt', async () => {
    const { POST } = await import('../route');
    const request = new Request('http://localhost/api/agent', {
      method: 'POST',
      body: JSON.stringify({ prompt: '   ' }),
    });

    const response = await POST(request);
    const data = await response.json() as any;

    expect(response.status).toBe(400);
  });

  it('rejects non-string prompt', async () => {
    const { POST } = await import('../route');
    const request = new Request('http://localhost/api/agent', {
      method: 'POST',
      body: JSON.stringify({ prompt: 123 }),
    });

    const response = await POST(request);
    const data = await response.json() as any;

    expect(response.status).toBe(400);
  });

  it('returns stream with correct content-type', async () => {
    const { generateObject } = await import('ai');
    const { Sandbox } = await import('@vercel/sandbox');

    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        language: 'node',
        filename: 'test.js',
        code: 'console.log("test");',
        summary: 'Test script',
      },
    } as any);

    vi.mocked(Sandbox.create).mockResolvedValueOnce({
      writeFiles: vi.fn().mockResolvedValueOnce(undefined),
      runCommand: vi.fn().mockResolvedValueOnce({
        exitCode: 0,
        stdout: async () => 'output',
        stderr: async () => '',
      }),
      stop: vi.fn().mockResolvedValueOnce(undefined),
    } as any);

    const { POST } = await import('../route');
    const request = new Request('http://localhost/api/agent', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'Write hello world' }),
    });

    const response = await POST(request);

    expect(response.headers.get('Content-Type')).toBe('application/x-ndjson; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('streams status events', async () => {
    const { generateObject } = await import('ai');
    const { Sandbox } = await import('@vercel/sandbox');

    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        language: 'node',
        filename: 'test.js',
        code: 'console.log("hello");',
        summary: 'Print hello',
      },
    } as any);

    vi.mocked(Sandbox.create).mockResolvedValueOnce({
      writeFiles: vi.fn().mockResolvedValueOnce(undefined),
      runCommand: vi.fn().mockResolvedValueOnce({
        exitCode: 0,
        stdout: async () => 'hello',
        stderr: async () => '',
      }),
      stop: vi.fn().mockResolvedValueOnce(undefined),
    } as any);

    const { POST } = await import('../route');
    const request = new Request('http://localhost/api/agent', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'Hello world' }),
    });

    const response = await POST(request);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(new TextDecoder().decode(value));
    }

    const text = chunks.join('');
    const lines = text.split('\n').filter(line => line.trim());

    expect(lines.length).toBeGreaterThan(0);
    const events = lines.map(line => JSON.parse(line));

    expect(events.some((e: any) => e.type === 'status')).toBe(true);
    expect(events.some((e: any) => e.type === 'code')).toBe(true);
    expect(events.some((e: any) => e.type === 'result')).toBe(true);
    expect(events.some((e: any) => e.type === 'done')).toBe(true);
  });

  it('emits error event on model failure', async () => {
    const { generateObject } = await import('ai');

    vi.mocked(generateObject).mockRejectedValueOnce(new Error('Model error'));

    const { POST } = await import('../route');
    const request = new Request('http://localhost/api/agent', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'Test' }),
    });

    const response = await POST(request);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(new TextDecoder().decode(value));
    }

    const lines = chunks.join('').split('\n').filter(line => line.trim());
    const events = lines.map(line => JSON.parse(line));

    expect(events.some((e: any) => e.type === 'error')).toBe(true);
    expect(events.some((e: any) => e.type === 'done')).toBe(false);
  });

  it('cleans up sandbox on error', async () => {
    const { Sandbox } = await import('@vercel/sandbox');

    const stopFn = vi.fn().mockResolvedValueOnce(undefined);
    vi.mocked(Sandbox.create).mockResolvedValueOnce({
      writeFiles: vi.fn().mockRejectedValueOnce(new Error('Write failed')),
      runCommand: vi.fn(),
      stop: stopFn,
    } as any);

    const { generateObject } = await import('ai');
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        language: 'node',
        filename: 'test.js',
        code: 'console.log("test");',
        summary: 'Test',
      },
    } as any);

    const { POST } = await import('../route');
    const request = new Request('http://localhost/api/agent', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'Test' }),
    });

    const response = await POST(request);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(stopFn).toHaveBeenCalled();
  });
});

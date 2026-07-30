import { describe, it, expect } from 'vitest';
import { scriptSchema, type GeneratedScript, type AgentEvent } from '@/lib/schema';

describe('scriptSchema', () => {
  it('accepts valid Node.js script', () => {
    const valid = {
      language: 'node',
      filename: 'script.js',
      code: 'console.log("hello");',
      summary: 'Print hello to stdout',
    };
    const result = scriptSchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect((result as any).data).toEqual(valid);
  });

  it('accepts valid Python script', () => {
    const valid = {
      language: 'python',
      filename: 'script.py',
      code: 'print("hello")',
      summary: 'Print hello to stdout',
    };
    const result = scriptSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid language', () => {
    const invalid = {
      language: 'rust',
      filename: 'script.rs',
      code: 'fn main() {}',
      summary: 'Empty rust program',
    };
    const result = scriptSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects missing filename', () => {
    const invalid = {
      language: 'node',
      code: 'console.log("hello");',
      summary: 'Print hello',
    };
    const result = scriptSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects missing code', () => {
    const invalid = {
      language: 'node',
      filename: 'script.js',
      summary: 'Print hello',
    };
    const result = scriptSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects missing summary', () => {
    const invalid = {
      language: 'node',
      filename: 'script.js',
      code: 'console.log("hello");',
    };
    const result = scriptSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects empty filename', () => {
    const invalid = {
      language: 'node',
      filename: '',
      code: 'console.log("hello");',
      summary: 'Print hello',
    };
    const result = scriptSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('allows long code strings', () => {
    const longCode = Array(100).fill('console.log("x");').join('\n');
    const valid = {
      language: 'node',
      filename: 'script.js',
      code: longCode,
      summary: 'Long script',
    };
    const result = scriptSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('type inference works correctly', () => {
    const script: GeneratedScript = {
      language: 'python',
      filename: 'test.py',
      code: 'print("test")',
      summary: 'Test script',
    };
    expect(script.language).toBe('python');
    expect(typeof script.code).toBe('string');
  });
});

describe('AgentEvent types', () => {
  it('status event is valid', () => {
    const event: AgentEvent = {
      type: 'status',
      message: 'Processing...',
    };
    expect(event.type).toBe('status');
    expect((event as any).message).toBe('Processing...');
  });

  it('code event contains script', () => {
    const event: AgentEvent = {
      type: 'code',
      language: 'node',
      filename: 'test.js',
      code: 'console.log("test");',
      summary: 'Test script',
    };
    expect(event.type).toBe('code');
    expect((event as any).language).toBe('node');
  });

  it('result event contains exit code and output', () => {
    const event: AgentEvent = {
      type: 'result',
      exitCode: 0,
      stdout: 'output',
      stderr: '',
    };
    expect(event.type).toBe('result');
    expect((event as any).exitCode).toBe(0);
    expect((event as any).stdout).toBe('output');
  });

  it('error event contains message', () => {
    const event: AgentEvent = {
      type: 'error',
      message: 'Something went wrong',
    };
    expect(event.type).toBe('error');
    expect((event as any).message).toBe('Something went wrong');
  });

  it('done event exists', () => {
    const event: AgentEvent = { type: 'done' };
    expect(event.type).toBe('done');
  });
});

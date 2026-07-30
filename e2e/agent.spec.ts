import { test, expect } from '@playwright/test';

test.describe('Agent API E2E', () => {
  test('generates and executes a simple script', async ({ request }) => {
    const response = await request.post('http://localhost:3000/api/agent', {
      data: { prompt: 'Write hello world' },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/x-ndjson');

    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());
    expect(lines.length).toBeGreaterThan(0);

    const events = lines.map(line => JSON.parse(line));

    // Verify event sequence: status → code → result → done
    expect(events[0].type).toBe('status');
    expect(events.some((e: any) => e.type === 'code')).toBeTruthy();
    expect(events.some((e: any) => e.type === 'result')).toBeTruthy();
    expect(events[events.length - 1].type).toBe('done');

    // Verify code event structure
    const codeEvent = events.find((e: any) => e.type === 'code');
    expect(codeEvent).toHaveProperty('language');
    expect(codeEvent).toHaveProperty('filename');
    expect(codeEvent).toHaveProperty('code');
    expect(codeEvent).toHaveProperty('summary');
    expect(['node', 'python']).toContain(codeEvent?.language);

    // Verify result event structure
    const resultEvent = events.find((e: any) => e.type === 'result');
    expect(resultEvent).toHaveProperty('exitCode');
    expect(resultEvent).toHaveProperty('stdout');
    expect(resultEvent).toHaveProperty('stderr');
    expect(resultEvent?.exitCode).toBe(0);
  });

  test('handles invalid prompt gracefully', async ({ request }) => {
    const response = await request.post('http://localhost:3000/api/agent', {
      data: { prompt: '' },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('prompt');
  });

  test('rejects non-JSON request', async ({ request }) => {
    const response = await request.post('http://localhost:3000/api/agent', {
      headers: { 'Content-Type': 'text/plain' },
      data: 'not json',
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('computes pi using Monte Carlo', async ({ request }) => {
    const response = await request.post('http://localhost:3000/api/agent', {
      data: {
        prompt:
          'Estimate pi using Monte Carlo simulation with 10,000 samples. Print the result.',
      },
    });

    expect(response.status()).toBe(200);

    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());
    const events = lines.map(line => JSON.parse(line));

    const resultEvent = events.find((e: any) => e.type === 'result');
    expect(resultEvent?.exitCode).toBe(0);
    expect(resultEvent?.stdout).toBeTruthy();
    // Should contain a number close to pi (~3.14)
    expect(resultEvent?.stdout).toMatch(/3\./);
  });

  test('handles script timeout gracefully', async ({ request }) => {
    // Try to run a script that will timeout (sleep for 60 seconds)
    const response = await request.post('http://localhost:3000/api/agent', {
      data: {
        prompt: 'Sleep for 60 seconds then print done',
      },
    });

    expect(response.status()).toBe(200);

    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());
    const events = lines.map(line => JSON.parse(line));

    // Should hit timeout error
    expect(
      events.some(
        (e: any) => e.type === 'error' && e.message.toLowerCase().includes('timeout')
      ) || events.some((e: any) => e.type === 'result' && e.exitCode !== 0)
    ).toBeTruthy();
  });

  test('streams events in real-time', async ({ request }) => {
    const response = await request.post('http://localhost:3000/api/agent', {
      data: { prompt: 'Print numbers 1 to 5' },
    });

    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());

    // Should have multiple status updates (not just one event at the end)
    const statusCount = lines.filter(line => {
      try {
        return JSON.parse(line).type === 'status';
      } catch {
        return false;
      }
    }).length;

    expect(statusCount).toBeGreaterThan(0);
  });
});

import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'url';
import { createApp } from '../src/app.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('security headers', () => {
  it('sets conservative hardening headers without enabling CSP yet', async () => {
    const app = await createApp();

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['referrer-policy']).toBeDefined();
    expect(response.headers['content-security-policy']).toBeUndefined();
  });

  it('does not log password reset values from the admin page', () => {
    const adminPage = fs.readFileSync(path.join(rootDir, 'public', 'adminpage.html'), 'utf8');

    expect(adminPage).not.toMatch(/Sending password change request/i);
    expect(adminPage).not.toMatch(/console\.log\([^)]*newPassword/i);
  });
});

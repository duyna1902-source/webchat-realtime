import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('GDG-HUST Brand Assets & Design Tokens (Ticket 01)', () => {
  const rootDir = path.resolve(__dirname, '..');
  const indexHtmlPath = path.join(rootDir, 'index.html');
  const tailwindConfigPath = path.join(rootDir, 'tailwind.config.js');
  const brandAssetsDir = path.join(rootDir, 'public', 'assets', 'brand');

  it('sets browser document title to "GDG-HUST" in index.html', () => {
    const htmlContent = fs.readFileSync(indexHtmlPath, 'utf-8');
    expect(htmlContent).toMatch(/<title>\s*GDG-HUST\s*<\/title>/i);
  });

  it('sets browser favicon link to official cropped GDG mark in index.html', () => {
    const htmlContent = fs.readFileSync(indexHtmlPath, 'utf-8');
    expect(htmlContent).toMatch(/<link\s+[^>]*rel=["']icon["'][^>]*href=["']\/assets\/brand\/logo-gdg-clean\.webp["']/i);
  });

  it('deploys cropped GDG brand images to client/public/assets/brand/', () => {
    const logoFile = path.join(brandAssetsDir, 'logo-gdg-clean.webp');
    const lockupFile = path.join(brandAssetsDir, 'gdg-hust-lockup-clean.webp');

    expect(fs.existsSync(logoFile), 'logo-gdg-clean.webp should exist in public/assets/brand/').toBe(true);
    expect(fs.existsSync(lockupFile), 'gdg-hust-lockup-clean.webp should exist in public/assets/brand/').toBe(true);

    const logoStats = fs.statSync(logoFile);
    const lockupStats = fs.statSync(lockupFile);
    expect(logoStats.size).toBeGreaterThan(1000);
    expect(lockupStats.size).toBeGreaterThan(1000);
  });

  it('defines semantic Google palette tokens and primary theme alias in tailwind.config.js', async () => {
    const tailwindConfigFile = fs.readFileSync(tailwindConfigPath, 'utf-8');

    // Verify presence of Google color tokens
    expect(tailwindConfigFile).toContain('#4285F4'); // Google Blue
    expect(tailwindConfigFile).toContain('#EA4335'); // Google Red
    expect(tailwindConfigFile).toContain('#FBBC04'); // Google Yellow
    expect(tailwindConfigFile).toContain('#34A853'); // Google Green
    expect(tailwindConfigFile).toContain('#F1F3F4'); // Google Grey 100
    expect(tailwindConfigFile).toContain('#202124'); // Google Grey 900

    // Import tailwind config module
    const tailwindModule = await import(/* @vite-ignore */ `file://${tailwindConfigPath}`);
    const config = tailwindModule.default || tailwindModule;
    const colors = config.theme?.extend?.colors || {};

    // Google palette tokens
    expect(colors.google).toBeDefined();
    expect(colors.google.blue).toBe('#4285F4');
    expect(colors.google.red).toBe('#EA4335');
    expect(colors.google.yellow).toBe('#FBBC04');
    expect(colors.google.green).toBe('#34A853');
    expect(colors.google.grey100).toBe('#F1F3F4');

    // Primary theme alias
    expect(colors.primary).toBeDefined();
    const primaryBlue = typeof colors.primary === 'string' ? colors.primary : colors.primary.DEFAULT || colors.primary['500'];
    expect(primaryBlue).toBe('#4285F4');
  });
});

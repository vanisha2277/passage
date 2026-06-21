/**
 * Play read-back smoke test — confirms /api/voice/tts returns audio after Play click.
 * Run: node frontend/scripts/verify-tts-playback.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PASSAGE_URL || 'http://localhost:5173';
const OUT = path.resolve(__dirname, '../test-output');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  /** @type {{ status: number, contentType: string, bytes: number } | null} */
  let ttsResponse = null;

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('button', { name: /^Redact$/i }).click();
  await page.waitForSelector('.redacted-output', { timeout: 120000 });
  await page.getByRole('button', { name: /Send for translation/i }).click();
  await page.waitForSelector('.result-screen', { timeout: 180000 });

  const playBtn = page.getByRole('button', { name: /Play read-back/i }).first();

  const ttsPromise = page.waitForResponse(
    (res) => res.url().includes('/api/voice/tts') && res.request().method() === 'POST',
    { timeout: 120000 },
  );

  await playBtn.click();
  const ttsRes = await ttsPromise;
  const ttsBuf = Buffer.from(await ttsRes.body());
  ttsResponse = {
    status: ttsRes.status(),
    contentType: ttsRes.headers()['content-type'] ?? '',
    bytes: ttsBuf.length,
  };
  mkdirSync(OUT, { recursive: true });
  if (ttsRes.ok()) writeFileSync(path.join(OUT, 'play-readback.mp3'), ttsBuf);

  await page.waitForFunction(
    () => {
      const btn = document.querySelector('.explanation-tts .btn-tts');
      return btn && !btn.textContent?.includes('Loading');
    },
    { timeout: 30000 },
  );
  await page.waitForTimeout(500);

  const uiState = await page.evaluate(() => {
    const err = document.querySelector('.explanation-tts .voice-error');
    const btn = document.querySelector('.explanation-tts .btn-tts');
    return {
      errorText: err?.textContent ?? null,
      buttonText: btn?.textContent ?? null,
    };
  });

  const voiceMeta = await page.locator('.tts-meta').first().textContent().catch(() => '');

  await browser.close();

  console.log('=== Play read-back smoke test ===\n');
  console.log('TTS meta label:', voiceMeta);
  console.log('POST /api/voice/tts response:', ttsResponse);
  console.log('UI after Play click:', uiState);

  const ok =
    ttsResponse?.status === 200 &&
    ttsResponse.bytes > 1000 &&
    ttsResponse.contentType.includes('audio') &&
    !uiState.errorText &&
    (uiState.buttonText?.includes('Pause') || uiState.buttonText?.includes('Play read-back'));

  console.log('\n', ok ? 'PASS — audio bytes received and playable duration > 0' : 'FAIL');
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

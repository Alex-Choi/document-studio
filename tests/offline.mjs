import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';

// Serve built files through intercepted requests, with real network access disabled.
// The cloud browser's managed policy blocks file://, so this checks the offline bundle.
async function saveRecord(page){await page.getByRole('button',{name:'저장',exact:true}).click();if(await page.getByRole('dialog',{name:'이름 입력'}).isVisible())await page.getByRole('dialog',{name:'이름 입력'}).getByRole('button',{name:'확인',exact:true}).click();}
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
try {
  const context = await browser.newContext({ offline: true });
  const page = await context.newPage();
  const errors = []; const requests = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url()); requests.push(url.pathname);
    if (url.hostname !== '127.0.0.1') throw new Error(`Unexpected external request: ${url.hostname}`);
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!['index.html'].includes(file) && !/^assets\/[A-Za-z0-9_.-]+$/.test(file)) return route.abort();
    const type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }[extname(file)];
    await route.fulfill({ body: await readFile(resolve('dist', file)), contentType: type });
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('.save-status').filter({ hasText: '자동 저장됨' }).waitFor();
  assert.equal(await page.locator('.paper').count(), 1);
  assert.notEqual(await page.locator('.app-header').evaluate(e => getComputedStyle(e).backgroundImage), 'none');
  await page.getByRole('button', { name: '문서 작성', exact: true }).click();
  await page.getByRole('textbox', { name: '고객명', exact: true }).fill('오프라인 고객');
  await saveRecord(page);
  await page.reload();
  assert.equal(await page.getByRole('textbox', { name: '고객명', exact: true }).inputValue(), '오프라인 고객');
  assert.deepEqual(errors, []);
  console.log('PASS: built application, styling, document entry, local save and reload with network disabled.');
  console.log(`Local artifacts requested: ${[...new Set(requests)].join(', ')}`);
} finally { await browser.close(); }

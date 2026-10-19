import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { makeBlock, newDoc } from '../src/core/model';
import { columnPercentages, resizeColumnBoundary } from '../src/core/table';
import { validateDoc } from '../src/core/storage';

async function stored(page: Page) {
  await expect(page.locator('.save-status')).toContainText('자동 저장됨');
  return page.evaluate(() => JSON.parse(localStorage.getItem('document-studio.v1')!).draft.doc);
}
async function seed(page: Page, rows = 3) {
  await page.goto('/');
  const doc = newDoc('견적서', true), block = makeBlock('table', 0);
  const cols = block.table!.columns;
  block.table!.rows = Array.from({ length: rows }, (_, i) => ({ [cols[0].id]: `항목 ${i + 1}`, [cols[1].id]: '2', [cols[2].id]: '3000' }));
  doc.blocks = [block];
  await page.getByTestId('backup-import').setInputFiles({ name: 'table.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, templates: [], documents: [], assets: [], draft: { doc, mode: 'template' } })) });
  await expect(page.locator('.save-status')).toContainText('자동 저장됨');
  await page.locator('.paper table th').first().click();
  return block;
}
async function drag(page: Page, deltaPercent: number, cancel = false) {
  const table = await page.locator('.paper table').first().boundingBox();
  const handle = await page.getByRole('button', { name: '항목 오른쪽 열 경계 조절' }).first().boundingBox();
  const x = handle!.x + handle!.width / 2, y = handle!.y + 16;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + table!.width * deltaPercent / 100, y, { steps: 8 });
  if (cancel) await page.keyboard.press('Escape');
  await page.mouse.up();
}

test('열 경계 계산은 인접 두 열만 조절하고 최소 너비와 전체 너비를 유지한다', () => {
  const columns = makeBlock('table', 0).table!.columns;
  const adjusted = resizeColumnBoundary(columns, 0, 7);
  columnPercentages(adjusted).forEach((width, i) => expect(width).toBeCloseTo([49, 7, 22, 22][i], 6));
  expect(columns[0].width).toBe(42);
  const clamped = resizeColumnBoundary(columns, 0, 100, 4);
  columnPercentages(clamped).forEach((width, i) => expect(width).toBeCloseTo([52, 4, 22, 22][i], 6));
  expect(adjusted.map(c => c.id)).toEqual(columns.map(c => c.id));
  const doc = newDoc('견적서', true), narrow = makeBlock('table', 0);
  narrow.table!.columns[0].width = 1;
  narrow.table!.columns.slice(1).forEach(c => c.width = 100);
  narrow.table!.columns = resizeColumnBoundary(narrow.table!.columns, 1, 2);
  doc.blocks = [narrow];
  expect(validateDoc(doc)).toBe(true);
});

test('표 경계 드래그는 확대·축소를 반영하고 한 번의 실행 취소 및 Esc 취소를 지원한다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await seed(page);
  await expect(page.locator('.column-settings')).not.toHaveAttribute('open');
  const before = (await stored(page)).blocks[0];
  for (const zoom of [70, 110]) {
    const current = () => page.locator('.zoom-percent').innerText().then(t => Number(t.replace('%', '')));
    while (await current() > zoom) await page.getByRole('button', { name: '축소', exact: true }).click();
    while (await current() < zoom) await page.getByRole('button', { name: '확대', exact: true }).click();
    await drag(page, 5);
    const after = (await stored(page)).blocks[0];
    expect(after.table.columns[0].width).toBeCloseTo(47, 0);
    expect(after.table.columns[1].width).toBeCloseTo(9, 0);
    expect(after.table.rows).toEqual(before.table.rows);
    expect(after.col).toBe(before.col); expect(after.span).toBe(before.span);
    await page.getByRole('button', { name: '실행 취소', exact: true }).click();
    expect((await stored(page)).blocks[0].table.columns).toEqual(before.table.columns);
    await page.getByRole('button', { name: '다시 실행', exact: true }).click();
    expect((await stored(page)).blocks[0].table.columns).toEqual(after.table.columns);
    await drag(page, -6, true);
    expect((await stored(page)).blocks[0].table.columns).toEqual(after.table.columns);
    await page.getByRole('button', { name: '실행 취소', exact: true }).click();
  }
  expect(errors).toEqual([]);
});

test('여러 페이지 표의 열 너비를 함께 변경·복원하고 인쇄에는 조절선을 숨긴다', async ({ page }) => {
  const block = await seed(page, 70);
  await expect.poll(() => page.locator('.paper table').count()).toBeGreaterThan(2);
  await drag(page, -8);
  const after = (await stored(page)).blocks[0];
  expect(after.table.columns[0].width).toBeCloseTo(34, 0);
  const percentages = columnPercentages(after.table.columns);
  for (const table of await page.locator('.paper table').all()) {
    const widths = await table.locator('col').evaluateAll(cols => cols.map(col => parseFloat((col as HTMLElement).style.width)));
    widths.forEach((width, i) => expect(width).toBeCloseTo(percentages[i], 2));
  }
  expect((await stored(page)).blocks.filter((b: { type: string }) => b.type === 'table')).toHaveLength(1);
  await page.reload();
  expect((await stored(page)).blocks[0].table.columns).toEqual(after.table.columns);
  await expect(page.locator('.paper tbody tr')).toHaveCount(70);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.paper .table-column-resizer').first()).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: '문서 작성', exact: true }).click();
  await expect(page.locator('.paper .table-column-resizer')).toHaveCount(0);
  expect(block.table!.rows).toHaveLength(70);
});

test('열을 좁혀 긴 셀이 줄바꿈되면 페이지와 아래 블록 배치를 다시 계산한다', async ({ page }) => {
  await seed(page, 20);
  const doc = await stored(page), table = doc.blocks[0];
  table.table.rows.forEach((row: Record<string, string>) => row[table.table.columns[0].id] = '물품 수령 상태와 특이사항을 상세히 기록합니다.');
  const note = makeBlock('text', 1); note.text = '표 다음에 놓은 확인 문구'; doc.blocks.push(note);
  await page.getByTestId('backup-import').setInputFiles({ name: 'wrapping.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, templates: [], documents: [], assets: [], draft: { doc, mode: 'template' } })) });
  await expect(page.locator('.save-status')).toContainText('자동 저장됨');
  const before = await page.locator('.paper').count();
  await drag(page, -25);
  await expect.poll(() => page.locator('.paper').count()).toBeGreaterThan(before);
  await expect(page.locator('.paper tbody tr')).toHaveCount(20);
  await expect(page.locator('.paper').last()).toContainText(note.text);
  const overlap = await page.locator('.paper').evaluateAll(papers => papers.some(paper => {
    const rows = [...paper.querySelectorAll('.layout-row')].map(row => row.getBoundingClientRect());
    return rows.some((row, i) => i > 0 && rows[i - 1].bottom > row.top + .5);
  }));
  expect(overlap).toBe(false);
});

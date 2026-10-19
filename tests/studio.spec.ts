import {selectedGeometry,saveMenuAction,resizeSelected,moveSelected} from './editor-actions';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { clone, makeBlock, newDoc, uid } from '../src/core/model';
import type { Asset, Library, StudioDoc } from '../src/core/model';

async function openImagePicker(page:Page){const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:/새 이미지 업로드/}).click();await chooser;}

async function boot(page: Page) { await page.goto('/'); await expect(page.locator('.save-status')).toContainText('자동 저장됨'); }
async function library(page: Page): Promise<Library> { await expect(page.locator('.save-status')).toContainText('자동 저장됨'); return page.evaluate(() => JSON.parse(localStorage.getItem('document-studio.v1')!)); }
async function seed(page: Page, doc: StudioDoc, mode: 'template' | 'document' = 'template', assets: Asset[] = []) { const lib: Library = { version: 1, templates: [], documents: [], assets, draft: { doc, mode } }; await page.getByTestId('backup-import').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(lib))}); await expect(page.getByLabel('문서 이름')).toHaveValue(doc.name); await expect(page.locator('.save-status')).toContainText('자동 저장됨'); }
async function saveRecord(page:Page){await saveMenuAction(page);if(await page.getByRole('dialog',{name:'이름 입력'}).isVisible())await page.getByRole('dialog',{name:'이름 입력'}).getByRole('button',{name:'확인',exact:true}).click();}
function tableDoc(count: number) { const d = newDoc(); const b = d.blocks.find(b => b.table)!; const cs = b.table!.columns; b.table!.rows = Array.from({ length: count }, (_,i) => ({ [cs[0].id]: `운송 항목 ${i + 1}`, [cs[1].id]: '2', [cs[2].id]: '1000', [cs[3].id]: '' })); return d; }
function signatureAsset(): Asset { return { id: uid(), name: '투명 서명', category: 'signature', data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGMQkdP4zwAEAAdmAVp9gFAdAAAAAElFTkSuQmCC', width: 2, height: 1 }; }

test('빈 양식: 나란히 배치, 편집, 복제·삭제, 실행 취소', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror',e=>errors.push(e.message)); await boot(page);
  await page.getByRole('button',{name:'빈 양식 만들기'}).click();
  await page.getByRole('button',{name:'텍스트',exact:true}).click();
  const first = page.locator('.paper .block-text').first(); await first.locator('.text-content').fill('배송 안내'); await page.getByLabel('문서 이름').click();
  await resizeSelected(page,{span:6}); await page.getByRole('button',{name:'텍스트',exact:true}).click();
  await resizeSelected(page,{span:6}); await moveSelected(page,{col:6}); await moveSelected(page,{row:0});
  await expect(page.locator('.paper .layout-row')).toHaveCount(1); const boxes = await page.locator('.paper .block-text').evaluateAll(e=>e.map(x=>x.getBoundingClientRect().toJSON())); expect(boxes[0].right).toBeLessThan(boxes[1].left);
  await page.getByRole('button',{name:'블록 복제',exact:true}).click(); await expect(page.locator('.paper .block-text')).toHaveCount(3);
  await page.getByRole('button',{name:'블록 삭제',exact:true}).click(); await expect(page.locator('.paper .block-text')).toHaveCount(2);
  await page.getByRole('button',{name:'실행 취소',exact:true}).click(); await expect(page.locator('.paper .block-text')).toHaveCount(3);
  await page.getByRole('button',{name:'다시 실행',exact:true}).click(); await expect(page.locator('.paper .block-text')).toHaveCount(2); expect(errors).toEqual([]);
});

test('긴 텍스트가 아래 블록을 밀고 여러 페이지로 분할된다', async ({ page }) => {
  await boot(page); const d = newDoc('Agreement',true); const text = makeBlock('text',0); text.text = Array.from({length:120},(_,i)=>`계약 조항 ${i+1}: 본문은 실제 높이에 따라 이어집니다.\n`).join(''); const end = makeBlock('text',1); end.text = '문서의 마지막 문구'; d.blocks=[text,end]; await seed(page,d);
  await expect.poll(()=>page.locator('.paper').count()).toBeGreaterThan(2);
  const chunks = await page.locator(`.paper [data-block-id="${text.id}"] .text-content`).evaluateAll(async es=>{const modulePath='/src/core/rich.ts';const m=await import(modulePath);return es.map(e=>m.richText(m.readRuns(e)));}); expect(chunks.join('')).toBe(text.text);
  const overlap = await page.locator('.paper').evaluateAll(papers=>papers.some(p=>{const rows=[...p.querySelectorAll('.layout-row')].map(r=>r.getBoundingClientRect());return rows.some((r,i)=>i>0&&rows[i-1].bottom>r.top+.5);})); expect(overlap).toBe(false); await expect(page.locator('.paper').last()).toContainText('문서의 마지막 문구');
});

test('표 70행: 원본 데이터 하나, 머리행 반복, 행 단위 분할·자동 페이지 정리', async ({ page }) => {
  await boot(page); const d=tableDoc(70); await seed(page,d); await expect.poll(()=>page.locator('.paper').count()).toBeGreaterThan(2);
  const tables=page.locator('.paper table'); expect(await tables.count()).toBeGreaterThan(2); expect(await page.locator('.paper tbody tr').count()).toBe(70);
  for(const t of await tables.all()) await expect(t.locator('thead')).toContainText('항목');
  expect((await library(page)).draft.doc.blocks.filter(b=>b.type==='table')).toHaveLength(1);
  const table=page.locator('.paper .block-table').last(); await table.locator('tbody tr').last().locator('td').first().fill('마지막 수정'); await page.getByLabel('문서 이름').click(); expect((await library(page)).draft.doc.blocks.find(b=>b.table)!.table!.rows[69][d.blocks.find(b=>b.table)!.table!.columns[0].id]).toBe('마지막 수정');
  const small=clone(d); small.blocks.find(b=>b.table)!.table!.rows=small.blocks.find(b=>b.table)!.table!.rows.slice(0,3); await seed(page,small); await expect(page.locator('.paper')).toHaveCount(1);
});

test('머리글 높이·첫 페이지 숨김·페이지 번호, 본문 비겹침', async ({page})=>{
  await boot(page); await seed(page,tableDoc(45)); await page.getByRole('button',{name:'머리글 편집'}).click(); await page.getByRole('spinbutton',{name:'영역 높이'}).fill('45');
  await page.locator('.right-panel').getByRole('button',{name:'도형',exact:true}).click(); const shape=await page.locator('.paper').first().locator('.header .decoration>div').boundingBox(); expect(shape!.width).toBeGreaterThan(10);
  const valid=await page.locator('.paper').evaluateAll(ps=>ps.every(p=>p.querySelector('.header')!.getBoundingClientRect().bottom<=p.querySelector('.page-body')!.getBoundingClientRect().top+.1)); expect(valid).toBe(true);
  await page.getByLabel('첫 페이지', {exact:true}).selectOption('hide'); await expect(page.locator('.paper').first().locator('.header')).toHaveCSS('height','0px'); await expect(page.locator('.paper').nth(1).locator('.header')).not.toHaveCSS('height','0px');
  const n=await page.locator('.paper').count(); await expect(page.locator('.paper').last().locator('.footer')).toContainText(`${n} / ${n}`);
});

test('워터마크 투명도·지정 페이지·삭제, 본문 위치 유지',async({page})=>{
  await boot(page); const d=tableDoc(45); const asset=signatureAsset(); d.page.watermark={...d.page.watermark,asset,enabled:true,transparency:0}; await seed(page,d);
  const before=await page.locator('.paper .layout-row').first().boundingBox(); await page.getByRole('button',{name:'배경 · 워터마크 설정'}).click(); await page.getByRole('slider',{name:'워터마크 투명도'}).fill('100'); await expect(page.getByTestId('watermark-image').first()).toHaveCSS('opacity','0');
  expect(await page.locator('.paper .layout-row').first().boundingBox()).toEqual(before); await page.getByRole('slider',{name:'워터마크 투명도'}).fill('0'); await expect(page.getByTestId('watermark-image').first()).toHaveCSS('opacity','1');
  await page.getByLabel('적용 범위').selectOption('pages'); await page.getByLabel('페이지 번호 (쉼표 구분)').fill('2'); await expect(page.getByTestId('watermark-image')).toHaveCount(1); await page.getByRole('button',{name:'워터마크 삭제'}).click(); await expect(page.getByTestId('watermark-image')).toHaveCount(0);
});

test('서명 업로드·비율·잠금·보관함 삭제·새로고침·영역 전체 이동', async ({page})=>{
  await boot(page); const d=tableDoc(19); await page.getByRole('button',{name:'도장·서명',exact:true}).click();await openImagePicker(page);
  const asset=signatureAsset(); await page.getByTestId('image-upload').setInputFiles({name:'sign.png',mimeType:'image/png',buffer:Buffer.from(asset.data.split(',')[1],'base64')}); await expect(page.locator('.asset-card')).toHaveCount(1);
  const uploaded=(await library(page)).assets[0]; await page.getByRole('button',{name:'보관함 닫기'}).click(); await seed(page,d,'document',[uploaded]); await page.locator('.paper .block-signature').click(); await page.getByRole('button',{name:'보관함에서 서명 선택'}).click(); await page.getByRole('dialog').getByRole('button',{name:'sign',exact:true}).click();
  const image=page.locator('.paper .signature-image'); await expect(image).toHaveCount(1); const box=await image.boundingBox(); expect(box!.width/box!.height).toBeCloseTo(2,1);
  await page.getByLabel('위치 잠금',{exact:true}).check(); await expect(image).toHaveClass(/locked/); await page.getByRole('button',{name:'도장·서명',exact:true}).click();await page.getByRole('button',{name:'sign 보관함 삭제'}).click();await page.getByRole('button',{name:'보관함 닫기'}).click(); await expect(page.locator('.asset-card')).toHaveCount(0); await expect(image.locator('img')).toBeVisible();
  await expect(page.locator('.save-status')).toContainText('자동 저장됨'); await page.reload(); await expect(page.locator('.paper .signature-image img')).toBeVisible();
  const last=page.locator('.paper').last(); await expect(last.locator('.block-signature')).toHaveCount(1); const stage=await last.locator('.signature-stage').boundingBox(); const body=await last.locator('.page-body').boundingBox(); expect(stage!.y+stage!.height).toBeLessThanOrEqual(body!.y+body!.height+.5);
});

test('양식 저장·다시 열기·복제, 문서 복사본은 양식 수정에 영향받지 않는다',async({page})=>{
  await boot(page); await saveRecord(page); await page.getByRole('button',{name:'문서 작성',exact:true}).click(); await page.getByRole('textbox',{name:'고객명',exact:true}).fill('테스트 고객'); await saveRecord(page);
  const before=await library(page); expect(before.documents[0].values).toEqual(expect.objectContaining(before.draft.doc.values));
  await page.getByRole('button',{name:'양식 보관함',exact:true}).click(); await page.locator('.saved-card').first().getByRole('button',{name:/복제$/}).click(); await expect(page.locator('.saved-card')).toHaveCount(2);
  await page.locator('.saved-card').first().getByRole('button',{name:'양식 편집',exact:true}).click(); await page.locator('.paper .block-text .text-content').first().fill('새로운 제목'); await page.getByLabel('문서 이름').click(); await saveRecord(page);
  const after=await library(page); expect(after.templates.find(t=>t.id===before.templates[0].id)!.blocks[0].text).toBe('새로운 제목'); expect(after.documents[0].blocks[0].text).toBe('견적서');
});

test('수량×단가·합계와 반복 행, 문서 작성에서 구조 편집 제한',async({page})=>{
  await boot(page); await page.getByRole('button',{name:'문서 작성',exact:true}).click(); const table=page.locator('.paper table'); await table.locator('tbody tr').first().locator('td').nth(1).fill('3'); await table.locator('tbody tr').first().locator('td').nth(2).fill('2,000'); await page.getByLabel('문서 이름').click();
  await expect(table.locator('tbody tr').first().locator('td').nth(3)).toHaveText('6,000'); await expect(table.locator('tfoot')).toContainText('506,000'); await page.locator('.paper .block-table').click(); await page.getByRole('button',{name:'행 추가',exact:true}).click(); await expect(table.locator('tbody tr')).toHaveCount(4);
  await expect(page.getByRole('button',{name:'텍스트',exact:true})).toBeDisabled(); await expect(page.getByRole('button',{name:'열 추가',exact:true})).toBeDisabled(); await expect(page.getByRole('button',{name:'블록 이동',exact:true})).toHaveCount(0);
});

test('이미지 포함 JSON 내보내기·가져오기, 잘못된 백업 거부', async ({page})=>{
  await boot(page); const d=newDoc(); const b=makeBlock('image',7); b.asset=signatureAsset(); d.blocks.push(b); await seed(page,d,'template',[b.asset]); const before=(await library(page));
  const download=page.waitForEvent('download'); await saveMenuAction(page,'all');if(await page.getByRole('dialog',{name:'이름 입력'}).isVisible())await page.getByRole('dialog',{name:'이름 입력'}).getByRole('button',{name:'확인',exact:true}).click(); const file=await download; const path=await file.path(); await page.getByRole('button',{name:'빈 양식 만들기'}).click(); await page.getByTestId('backup-import').setInputFiles(path!); await expect(page.locator('.paper .document-image')).toHaveCount(1); const restored=await library(page); expect(restored.draft.doc.blocks).toEqual(before.draft.doc.blocks); expect(restored.assets).toEqual(before.assets);
  await page.getByTestId('backup-import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":99}')}); await expect(page.getByRole('alert')).toContainText('버전'); expect((await library(page)).draft.doc.blocks).toEqual(before.draft.doc.blocks);
});

test('확대·축소 후 손잡이 이동·너비 조절, 내용 클릭은 이동하지 않는다',async({page})=>{
  await boot(page); await page.getByRole('button',{name:'빈 양식 만들기'}).click(); await page.getByRole('button',{name:'텍스트',exact:true}).click(); await resizeSelected(page,{span:4}); await page.getByRole('button',{name:'확대',exact:true}).click();
  const resize=await page.getByRole('button',{name:'블록 크기 조절',exact:true}).boundingBox(); const body=await page.locator('.page-body').boundingBox(); await page.mouse.move(resize!.x+5,resize!.y+5); await page.mouse.down(); await page.mouse.move(resize!.x+5+body!.width/12*2,resize!.y+5,{steps:5}); await page.mouse.up(); expect((await selectedGeometry(page)).span).toBe(6);
  await page.getByRole('button',{name:'축소',exact:true}).click(); const handle=await page.getByRole('button',{name:'블록 이동',exact:true}).boundingBox(); const body2=await page.locator('.page-body').boundingBox(); await page.mouse.move(handle!.x+8,handle!.y+10); await page.mouse.down(); await page.mouse.move(body2!.x+body2!.width*.54,body2!.y+10,{steps:6}); await page.mouse.up(); expect((await selectedGeometry(page)).col).toBe(6);
  const before=(await library(page)).draft.doc.blocks[0]; await page.locator('.paper .text-content').click(); const after=(await library(page)).draft.doc.blocks[0]; expect(after.col).toBe(before.col); expect(after.row).toBe(before.row);
});

test('수동 페이지 나누기 유지와 패널 접기·너비 조절',async({page})=>{
  await boot(page); await page.getByRole('button',{name:'페이지 나누기',exact:true}).click(); await expect(page.locator('.paper')).toHaveCount(2); await page.getByRole('button',{name:'텍스트',exact:true}).click(); await expect(page.locator('.paper').last()).toContainText('텍스트를 입력하세요'); await page.getByRole('button',{name:'블록 삭제',exact:true}).click(); await expect(page.locator('.paper')).toHaveCount(2);
  const left=await page.locator('.left-panel').boundingBox(); const separator=await page.getByRole('separator',{name:'왼쪽 패널 너비'}).boundingBox(); await page.mouse.move(separator!.x+2,separator!.y+30); await page.mouse.down(); await page.mouse.move(separator!.x+42,separator!.y+30); await page.mouse.up(); expect((await page.locator('.left-panel').boundingBox())!.width).toBeGreaterThan(left!.width);
  await page.getByRole('button',{name:'왼쪽 패널 접기'}).click(); await expect(page.locator('.left-panel')).toHaveClass(/collapsed/); await page.getByRole('button',{name:'왼쪽 패널 펼치기'}).click(); await expect(page.locator('.left-panel')).not.toHaveClass(/collapsed/);
});

test('인쇄 CSS: 편집 도구 제외, A4 다중 페이지 PDF 생성',async({page},testInfo)=>{
  await boot(page); await seed(page,tableDoc(60)); const count=await page.locator('.paper').count(); await page.getByRole('button',{name:'미리보기',exact:true}).click(); await expect(page.locator('.studio')).toHaveClass(/preview-mode/); await page.emulateMedia({media:'print'});
  await expect(page.locator('.app-header')).toBeHidden(); await expect(page.locator('.left-panel')).toBeHidden(); await expect(page.locator('.paper').first()).toHaveCSS('transform','none'); await expect(page.locator('.page-body').first()).toHaveCSS('background-image','none'); await expect(page.locator('.region-label').first()).toBeHidden();
  const pdf=await page.pdf({path:testInfo.outputPath('document-studio.pdf'),preferCSSPageSize:true,printBackground:true}); expect(pdf.length).toBeGreaterThan(10000); expect(count).toBeGreaterThan(2); await expect(page.locator('.paper')).toHaveCount(count); await testInfo.attach('PDF',{body:pdf,contentType:'application/pdf'});
});

test('작은 화면에서 가운데 영역 확보, 두 페이지 보기',async({page})=>{
  await boot(page); await seed(page,tableDoc(40)); await page.getByRole('button',{name:'두 페이지 나란히 보기'}).click(); await expect(page.locator('.document-pages')).toHaveClass(/spread/); const p1=await page.locator('.paper').nth(0).boundingBox(),p2=await page.locator('.paper').nth(1).boundingBox(); expect(p1!.y).toBeCloseTo(p2!.y,0); expect(p1!.x+p1!.width).toBeLessThan(p2!.x);
  await page.setViewportSize({width:390,height:844}); await page.getByRole('button',{name:'세로 연속 보기'}).click(); expect((await page.locator('.canvas-area').boundingBox())!.width).toBeGreaterThan(290); await expect(page.locator('.brand')).toBeVisible();
});

test('입력 중 자동 저장과 페이지 분할, 새로고침 직전 입력 복원',async({page})=>{
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await boot(page); await page.getByRole('button',{name:'빈 양식 만들기'}).click(); await page.getByRole('button',{name:'텍스트',exact:true}).click();
  const value=Array.from({length:100},(_,i)=>`입력 중 조항 ${i+1}: 페이지를 넘어도 모든 문구를 보관합니다.\n`).join('');
  await page.locator('.paper .text-content').fill(value);
  await expect.poll(()=>page.locator('.paper').count()).toBeGreaterThan(2);
  await expect(page.locator('.save-status')).toContainText('자동 저장됨');
  expect((await library(page)).draft.doc.blocks[0].text).toBe(value);
  const chunks=await page.locator('.paper .text-content').evaluateAll(async es=>{const modulePath='/src/core/rich.ts';const m=await import(modulePath);return es.map(e=>m.richText(m.readRuns(e)));}); expect(chunks.join('')).toBe(value);
  await page.reload(); expect((await library(page)).draft.doc.blocks[0].text).toBe(value);
  expect(errors).toEqual([]);
});

test('저장 공간 오류를 표시하고 재시도 후 저장 성공을 확인한다',async({page})=>{
  await boot(page);
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='document-studio.v1')throw new DOMException('테스트 저장 공간 부족','QuotaExceededError');return original.call(this,key,value);};(window as unknown as {restoreStorage:()=>void}).restoreStorage=()=>{Storage.prototype.setItem=original;};});
  await page.getByLabel('문서 이름').fill('저장 실패 확인');
  await expect(page.getByRole('alert')).toContainText('저장 공간 부족'); await expect(page.locator('.save-status')).toContainText('저장 실패');
  await page.evaluate(()=>(window as unknown as {restoreStorage:()=>void}).restoreStorage()); await page.getByRole('button',{name:'저장 재시도'}).click(); await expect(page.locator('.save-status')).toContainText('자동 저장됨'); expect((await library(page)).draft.doc.name).toBe('저장 실패 확인');
});

test('한 페이지보다 큰 표 행은 안내와 함께 축소되며 무한 페이지가 생기지 않는다',async({page})=>{
  await boot(page); const d=tableDoc(1); const b=d.blocks.find(b=>b.table)!; b.table!.rows[0][b.table!.columns[0].id]='긴 행 내용\n'.repeat(200); await seed(page,d);
  await expect(page.locator('.oversize-note')).toBeVisible(); expect(await page.locator('.paper').count()).toBeLessThan(5);
  const block=await page.locator('.paper .oversized').boundingBox();const body=await page.locator('.paper').filter({has:page.locator('.oversized')}).locator('.page-body').boundingBox(); expect(block!.height).toBeLessThanOrEqual(body!.height+1);
});

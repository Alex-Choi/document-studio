import { chromium, expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const htmlPath = resolve('artifacts/document-studio-preview.html');
const html = await readFile(htmlPath,'utf8');
assert(!/<script\b[^>]*src=|<link\b[^>]*href=|type="module"/i.test(html));
async function openImagePicker(page){const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:/새 이미지 업로드/}).click();await chooser;}

async function saveRecord(page){await page.getByRole('button',{name:'저장',exact:true}).click();if(await page.getByRole('dialog',{name:'이름 입력'}).isVisible())await page.getByRole('dialog',{name:'이름 입력'}).getByRole('button',{name:'확인',exact:true}).click();}
const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined});
const report = { directFile: false, directFileError: '', fallback: '', storageBlockedFlow: false, functionalFlow: false, requests: [], errors: [], pdfPages: 0 };
try {
  const context = await browser.newContext({offline:true,viewport:{width:1560,height:1000}});
  let page = await context.newPage();
  const attach=()=>{page.setDefaultTimeout(10000);page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(/^(https?:|file:)/.test(r.url()))report.requests.push(r.url());});};attach();
  const fileUrl=pathToFileURL(htmlPath).href;
  let denyStorage=false;
  const openPreview=async()=>{
    if(report.directFile){await page.goto(fileUrl);return;}
    await page.close();page=await context.newPage();attach();
    if(denyStorage)await page.evaluate(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Local storage denied','SecurityError');}}));
    await page.setContent(html,{waitUntil:'load'});await page.locator('.brand').waitFor();
  };
  try { await page.goto(fileUrl); await page.locator('.brand').waitFor(); report.directFile=true; }
  catch(error) {
    report.directFileError=String(error.message).split('\n')[0];
    if(!/ERR_BLOCKED_BY_ADMINISTRATOR/.test(report.directFileError)) throw error;
    report.fallback='Exact HTML injected with setContent into offline about:blank (opaque origin); file:// navigation blocked by browser policy.';
    await openPreview();
  }
  await expect(page.getByRole('status',{name:'파일 저장 안내'})).toContainText('JSON');
  await page.getByRole('button',{name:'빈 양식 만들기'}).click();
  await page.getByRole('button',{name:'텍스트',exact:true}).click();
  await page.locator('.paper .text-content').fill('단일 HTML 입력 검증');
  await page.getByRole('spinbutton',{name:'너비',exact:true}).fill('6');
  await page.getByRole('button',{name:'텍스트',exact:true}).click();
  await page.locator('.paper .text-content').last().fill('나란히 배치');
  await page.getByRole('spinbutton',{name:'너비',exact:true}).fill('6');
  await page.getByRole('spinbutton',{name:'시작 열'}).fill('7');
  await page.getByRole('spinbutton',{name:'배치 줄'}).fill('1');
  await page.getByRole('button',{name:'굵게',exact:true}).click();
  await expect(page.locator('.paper .block-text').last()).toHaveCSS('font-weight','700');
  await expect(page.locator('.paper .layout-row')).toHaveCount(1);
  await page.locator('.paper .text-content').first().click();
  const resize=await page.getByRole('button',{name:'블록 크기 조절',exact:true}).boundingBox();
  const body=await page.locator('.page-body').boundingBox();
  await page.mouse.move(resize.x+resize.width/2,resize.y+resize.height/2);await page.mouse.down();
  await page.mouse.move(resize.x+resize.width/2-body.width/12*2,resize.y+resize.height/2,{steps:5});await page.mouse.up();
  await expect(page.getByRole('spinbutton',{name:'너비',exact:true})).toHaveValue('4');
  const move=await page.getByRole('button',{name:'블록 이동',exact:true}).boundingBox();
  await page.mouse.move(move.x+move.width/2,move.y+move.height/2);await page.mouse.down();
  await page.mouse.move(body.x+body.width*.2,body.y+10,{steps:5});await page.mouse.up();
  await expect(page.getByRole('spinbutton',{name:'시작 열'})).toHaveValue('3');
  await page.getByRole('button',{name:'표',exact:true}).click();
  const table=page.locator('.paper table').first();
  await table.locator('tbody tr').first().locator('td').nth(0).fill('검증 항목');
  await table.locator('tbody tr').first().locator('td').nth(1).fill('3');
  await table.locator('tbody tr').first().locator('td').nth(2).fill('2000');
  await expect(table.locator('tbody tr').first().locator('td').nth(3)).toHaveText('6,000');
  await page.getByRole('button',{name:'행 추가',exact:true}).click();
  await page.getByRole('button',{name:'열 추가',exact:true}).click();
  const columnBefore=await table.locator('col').first().evaluate(el=>parseFloat(el.style.width));
  const columnHandle=await page.getByRole('button',{name:'항목 오른쪽 열 경계 조절'}).first().boundingBox();
  const tableBox=await table.boundingBox();
  await page.mouse.move(columnHandle.x+columnHandle.width/2,columnHandle.y+15);await page.mouse.down();
  await page.mouse.move(columnHandle.x+columnHandle.width/2+tableBox.width*.04,columnHandle.y+15,{steps:6});await page.mouse.up();
  await expect.poll(()=>table.locator('col').first().evaluate(el=>parseFloat(el.style.width))).toBeGreaterThan(columnBefore+3.5);
  await page.locator('.column-settings summary').click();
  await page.getByLabel('항목 열 너비').fill('55');
  for(let i=0;i<34;i++){
    await page.getByRole('button',{name:'행 추가',exact:true}).click();
    // Pagination reads measured row heights on the next frame. Wait for the newly
    // added source row rather than overwriting the previous last rendered row.
    await expect(page.locator('.paper tbody tr').last()).toHaveAttribute('data-table-row',String(i+4));
    await page.locator('.paper tbody tr').last().locator('td').first().fill(`이어지는 항목 ${i+1}`);
  }
  await expect.poll(()=>page.locator('.paper').count()).toBeGreaterThan(1);
  assert.equal(await page.locator('.paper tbody tr').count(),38);
  assert((await page.locator('.paper table thead').count())>=2);

  const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=240;c.height=80;const x=c.getContext('2d');x.strokeStyle='#153e52';x.lineWidth=3;x.beginPath();x.moveTo(10,65);x.bezierCurveTo(30,5,100,5,70,60);x.bezierCurveTo(40,85,145,15,210,45);x.stroke();return c.toDataURL('image/png');});
  const upload=()=>({name:'preview-sign.png',mimeType:'image/png',buffer:Buffer.from(image.split(',')[1],'base64')});
  await page.getByRole('button',{name:'이미지',exact:true}).click();
  await openImagePicker(page);
  await page.getByTestId('image-upload').setInputFiles(upload());
  await expect(page.locator('.paper .document-image')).toHaveCount(1);
  await page.getByRole('button',{name:'머리글 편집'}).click();
  await page.getByRole('spinbutton',{name:'영역 높이'}).fill('25');
  await page.locator('.right-panel').getByRole('button',{name:'텍스트',exact:true}).click();
  await page.getByLabel('내용',{exact:true}).fill('머리글 미리보기 {page}/{pages}');
  await page.getByRole('button',{name:'바닥글 편집'}).click();
  await page.getByRole('spinbutton',{name:'영역 높이'}).fill('16');
  await page.locator('.right-panel').getByRole('button',{name:'텍스트',exact:true}).click();
  await page.getByLabel('내용',{exact:true}).fill('바닥글 미리보기 {page}/{pages}');
  await page.getByRole('button',{name:'배경 · 워터마크 설정'}).click();
  await page.locator('.right-panel').getByRole('button',{name:'이미지 선택',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'preview-sign',exact:true}).click();
  await page.getByRole('slider',{name:'워터마크 투명도'}).fill('80');
  await expect(page.getByTestId('watermark-image').first()).toHaveCSS('opacity','0.2');
  await page.getByRole('button',{name:'서명 영역 추가'}).click();
  await page.getByRole('button',{name:'도장·서명',exact:true}).click();await openImagePicker(page);
  await page.getByTestId('image-upload').setInputFiles({...upload(),name:'reusable-stamp.png'});await page.getByRole('button',{name:'보관함 닫기'}).click();
  await saveRecord(page);
  await page.getByRole('button',{name:'문서 작성',exact:true}).click();
  await page.locator('.paper .block-signature').click();
  await page.getByRole('button',{name:'보관함에서 서명 선택'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'reusable-stamp',exact:true}).click();
  await saveRecord(page);
  const exportFile=async()=>{const pending=page.waitForEvent('download');await page.getByRole('button',{name:'문서 내보내기',exact:true}).click();return readFile(await (await pending).path(),'utf8');};
  const backup=JSON.parse(await exportFile());
  assert.equal(backup.version,1);assert.equal(backup.documents.length,1);assert.equal(backup.templates.length,1);
  assert.equal(backup.draft.doc.blocks.find(b=>b.table).table.rows.length,38);
  const exportedTable=backup.draft.doc.blocks.find(b=>b.table).table;
  for(let i=0;i<34;i++)assert.equal(exportedTable.rows[i+4][exportedTable.columns[0].id],`이어지는 항목 ${i+1}`,'A table row input was lost during pagination.');
  assert.equal(backup.draft.doc.blocks.find(b=>b.type==='image').asset.data,image);
  assert.equal(backup.draft.doc.blocks.find(b=>b.type==='signature').images[0].asset.data,image);
  assert.equal(backup.assets.length,2);
  const count=await page.locator('.paper').count();
  await openPreview();
  await page.getByTestId('backup-import').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await expect(page.locator('.paper .signature-image img')).toHaveCount(1);
  await expect(page.locator('.paper .document-image')).toHaveCount(1);
  await expect(page.locator('.paper')).toHaveCount(count);
  const restored=JSON.parse(await exportFile());
  assert.deepEqual(restored.draft.doc.blocks,backup.draft.doc.blocks);
  assert.deepEqual(restored.draft.doc.page,backup.draft.doc.page);
  report.functionalFlow=true;

  // Explicitly simulate a policy denying localStorage reads AND writes.
  denyStorage=true; if(report.directFile)await context.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Local storage denied','SecurityError');}}));
  await openPreview();
  await expect(page.getByRole('status',{name:'파일 저장 안내'})).toContainText('사용할 수 없습니다');
  await page.getByTestId('backup-import').setInputFiles({name:'restore-without-storage.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await expect(page.locator('.paper .signature-image img')).toHaveCount(1);
  await page.getByLabel('문서 이름').fill('저장소 차단 상태에서도 편집');
  await saveRecord(page);
  const blocked=JSON.parse(await exportFile());
  assert.equal(blocked.draft.doc.name,'저장소 차단 상태에서도 편집');
  assert.equal(blocked.draft.doc.blocks.find(b=>b.type==='signature').images[0].asset.data,image);
  await expect(page.locator('.save-status')).not.toContainText('자동 저장됨');
  report.storageBlockedFlow=true;
  await page.getByRole('button',{name:'두 페이지 나란히 보기'}).click();
  await page.locator('.toast').waitFor({state:'hidden'});
  await page.screenshot({path:'artifacts/document-studio-preview-screen.png'});
  await page.getByRole('button',{name:'미리보기',exact:true}).click();
  const printCount=await page.locator('.paper').count();
  assert(printCount>1);
  await page.evaluate(()=>{window.__printSeen=false;window.addEventListener('beforeprint',()=>{window.__printSeen=true;});});
  await page.getByRole('button',{name:'PDF 출력',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__printSeen)).toBe(true);
  await page.emulateMedia({media:'print'});
  await expect(page.locator('.storage-banner')).toBeHidden();await expect(page.locator('.app-header')).toBeHidden();
  await page.pdf({path:'artifacts/document-studio-preview-check.pdf',preferCSSPageSize:true,printBackground:true});
  report.pdfPages=await page.locator('.paper').count();
  assert.equal(report.pdfPages,printCount,'Print CSS changed the document page count.');
  assert.equal(await readFile(htmlPath,'utf8'),html,'The original HTML was modified by editing.');
  assert.deepEqual(report.errors,[]);
  assert(report.requests.every(url=>url===fileUrl),'An external request was made by the standalone HTML.');
  console.log('PASS: single HTML manipulation, images, pagination, PDF, export/import with localStorage denied, no external requests.');
  console.log(report.directFile?'Direct file:// navigation passed.':report.directFileError+'; exact HTML validated on offline about:blank via setContent.');
} finally {
  await mkdir('artifacts',{recursive:true});await writeFile('artifacts/preview-validation.json',JSON.stringify(report,null,2));await browser.close();
}

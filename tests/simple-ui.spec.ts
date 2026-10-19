import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {newDoc,makeBlock,uid} from '../src/core/model';
import type {Library} from '../src/core/model';
import {validateLibrary} from '../src/core/storage';
import {readFile} from 'node:fs/promises';

async function seed(page:Page,doc=fixture(),mode:'template'|'document'='template'){await page.goto('/');await page.getByTestId('backup-import').setInputFiles({name:'ui.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,templates:[],documents:[],assets:[],draft:{doc,mode}}))});await expect(page.getByLabel('문서 이름')).toHaveValue(doc.name);await stored(page);return doc;}
async function stored(page:Page):Promise<Library>{await expect(page.locator('.save-status')).toContainText('자동 저장됨');return page.evaluate(()=>JSON.parse(localStorage.getItem('document-studio.v1')!));}
function fixture(){const d=newDoc('견적서',true),text=makeBlock('text',0),table=makeBlock('table',5);d.name='간단한 편집 화면';text.text='중앙에 놓을 글자';text.rowSpan=5;text.heightMode='minimum';table.table!.rows[0][table.table!.columns[0].id]='여러 줄\n두 번째 줄\n세 번째 줄';table.table!.rows[0][table.table!.columns[1].id]='1';d.blocks=[text,table];return d;}
async function save(page:Page,scope='current'){await page.getByRole('button',{name:'저장·열기',exact:true}).click();await page.getByLabel('저장 범위').selectOption(scope);const dl=page.waitForEvent('download');await page.getByRole('dialog',{name:'저장 및 열기'}).getByRole('button',{name:'저장',exact:true}).click();if(await page.getByRole('dialog',{name:'이름 입력'}).isVisible())await page.getByRole('dialog',{name:'이름 입력'}).getByRole('button',{name:'확인',exact:true}).click();const file=await dl;return {file,data:JSON.parse(await readFile((await file.path())!,'utf8')) as Library};}

test('좌표·칸 수·줄 간격과 중복 파일 버튼을 제거하고 드래그 손잡이는 유지',async({page})=>{
 const d=await seed(page);await page.locator(`.paper [data-block-id="${d.blocks[0].id}"]`).dispatchEvent('click');for(const name of ['시작 열','너비','배치 줄','세로 칸 수','블록 높이 방식','줄 간격'])await expect(page.getByLabel(name,{exact:true})).toHaveCount(0);for(const name of ['문서 내보내기','문서 가져오기','전체 자료 내보내기','백업 가져오기','저장 보조 메뉴','PDF 출력'])await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'블록 이동',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'아래쪽 높이 조절'})).toBeVisible();await expect(page.getByRole('button',{name:'저장·열기',exact:true})).toHaveCount(1);
});

test('세로 가운데·아래 맞춤은 블록 안에서 이동하고 실제 높이와 아래 내용은 유지',async({page})=>{
 const d=await seed(page),id=d.blocks[0].id,b=page.locator(`.paper [data-block-id="${id}"]`),text=b.locator('.block-inner');await b.dispatchEvent('click');const top=(await text.boundingBox())!.y,box=(await b.boundingBox())!;await page.getByRole('button',{name:'세로 가운데 맞춤',exact:true}).click();await expect.poll(async()=>(await text.boundingBox())!.y).toBeGreaterThan(top+20);const middle=await text.boundingBox();expect(middle!.y+middle!.height/2).toBeCloseTo(box.y+box.height/2,0);await page.getByRole('button',{name:'아래쪽 맞춤',exact:true}).click();await expect.poll(async()=>(await text.boundingBox())!.y).toBeGreaterThan(middle!.y);await page.getByRole('button',{name:'실행 취소',exact:true}).click();await expect.poll(async()=>(await text.boundingBox())!.y).toBeCloseTo(middle!.y,1);await stored(page);await page.reload();expect((await stored(page)).draft.doc.blocks[0].style.vertical).toBe('middle');const after=(await b.boundingBox())!;expect(after.height).toBeCloseTo(box.height,1);
});

test('표 셀 세로 가운데 정렬은 선택 셀만 변경하고 문서 작성에서도 유지',async({page})=>{
 await seed(page,fixture(),'document');const table=page.locator('.paper table'),a=table.locator('tbody td').nth(1),other=table.locator('tbody td').nth(2);await a.click();await page.getByRole('button',{name:'세로 가운데 맞춤',exact:true}).click();await expect(a).toHaveCSS('vertical-align','middle');await expect(other).toHaveCSS('vertical-align','top');const saved=await stored(page);expect(saved.draft.doc.blocks[1].table!.cellStyles).toBeDefined();await page.getByRole('button',{name:'미리보기',exact:true}).click();await expect(a).toHaveCSS('vertical-align','middle');await page.emulateMedia({media:'print'});await expect(a).toHaveCSS('vertical-align','middle');
});

test('출력 형식 선택만으로 다운로드나 인쇄하지 않고 버튼에서 Word·PDF 실행',async({page})=>{
 await seed(page);let downloads=0;page.on('download',()=>downloads++);await page.evaluate(()=>{(window as unknown as {printCount:number}).printCount=0;window.print=()=>{(window as unknown as {printCount:number}).printCount++;};});for(const format of ['docx','xlsx','png','jpg','pdf'])await page.getByLabel('저장 형식',{exact:true}).selectOption(format);await page.waitForTimeout(250);expect(downloads).toBe(0);expect(await page.evaluate(()=>(window as unknown as {printCount:number}).printCount)).toBe(0);
 await page.getByLabel('저장 형식',{exact:true}).selectOption('docx');const dl=page.waitForEvent('download');await page.getByRole('button',{name:'선택 형식으로 저장',exact:true}).click();expect((await dl).suggestedFilename()).toMatch(/\.docx$/);expect(downloads).toBe(1);await page.getByLabel('저장 형식',{exact:true}).selectOption('pdf');await page.getByRole('button',{name:'선택 형식으로 저장',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as unknown as {printCount:number}).printCount)).toBe(1);expect(downloads).toBe(1);
});

test('한 파일 메뉴에서 현재 문서 저장·보관함 갱신·전체 백업·같은 열기로 복원',async({page})=>{
 const d=await seed(page);const first=await save(page);expect(first.file.suggestedFilename()).toMatch(/\.json$/);expect(validateLibrary(first.data)).toBe(true);expect(first.data.templates).toHaveLength(1);await page.getByLabel('문서 이름').fill('다른 양식');await save(page);const full=await save(page,'all');expect(full.data.templates).toHaveLength(1);expect(full.data.draft.doc.name).toBe('다른 양식');await page.getByRole('button',{name:'빈 양식 만들기'}).click();await page.getByRole('button',{name:'저장·열기',exact:true}).click();const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'파일 열기',exact:true}).click();await(await chooser).setFiles({name:'saved.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(first.data))});await expect(page.getByLabel('문서 이름')).toHaveValue(d.name);await page.getByRole('button',{name:'저장·열기',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'저장 및 열기'})).toBeHidden();
});

test('브라우저 저장 불가여도 같은 저장 버튼으로 이미지 포함 JSON을 내려받음',async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new Error('blocked');};});await page.goto('/');await page.getByRole('button',{name:'저장·열기',exact:true}).click();await expect(page.getByRole('dialog',{name:'저장 및 열기'})).toContainText('저장');const dl=page.waitForEvent('download');await page.getByRole('dialog',{name:'저장 및 열기'}).getByRole('button',{name:'저장',exact:true}).click();await page.getByRole('dialog',{name:'이름 입력'}).getByRole('button',{name:'확인',exact:true}).click();const data=JSON.parse(await readFile((await(await dl).path())!,'utf8'));expect(validateLibrary(data)).toBe(true);await expect(page.locator('.brand')).toBeVisible();
});

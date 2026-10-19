import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { makeBlock, newDoc } from '../src/core/model';
import { gridPitch, overlaps, resolveWidgets, widgetHeight } from '../src/core/widgets';
import { paginate } from '../src/core/layout';

async function boot(page:Page){await page.goto('/');await expect(page.locator('.save-status')).toContainText('자동 저장됨');await page.getByRole('button',{name:'빈 양식 만들기'}).click();}
async function stored(page:Page){await expect(page.locator('.save-status')).toContainText('자동 저장됨');return page.evaluate(()=>JSON.parse(localStorage.getItem('document-studio.v1')!).draft.doc);}
async function seed(page:Page,doc:ReturnType<typeof newDoc>){await page.getByTestId('backup-import').setInputFiles({name:'widgets.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,templates:[],documents:[],assets:[],draft:{doc,mode:'template'}}))});await expect(page.getByLabel('문서 이름')).toHaveValue(doc.name);await expect(page.locator('.save-status')).toContainText('자동 저장됨');}

test('3×4와 5×3 위젯 아래 남은 칸을 채워도 서로 겹치지 않는다',async({page})=>{
  await boot(page);const d=newDoc('견적서',true);const a=makeBlock('shape',0),b=makeBlock('shape',0),c=makeBlock('text',3);a.span=3;a.rowSpan=4;b.col=3;b.span=5;b.rowSpan=3;c.col=3;c.span=5;c.rowSpan=1;c.text='남은 행을 채운 블록';d.blocks=[a,b,c];await seed(page,d);
  const blocks=page.locator('.paper [data-block-id]');const rects=await blocks.evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));
  expect(rects[0].right).toBeLessThan(rects[1].left);expect(rects[1].bottom).toBeLessThan(rects[2].top);expect(rects[2].bottom).toBeCloseTo(rects[0].bottom,0);
  await expect(page.locator('.paper .layout-row')).toHaveCount(1);await page.locator(`.paper [data-block-id="${a.id}"]`).click();await expect(page.locator('.size-summary')).toContainText('3열 × 4행');
  const model=await stored(page);expect(model.blocks.find((x:{id:string})=>x.id===a.id).rowSpan).toBe(4);expect(model.blocks.find((x:{id:string})=>x.id===b.id).rowSpan).toBe(3);
});

test('내용이 늘어나면 점유 행이 늘고 아래 위젯이 밀려난다',()=>{
  const d=newDoc('견적서',true);const a=makeBlock('text',0),b=makeBlock('shape',1),c=makeBlock('shape',0);a.span=6;b.span=6;b.rowSpan=2;c.col=6;c.span=6;c.rowSpan=3;d.blocks=[a,b,c];
  const before=resolveWidgets(d,{[a.id]:{height:30}});const after=resolveWidgets(d,{[a.id]:{height:widgetHeight(d,5)}});
  expect(before.find(r=>r.block.id===b.id)!.row).toBe(1);expect(after.find(r=>r.block.id===b.id)!.row).toBe(5);expect(after.find(r=>r.block.id===c.id)!.row).toBe(0);
  expect(after.some((a,i)=>after.slice(i+1).some(b=>overlaps(a,b)))).toBe(false);
  const pages=paginate(d,{[a.id]:{height:widgetHeight(d,5)}});expect(pages[0].rows.some(row=>row.fragments.some(f=>f.block.id===b.id))).toBe(true);
});

test('선택 위·아래·문서 맨 위로 삽입하고 빈 칸 클릭으로 추가한다',async({page})=>{
  await boot(page);await page.getByRole('button',{name:'텍스트',exact:true}).click();await page.locator('.paper .text-content').fill('첫 블록');
  await page.getByLabel('새 요소 삽입 위치').selectOption('before');await page.getByRole('button',{name:'텍스트',exact:true}).click();await page.locator('.paper .selected .text-content').fill('중간에 삽입');
  let doc=await stored(page);expect(doc.blocks.find((b:{text:string})=>b.text==='중간에 삽입').row).toBe(0);expect(doc.blocks.find((b:{text:string})=>b.text==='첫 블록').row).toBeGreaterThan(0);
  await page.getByLabel('새 요소 삽입 위치').selectOption('top');await page.getByRole('button',{name:'텍스트',exact:true}).click();await page.locator('.paper .selected .text-content').fill('맨 위');doc=await stored(page);expect(doc.blocks.find((b:{text:string})=>b.text==='맨 위').row).toBe(0);
  await page.getByRole('button',{name:'축소',exact:true}).click();await page.getByRole('button',{name:'축소',exact:true}).click();
  const body=await page.locator('.page-body').boundingBox();const width=(210-28)*96/25.4;const scale=body!.width/width;await page.mouse.click(body!.x+body!.width*.76,body!.y+gridPitch(newDoc())*scale*7+8);
  await expect(page.getByLabel('새 요소 삽입 위치')).toHaveValue('cursor');await page.getByRole('button',{name:'도형',exact:true}).click();doc=await stored(page);const shape=doc.blocks.find((b:{type:string})=>b.type==='shape');expect(shape.row).toBe(7);expect(shape.col).toBe(9);
});

test('서명 절반 너비·오른쪽 배치 후 왼쪽에 요소 삽입',async({page})=>{
  await boot(page);await page.getByRole('button',{name:'서명 영역 추가'}).click();await page.getByRole('spinbutton',{name:'너비',exact:true}).fill('12');
  await page.getByRole('button',{name:'절반',exact:true}).click();await page.getByRole('button',{name:'블록 오른쪽 배치'}).click();await page.getByRole('spinbutton',{name:'세로 칸 수'}).fill('3');
  await expect(page.locator('.size-summary')).toContainText('6열 × 3행');await page.getByLabel('새 요소 삽입 위치').selectOption('left');await page.getByRole('button',{name:'텍스트',exact:true}).click();
  const d=await stored(page);const sign=d.blocks.find((b:{type:string})=>b.type==='signature');const text=d.blocks.find((b:{type:string})=>b.type==='text');expect(sign.col).toBe(6);expect(sign.span).toBe(6);expect(sign.rowSpan).toBe(3);expect(text.row).toBe(sign.row);expect(text.col).toBe(0);
  const s=await page.locator('.paper .block-signature').boundingBox(),t=await page.locator('.paper .block-text').boundingBox();expect(t!.x+t!.width).toBeLessThan(s!.x);expect(t!.y).toBeCloseTo(s!.y,0);
});

test('확대 후 아래·왼쪽 가장자리로 조절하고 큰 손잡이로 정확히 이동·취소',async({page})=>{
  await boot(page);await page.getByRole('button',{name:'도형',exact:true}).click();await page.getByRole('button',{name:'확대',exact:true}).click();
  const doc=await stored(page);const body=await page.locator('.page-body').boundingBox();const bodyWidth=(210-28)*96/25.4,scale=body!.width/bodyWidth,pitch=gridPitch(doc)*scale;
  let handle=await page.getByRole('button',{name:'아래쪽 높이 조절'}).boundingBox();await page.mouse.move(handle!.x+handle!.width/2,handle!.y+handle!.height/2);await page.mouse.down();await page.mouse.move(handle!.x+handle!.width/2,handle!.y+handle!.height/2+pitch*2,{steps:6});await page.mouse.up();await expect(page.getByRole('spinbutton',{name:'세로 칸 수'})).toHaveValue('5');
  await page.getByRole('button',{name:'블록 오른쪽 배치'}).click();const column=(bodyWidth+6)/12*scale;handle=await page.getByRole('button',{name:'왼쪽 너비 조절'}).boundingBox();await page.mouse.move(handle!.x+handle!.width/2,handle!.y+handle!.height/2);await page.mouse.down();await page.mouse.move(handle!.x+handle!.width/2-column*2,handle!.y+handle!.height/2,{steps:6});await page.mouse.up();await expect(page.getByRole('spinbutton',{name:'너비',exact:true})).toHaveValue('5');
  const block=await page.locator('.paper .block-shape').boundingBox();handle=await page.getByRole('button',{name:'블록 이동'}).boundingBox();expect(handle!.width).toBeGreaterThan(50);
  const grabX=handle!.x+handle!.width/2-block!.x,grabY=handle!.y+handle!.height/2-block!.y;
  await page.mouse.move(handle!.x+handle!.width/2,handle!.y+handle!.height/2);await page.mouse.down();await page.mouse.move(body!.x+column*2+grabX,body!.y+pitch*4+grabY,{steps:6});await expect(page.locator('.drop-preview')).toBeVisible();await page.mouse.up();
  await expect(page.getByRole('spinbutton',{name:'시작 열'})).toHaveValue('3');await expect(page.getByRole('spinbutton',{name:'배치 줄'})).toHaveValue('5');
  const before=await stored(page);handle=await page.getByRole('button',{name:'블록 이동'}).boundingBox();await page.mouse.move(handle!.x+10,handle!.y+10);await page.mouse.down();await page.mouse.move(body!.x+10,body!.y+20,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();expect((await stored(page)).blocks).toEqual(before.blocks);
});

test('이전 양식은 자동 변환하지 않고 명시적 전환·실행 취소를 지원한다',async({page})=>{
  await boot(page);const d=newDoc();delete d.page.widgetGrid;delete d.page.gridRowMm;d.blocks.forEach(b=>delete b.rowSpan);await seed(page,d);await expect(page.locator('.widget-canvas')).toHaveCount(0);await expect(page.getByRole('button',{name:'위젯 격자로 전환',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'위젯 격자로 전환',exact:true}).click();await expect(page.locator('.widget-canvas')).toHaveCount(1);await page.getByRole('button',{name:'실행 취소',exact:true}).click();await expect(page.locator('.widget-canvas')).toHaveCount(0);
});

test('왼쪽 요소를 문서로 끌어 놓으면 해당 격자 칸에 바로 삽입한다',async({page})=>{
  await boot(page);await page.getByRole('button',{name:'축소',exact:true}).click();const body=page.locator('.page-body');const box=await body.boundingBox();const doc=await stored(page);const scale=box!.width/((210-28)*96/25.4);
  await page.getByRole('button',{name:'텍스트',exact:true}).dragTo(body,{targetPosition:{x:box!.width*.71,y:gridPitch(doc)*scale*6+8}});
  await expect(page.locator('.paper .block-text')).toHaveCount(1);const block=(await stored(page)).blocks[0];expect(block.row).toBe(6);expect(block.col).toBe(8);expect(block.span).toBe(4);
});

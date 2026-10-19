import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {newDoc,makeBlock,clone} from '../src/core/model';
import {ensureBodyFlow,resolveWidgets,removeFlowMember,placeFlowMember,widgetHeight,gridPitch} from '../src/core/widgets';
import {paginate} from '../src/core/layout';
import {validateDoc} from '../src/core/storage';

async function openImagePicker(page:Page){const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:/새 이미지 업로드/}).click();await chooser;}

async function seed(page:Page,doc:ReturnType<typeof newDoc>){await page.goto('/');await page.getByTestId('backup-import').setInputFiles({name:'flow.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,templates:[],documents:[],assets:[],draft:{doc,mode:'template'}}))});await expect(page.getByLabel('문서 이름')).toHaveValue(doc.name);await stored(page);}
async function stored(page:Page){await expect(page.locator('.save-status')).toContainText('자동 저장됨');return page.evaluate(()=>JSON.parse(localStorage.getItem('document-studio.v1')!).draft.doc);}
const block=(page:Page,id:string)=>page.locator(`.paper [data-block-id="${id}"]`).first();
async function top(page:Page,id:string){return (await block(page,id).boundingBox())!.y;}
function example(){const d=newDoc('견적서',true);d.name='자동 흐름 검증';const a=makeBlock('text',0),b=makeBlock('shape',1),c=makeBlock('text',4);a.text='앞 문장';b.span=12;c.text='뒤 문장';d.blocks=[a,b,c];return {d,a,b,c};}

test('측정 높이를 저장 위치로 굳히지 않고 줄 최대 높이·삭제·의도적 간격을 보존',()=>{
  const {d,a,b,c}=example();ensureBodyFlow(d,{});const flow=clone(d.bodyFlow);
  expect(resolveWidgets(d,{[a.id]:{height:widgetHeight(d,5)}}).find(r=>r.block.id===c.id)!.row).toBe(8);
  expect(resolveWidgets(d,{[a.id]:{height:widgetHeight(d,1)}}).find(r=>r.block.id===c.id)!.row).toBe(4);
  expect(d.bodyFlow).toEqual(flow);removeFlowMember(d,b.id);d.blocks=d.blocks.filter(x=>x.id!==b.id);
  expect(resolveWidgets(d,{}).find(r=>r.block.id===c.id)!.row).toBe(1);expect(validateDoc(d)).toBe(true);
  const peer=makeBlock('shape',0);peer.col=6;peer.span=6;peer.rowSpan=2;a.span=6;a.rowSpan=4;c.row=4;d.blocks=[a,peer,c];delete d.bodyFlow;ensureBodyFlow(d,{});removeFlowMember(d,a.id);d.blocks=d.blocks.filter(x=>x.id!==a.id);
  const rects=resolveWidgets(d,{});expect(rects.find(r=>r.block.id===peer.id)).toMatchObject({row:0,col:6,span:6});expect(rects.find(r=>r.block.id===c.id)!.row).toBe(2);
  const old=newDoc('견적서',true);const x=makeBlock('text',2),y=makeBlock('text',6);old.blocks=[x,y];const before=resolveWidgets(old,{});ensureBodyFlow(old,{});expect(resolveWidgets(old,{})).toEqual(before);
});

test('엇갈린 줄도 완전히 빈 행만 닫고 다른 열에 내용이 있으면 그대로 유지',()=>{
  const d=newDoc('견적서',true),a=makeBlock('text',0),b=makeBlock('shape',0),c=makeBlock('shape',3),next=makeBlock('text',4);a.span=6;a.rowSpan=1;b.col=6;b.span=6;b.rowSpan=1;c.col=6;c.span=6;c.rowSpan=1;d.blocks=[a,b,c,next];const tall={[a.id]:{height:widgetHeight(d,4)}};ensureBodyFlow(d,tall);
  expect(resolveWidgets(d,tall).find(r=>r.block.id===c.id)!.row).toBe(3);const short=resolveWidgets(d,{[a.id]:{height:widgetHeight(d,1)}});expect(short.find(r=>r.block.id===c.id)!.row).toBe(1);expect(short.find(r=>r.block.id===next.id)!.row).toBe(2);
  removeFlowMember(d,b.id);d.blocks=d.blocks.filter(x=>x.id!==b.id);expect(resolveWidgets(d,tall).find(r=>r.block.id===c.id)!.row).toBe(3);removeFlowMember(d,a.id);d.blocks=d.blocks.filter(x=>x.id!==a.id);expect(resolveWidgets(d,{}).find(r=>r.block.id===c.id)!.row).toBe(0);
});

test('중간 삽입 미리보기 Esc·문서 밖 이동은 문서·저장·실행 취소를 변경하지 않음',async({page})=>{
  const {d,a,b,c}=example();await seed(page,d);await block(page,b.id).click();const before=await stored(page),positions=await Promise.all([a,b,c].map(x=>top(page,x.id)));
  const handle=await page.getByRole('button',{name:'블록 이동',exact:true}).boundingBox(),target=await block(page,a.id).boundingBox();await page.mouse.move(handle!.x+10,handle!.y+10);await page.mouse.down();await page.mouse.move(target!.x+30,target!.y+20,{steps:5});await expect(page.locator('.drop-preview')).toBeVisible();await page.keyboard.press('Escape');await page.mouse.up();expect(await stored(page)).toEqual(before);expect(await Promise.all([a,b,c].map(x=>top(page,x.id)))).toEqual(positions);
  await page.mouse.move(handle!.x+10,handle!.y+10);await page.mouse.down();await page.mouse.move(10,110,{steps:5});await page.mouse.up();expect(await stored(page)).toEqual(before);
  const undo=page.getByRole('button',{name:'실행 취소',exact:true});await undo.click();expect((await stored(page)).id).not.toBe(d.id);
});

test('이미지 중간 추가의 창 닫기·파일 취소·오류에는 빈 블록과 이력이 없음',async({page})=>{
  const {d,b,c}=example();await seed(page,d);await block(page,b.id).click();await page.getByLabel('새 요소 삽입 위치').selectOption('before');const before=await stored(page),y=await top(page,c.id);
  await page.getByRole('button',{name:'이미지',exact:true}).click();await expect(page.getByRole('dialog',{name:'이미지 보관함'})).toBeVisible();expect(await stored(page)).toEqual(before);await page.keyboard.press('Escape');expect(await top(page,c.id)).toBe(y);
  await page.getByRole('button',{name:'이미지',exact:true}).click();await openImagePicker(page);await page.getByTestId('image-upload').dispatchEvent('cancel');await expect(page.getByRole('dialog',{name:'이미지 보관함'})).toBeHidden();expect(await stored(page)).toEqual(before);
  await page.getByRole('button',{name:'이미지',exact:true}).click();await openImagePicker(page);await page.getByTestId('image-upload').setInputFiles({name:'invalid.png',mimeType:'image/png',buffer:Buffer.from('invalid')});await expect(page.getByRole('alert')).toBeVisible();expect(await stored(page)).toEqual(before);await page.getByRole('button',{name:'실행 취소',exact:true}).click();expect((await stored(page)).id).not.toBe(d.id);
});

test('이미지 확정과 주변 이동은 한 번의 실행 취소·다시 실행',async({page})=>{
  const {d,b}=example();await seed(page,d);await block(page,b.id).click();await page.getByLabel('새 요소 삽입 위치').selectOption('before');const before=await stored(page);
  await page.getByRole('button',{name:'이미지',exact:true}).click();await openImagePicker(page);await page.getByTestId('image-upload').setInputFiles({name:'image.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGMQkdP4zwAEAAdmAVp9gFAdAAAAAElFTkSuQmCC','base64')});await expect(page.locator('.paper .document-image')).toBeVisible();const after=await stored(page);expect(after.blocks).toHaveLength(4);await page.getByRole('button',{name:'실행 취소',exact:true}).click();expect(await stored(page)).toEqual(before);await page.getByRole('button',{name:'다시 실행',exact:true}).click();expect(await stored(page)).toEqual(after);
});

test('이미지 높이 축소·문서에서 이미지 제거는 아래 내용을 당기고 보관함은 유지',async({page})=>{
  const {d,b,c}=example();await seed(page,d);await block(page,b.id).click();await page.getByLabel('새 요소 삽입 위치').selectOption('before');const originalY=await top(page,c.id);
  await page.getByRole('button',{name:'이미지',exact:true}).click();await openImagePicker(page);await page.getByTestId('image-upload').setInputFiles({name:'size.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGMQkdP4zwAEAAdmAVp9gFAdAAAAAElFTkSuQmCC','base64')});await expect(page.locator('.paper .document-image')).toBeVisible();await stored(page);const imageY=await top(page,c.id);expect(imageY).toBeGreaterThan(originalY+40);
  await page.getByRole('spinbutton',{name:'세로 칸 수'}).fill('1');await stored(page);expect(await top(page,c.id)).toBeLessThan(imageY-30);await page.getByRole('button',{name:'문서에서 이미지 제거',exact:true}).click();await stored(page);await expect(page.locator('.paper .block-image')).toHaveCount(0);expect(await top(page,c.id)).toBe(originalY);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('document-studio.v1')!).assets.length)).toBe(1);
});

test('중간 삭제·높이 축소·내용 감소는 자동 상승하고 저장·재열기·이력이 유지됨',async({page})=>{
  const {d,a,b,c}=example();await seed(page,d);const before=await stored(page),y=await top(page,c.id);await block(page,b.id).click();await page.locator('.right-panel .danger-button').click();expect(await top(page,c.id)).toBeLessThan(y-30);const deleted=await stored(page);await page.getByRole('button',{name:'실행 취소',exact:true}).click();expect(await stored(page)).toEqual(before);expect(await top(page,c.id)).toBe(y);await page.getByRole('button',{name:'다시 실행',exact:true}).click();expect(await stored(page)).toEqual(deleted);await page.reload();expect(await stored(page)).toEqual(deleted);
  const editor=block(page,a.id).locator('.text-content');await editor.fill(Array.from({length:15},()=> '긴 문장 내용').join('\n'));await stored(page);const longY=await top(page,c.id);await editor.fill('짧은 문장');await stored(page);expect(await top(page,c.id)).toBeLessThan(longY-100);
  await block(page,a.id).click();await page.getByRole('spinbutton',{name:'세로 칸 수'}).fill('5');await stored(page);const big=await top(page,c.id);await page.getByRole('spinbutton',{name:'세로 칸 수'}).fill('1');await stored(page);expect(await top(page,c.id)).toBeLessThan(big-80);
});

test('같은 줄 하나 삭제는 나머지 좌우 위치와 최대 높이를 기준으로 흐름 유지',async({page})=>{
  const {d,a,b,c}=example();a.span=6;a.rowSpan=4;b.row=0;b.col=6;b.span=6;b.rowSpan=2;c.row=4;d.blocks=[a,b,c];await seed(page,d);const peer=await block(page,b.id).boundingBox(),y=await top(page,c.id);await block(page,a.id).locator('.text-content').click();await page.locator('.right-panel .danger-button').click();await stored(page);const after=await block(page,b.id).boundingBox();expect(after!.x).toBe(peer!.x);expect(after!.y).toBe(peer!.y);expect(after!.width).toBe(peer!.width);expect(await top(page,c.id)).toBeLessThan(y-20);
});

test('표 행 삭제 후 다음 페이지에서 서명 전체가 올라오고 자동 빈 페이지 제거',async({page})=>{
  const d=newDoc('견적서',true),table=makeBlock('table',0),sign=makeBlock('signature',1);table.table!.rows=Array.from({length:32},(_,i)=>Object.fromEntries(table.table!.columns.map((c,j)=>[c.id,j===0?`항목 ${i+1}`:'1'])));d.blocks=[table,sign];await seed(page,d);const count=await page.locator('.paper').count();expect(count).toBeGreaterThan(1);await block(page,table.id).locator('th').first().click();for(let i=0;i<22;i++){await page.getByRole('button',{name:'마지막 행 삭제',exact:true}).click();await expect(page.locator('.right-panel')).toContainText(`${31-i}행 · 4열`);}
  await stored(page);await expect(page.locator('.paper')).toHaveCount(1);await expect(block(page,sign.id)).toBeVisible();expect(await block(page,sign.id).count()).toBe(1);expect((await stored(page)).blocks[0].table.rows).toHaveLength(10);await page.reload();await expect(page.locator('.paper')).toHaveCount(1);
});

test('여백 블록·이전 의도적 빈 행·수동 나누기·머리글 영역은 자동 제거하지 않음',async({page})=>{
  const d=newDoc('견적서',true),a=makeBlock('text',0),space=makeBlock('spacer',1),b=makeBlock('shape',4),br=makeBlock('break',7),c=makeBlock('text',8);space.rowSpan=3;d.blocks=[a,space,b,br,c];d.page.header.height=30;await seed(page,d);await expect(page.locator('.paper')).toHaveCount(2);await block(page,b.id).click();await page.locator('.right-panel .danger-button').click();const saved=await stored(page);expect(saved.blocks.map((b:{id:string})=>b.id)).toEqual([a.id,space.id,br.id,c.id]);expect(saved.page.header.height).toBe(30);expect(saved.blocks.find((x:{id:string})=>x.id===space.id).rowSpan).toBe(3);await expect(page.locator('.paper')).toHaveCount(2);await expect(page.locator('.paper').nth(1).locator(`[data-block-id="${c.id}"]`)).toBeVisible();expect(saved.bodyFlow.bands).toHaveLength(4);
  // Reject duplicate/missing memberships rather than silently losing a block on import.
  const invalid=clone(saved);invalid.bodyFlow.bands[0].members.push({...invalid.bodyFlow.bands[1].members[0]});expect(validateDoc(invalid)).toBe(false);
});

test('다른 위치로 이동하면 원래 줄은 닫히며 순서를 바꾸지 않고 이후 축소도 재계산',()=>{
  const {d,a,b,c}=example();ensureBodyFlow(d,{});placeFlowMember(d,b.id,{row:5},{});const rects=resolveWidgets(d,{});expect(rects.find(r=>r.block.id===c.id)!.row).toBe(1);expect(rects.find(r=>r.block.id===b.id)!.row).toBe(2);
  const spacer=makeBlock('spacer',0);spacer.rowSpan=2;d.blocks.push(spacer);placeFlowMember(d,spacer.id,{row:0,side:'top'},{});expect(resolveWidgets(d,{}).find(r=>r.block.id===a.id)!.row).toBe(2);expect(paginate(d,{})).toHaveLength(1);expect(gridPitch(d)).toBeGreaterThan(0);
});

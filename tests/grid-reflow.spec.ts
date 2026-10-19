import {resizeSelected,fitSelected} from './editor-actions';
import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {newDoc,makeBlock,clone,MM} from '../src/core/model';
import {autoHeight,ensureBodyFlow,followContentHeight,gridPitch,resolveWidgets,widgetHeight} from '../src/core/widgets';
import {validateDoc} from '../src/core/storage';

const block=(page:Page,id:string)=>page.locator(`.paper [data-block-id="${id}"]`).first();
async function stored(page:Page){await expect(page.locator('.save-status')).toContainText('자동 저장됨');return page.evaluate(()=>JSON.parse(localStorage.getItem('document-studio.v1')!).draft.doc);}
async function seed(page:Page,doc:ReturnType<typeof newDoc>){await page.goto('/');await page.getByTestId('backup-import').setInputFiles({name:'grid-reflow.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,templates:[],documents:[],assets:[],draft:{doc,mode:'template'}}))});await expect(page.getByLabel('문서 이름')).toHaveValue(doc.name);await stored(page);}
async function select(page:Page,id:string){await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();getSelection()?.removeAllRanges();});await block(page,id).dispatchEvent('click');}
async function box(page:Page,id:string){return (await block(page,id).boundingBox())!;}
async function logical(page:Page,id:string){return block(page,id).evaluate(el=>{const paper=el.closest('.paper')!,scale=paper.getBoundingClientRect().width/(210*96/25.4),r=el.getBoundingClientRect(),body=el.closest('.page-body')!.getBoundingClientRect();return {height:r.height/scale,top:(r.top-body.top)/scale};});}

function example(){const d=newDoc('견적서',true);d.name='격자 높이 자동 재계산';const a=makeBlock('text',0),after=makeBlock('text',8);a.rowSpan=8;a.style.size=36;a.text='글자 크기와\n줄 수에 맞춰\n줄어드는 블록';after.text='다음 내용';d.blocks=[a,after];return {d,a,after};}

test('이전 다중 행 데이터는 보존하고 편집 시 자동 높이, 직접 확보 높이는 유지',()=>{
 const {d,a,after}=example();ensureBodyFlow(d,{});const before=clone(d);expect(autoHeight(a)).toBe(false);expect(resolveWidgets(d,{[a.id]:{height:30}}).find(r=>r.block.id===after.id)!.row).toBe(8);
 Object.assign(a,followContentHeight(a,{style:{...a.style,size:8}}));expect(autoHeight(a)).toBe(true);expect(resolveWidgets(d,{[a.id]:{height:30}}).find(r=>r.block.id===after.id)!.row).toBe(1);
 Object.assign(a,followContentHeight(a,{rowSpan:5}));Object.assign(a,followContentHeight(a,{text:'짧게'}));expect(autoHeight(a)).toBe(false);expect(resolveWidgets(d,{[a.id]:{height:30}}).find(r=>r.block.id===after.id)!.row).toBe(5);
 expect(validateDoc(d)).toBe(true);expect(validateDoc(before)).toBe(true);expect(validateDoc(JSON.parse(JSON.stringify({...d,blocks:[{...a,heightMode:'bad'},after]})))).toBe(false);
});

test('글자 크기를 줄이면 이전 점유 행과 아래 위치가 줄고 한 번에 실행 취소·다시 실행·재열기',async({page})=>{
 const {d,a,after}=example();await seed(page,d);const before=await logical(page,a.id),y=(await box(page,after.id)).y;await select(page,a.id);await page.getByLabel('글자 크기',{exact:true}).selectOption('8');
 await expect.poll(async()=>(await logical(page,a.id)).height).toBeLessThan(before.height/2);await expect.poll(async()=>(await box(page,after.id)).y).toBeLessThan(y);expect((await stored(page)).blocks.find((b:{id:string})=>b.id===a.id).heightMode).toBe('auto');const small=await logical(page,a.id);expect((small.height+6)/gridPitch(d)).toBeCloseTo(Math.round((small.height+6)/gridPitch(d)),2);
 await page.getByRole('button',{name:'실행 취소',exact:true}).click();await expect.poll(async()=>(await logical(page,a.id)).height).toBeCloseTo(before.height,1);await page.getByRole('button',{name:'다시 실행',exact:true}).click();await expect.poll(async()=>(await logical(page,a.id)).height).toBeCloseTo(small.height,1);
 await stored(page);await page.reload();await expect.poll(async()=>(await logical(page,a.id)).height).toBeCloseTo(small.height,1);expect((await stored(page)).blocks.find((b:{id:string})=>b.id===a.id).heightMode).toBe('auto');
});

test('행 높이 변경은 실제 블록 칸과 위치에 적용되고 반복 변경에도 측정 높이가 누적되지 않음',async({page})=>{
 const d=newDoc('견적서',true),a=makeBlock('text',0),shape=makeBlock('shape',0),after=makeBlock('text',3);a.span=6;a.style.size=20;a.text='두 줄 문장\n높이 측정';shape.col=6;shape.span=6;d.blocks=[a,shape,after];await seed(page,d);
 const initial=await logical(page,after.id);await page.getByRole('button',{name:'격자 진하기 설정'}).click();const input=page.getByLabel('격자 한 행 높이');
 for(const mm of [8,24,8,12]){await input.fill(String(mm));const pitch=mm*MM;await expect.poll(async()=>(await logical(page,shape.id)).height).toBeCloseTo(3*pitch-6,1);const measure=await page.locator(`.measurement-root [data-block-id="${a.id}"]`).evaluate(el=>el.getBoundingClientRect().height);const rows=Math.max(1,Math.ceil((measure+6-.1)/pitch));await expect.poll(async()=>(await logical(page,a.id)).height).toBeCloseTo(rows*pitch-6,1);await expect.poll(async()=>(await logical(page,after.id)).top).toBeCloseTo(Math.max(3,rows)*pitch,1);}
 expect((await logical(page,after.id)).top).toBeCloseTo(initial.top,1);await stored(page);await page.reload();expect((await logical(page,after.id)).top).toBeCloseTo(initial.top,1);
});

test('자동/최소 높이를 바꿀 수 있고 같은 줄의 좌우 배치와 명시적 여백·페이지 나누기는 유지',async({page})=>{
 const d=newDoc('견적서',true),a=makeBlock('text',0),peer=makeBlock('shape',0),spacer=makeBlock('spacer',6),br=makeBlock('break',8),next=makeBlock('text',9);a.span=peer.span=6;a.rowSpan=6;peer.col=6;peer.rowSpan=2;spacer.rowSpan=2;d.blocks=[a,peer,spacer,br,next];await seed(page,d);await select(page,a.id);await fitSelected(page);await expect.poll(async()=>(await logical(page,spacer.id)).top).toBeCloseTo(2*gridPitch(d),1);const p=await logical(page,peer.id);expect(p.top).toBeCloseTo(0,1);expect(p.height).toBeCloseTo(widgetHeight(d,2),1);await expect(page.locator('.paper')).toHaveCount(2);
 await resizeSelected(page,{rows:5});expect((await stored(page)).blocks.find((b:{id:string})=>b.id===a.id).heightMode).toBe('minimum');await page.getByLabel('글자 크기',{exact:true}).selectOption('6');await expect.poll(async()=>(await logical(page,a.id)).height).toBeCloseTo(widgetHeight(d,5),1);const saved=await stored(page);expect(saved.blocks.find((b:{id:string})=>b.id===spacer.id).rowSpan).toBe(2);expect(saved.blocks.find((b:{id:string})=>b.id===peer.id).col).toBe(6);expect(saved.blocks.some((b:{id:string})=>b.id===br.id)).toBe(true);
});

test('표 글꼴 축소·행 삭제 시 실제 높이와 페이지 수를 다시 계산',async({page})=>{
 const d=newDoc('견적서',true),table=makeBlock('table',0),after=makeBlock('text',1);table.style.size=30;table.table!.rows=Array.from({length:20},(_,i)=>Object.fromEntries(table.table!.columns.map(c=>[c.id,c.role==='text'?`${i+1} 품목`:'1'])));d.blocks=[table,after];await seed(page,d);const pages=await page.locator('.paper').count();expect(pages).toBeGreaterThan(1);await select(page,table.id);await page.getByLabel('글자 크기',{exact:true}).selectOption('8');await expect.poll(()=>page.locator('.paper').count()).toBeLessThan(pages);await expect(page.locator('.paper')).toHaveCount(1);const t=await box(page,table.id),f=await box(page,after.id);expect(f.y).toBeGreaterThanOrEqual(t.y+t.height);
 await page.getByRole('button',{name:'마지막 행 삭제',exact:true}).click();const saved=await stored(page);expect(saved.blocks.find((b:{id:string})=>b.id===table.id).table.rows).toHaveLength(19);
});

test('문서 작성에서 글자 축소에 따라 입력 항목 높이가 줄고 기존 줄 간격 데이터는 보존',async({page})=>{
 const d=newDoc('견적서',true),field=makeBlock('field',0),after=makeBlock('text',1);field.heightMode='auto';field.style.size=48;field.style.lineHeight=3;field.field!.name='수신';field.field!.defaultValue='ABC';d.blocks=[field,after];await seed(page,d);await page.getByRole('button',{name:'문서 작성',exact:true}).click();await select(page,field.id);const before=await logical(page,field.id),y=(await box(page,after.id)).y;await page.getByLabel('글자 크기',{exact:true}).selectOption('8');await expect.poll(async()=>(await logical(page,field.id)).height).toBeLessThan(before.height);await expect.poll(async()=>(await box(page,after.id)).y).toBeLessThan(y);const saved=await stored(page);expect(saved.blocks.find((b:{id:string})=>b.id===field.id).style.lineHeight).toBe(3);await expect(page.getByLabel('줄 간격',{exact:true})).toHaveCount(0);
});

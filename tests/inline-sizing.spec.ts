import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {newDoc,makeBlock,MM} from '../src/core/model';

const block=(page:Page,id:string)=>page.locator(`.paper [data-block-id="${id}"]`).first();
async function stored(page:Page){await expect(page.locator('.save-status')).toContainText('자동 저장됨');return page.evaluate(()=>JSON.parse(localStorage.getItem('document-studio.v1')!).draft.doc);}
async function seed(page:Page,doc:ReturnType<typeof newDoc>){await page.goto('/');await page.getByTestId('backup-import').setInputFiles({name:'inline-height.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,templates:[],documents:[],assets:[],draft:{doc,mode:'template'}}))});await expect(page.getByLabel('문서 이름')).toHaveValue(doc.name);await stored(page);}
async function height(page:Page,id:string){return block(page,id).evaluate(el=>el.getBoundingClientRect().height/(el.closest('.paper')!.getBoundingClientRect().width/(210*96/25.4)));}
function example(){const d=newDoc('견적서',true),a=makeBlock('text',0),next=makeBlock('text',3);d.name='부분 글자 축소';d.page.gridRowMm=8;a.text='견적서';a.style.size=29;a.style.bold=true;a.style.align='center';a.rowSpan=3;a.heightMode='auto';a.rich=[{text:a.text,style:{size:14}}];d.blocks=[a,next];return {d,a,next};}

test('작은 부분 글꼴만 남으면 이전 문단 글꼴의 빈 높이를 제거하고 저장·미리보기도 유지',async({page})=>{
 const {d,a}=example();await seed(page,d);await expect.poll(()=>height(page,a.id)).toBeCloseTo(2*8*MM-6,1);const rich=(await stored(page)).blocks[0].rich;expect(rich).toEqual(a.rich);await page.reload();await expect.poll(()=>height(page,a.id)).toBeCloseTo(2*8*MM-6,1);await page.getByRole('button',{name:'미리보기',exact:true}).click();await expect.poll(()=>height(page,a.id)).toBeCloseTo(2*8*MM-6,1);
});

test('글자를 실제로 선택해 6pt로 줄이면 한 행, 큰 글자가 남으면 필요한 행 유지',async({page})=>{
 const {d,a}=example();d.page.gridRowMm=12;a.rich=undefined;a.text='큰글자 작은글자';await seed(page,d);const editor=block(page,a.id).locator('[data-rich-editor]');await editor.click();await page.keyboard.press('ControlOrMeta+A');await expect.poll(()=>page.evaluate(()=>getSelection()?.toString())).toBe(a.text);await page.getByLabel('글자 크기',{exact:true}).selectOption('6');await expect.poll(()=>height(page,a.id)).toBeCloseTo(12*MM-6,1);await stored(page);await page.getByRole('button',{name:'실행 취소',exact:true}).click();await expect.poll(()=>height(page,a.id)).toBeGreaterThan(12*MM-6);await page.getByRole('button',{name:'다시 실행',exact:true}).click();await expect.poll(()=>height(page,a.id)).toBeCloseTo(12*MM-6,1);a.rich=[{text:'큰',style:{size:29}},{text:' 글자',style:{size:6}}];a.text='큰 글자';await seed(page,d);await expect.poll(()=>height(page,a.id)).toBeGreaterThan(12*MM-6);
});

test('3행 제목을 아래 손잡이로 내용이 들어가는 2행까지 축소하고 주변 내용도 이동',async({page})=>{
 const {d,a,next}=example();a.heightMode='minimum';await seed(page,d);await block(page,a.id).dispatchEvent('click');const before=(await block(page,next.id).boundingBox())!.y;const handle=await page.getByRole('button',{name:'아래쪽 높이 조절'}).boundingBox();const paper=await page.locator('.paper').first().boundingBox();const pitch=8*MM*paper!.width/(210*MM);await page.mouse.move(handle!.x+handle!.width/2,handle!.y+handle!.height/2);await page.mouse.down();await page.mouse.move(handle!.x+handle!.width/2,handle!.y+handle!.height/2-pitch*2,{steps:5});await expect(page.locator(".drop-preview")).toContainText("2행");await page.mouse.up();await expect.poll(()=>height(page,a.id)).toBeCloseTo(2*8*MM-6,1);await expect.poll(async()=>(await block(page,next.id).boundingBox())!.y).toBeLessThan(before);await stored(page);await page.reload();await expect.poll(()=>height(page,a.id)).toBeCloseTo(2*8*MM-6,1);
});

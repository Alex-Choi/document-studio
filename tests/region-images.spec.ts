import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {newDoc,MM,clone,uid} from '../src/core/model';
import type {Asset,Decoration} from '../src/core/model';
import {fitRegionImage,resizeRegion,updateRegionDecoration} from '../src/core/regions';
import {validateDoc} from '../src/core/storage';
import {readFile} from 'node:fs/promises';

const banner='tests/fixtures/banner-794x110.png';
async function stored(page:Page){await expect(page.locator('.save-status')).toContainText('자동 저장됨');return page.evaluate(()=>JSON.parse(localStorage.getItem('document-studio.v1')!).draft.doc);}
async function boot(page:Page){await page.goto('/');await stored(page);}
async function upload(page:Page,target:'header'|'footer'){
 await page.getByRole('button',{name:target==='header'?'머리글 편집':'바닥글 편집'}).click();await page.locator('.right-panel').getByRole('button',{name:'이미지',exact:true}).click();const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:/새 이미지 업로드/}).click();await(await chooser).setFiles(banner);await expect(page.getByRole('dialog',{name:'이미지 보관함'})).toBeHidden();await expect(page.getByLabel('머리글·바닥글 단위')).toHaveValue('px');await stored(page);
}
async function input(page:Page,label:string,value:string){await page.getByLabel(label,{exact:true}).fill(value);await page.getByLabel(label,{exact:true}).press('Enter');await stored(page);}

function asset(width=794,height=110):Asset{return {id:uid(),name:'banner',category:'image',width,height,data:'data:image/png;base64,aA=='};}
function decoration(a=asset()):Decoration{return {id:uid(),type:'image',text:'',asset:a,x:0,y:0,width:25,height:10,color:'#000000',size:9};}

test('원본 px와 종이 여백으로 맞춤·비율·영역 확장·미세 이미지·이전 데이터 유효성',()=>{
 const a=asset(),fit=fitRegionImage(a,182,true);expect(fit.width).toBeCloseTo(182,8);expect(fit.height).toBeCloseTo(182*110/794,8);
 const d=newDoc(),item=decoration(a);d.page.header.items=[item];const old=clone(d);expect(validateDoc(d)).toBe(true);expect(old.page.header.items[0].lockAspect).toBeUndefined();updateRegionDecoration(d.page.header,'items',item.id,{width:150},182);expect(d.page.header.items[0].height).toBeCloseTo(150*110/794,8);expect(d.page.header.height).toBeCloseTo(150*110/794,8);resizeRegion(d.page.header,10);expect(d.page.header.items[0].width/d.page.header.items[0].height).toBeCloseTo(794/110,8);expect(validateDoc(d)).toBe(true);
 for(const [w,h] of [[1,30000],[30000,1]]){const tiny=decoration(asset(w,h));Object.assign(tiny,fitRegionImage(tiny.asset!,182,true));d.page.header.items=[tiny];resizeRegion(d.page.header,.1);expect(validateDoc(d)).toBe(true);}
 expect(validateDoc({...old,page:{...old.page,header:{...old.page.header,items:[{...item,lockAspect:'bad'}]}}} as unknown as typeof old)).toBe(false);
});

test('794×110 머리글 이미지가 여백 너비로 삽입되고 비율에 맞춰 영역이 자동 확장',async({page})=>{
 await boot(page);await upload(page,'header');const d=await stored(page),image=d.page.header.items.find((i:{type:string})=>i.type==='image');expect(image.width).toBeCloseTo(182,6);expect(image.height).toBeCloseTo(182*110/794,6);expect(d.page.header.height).toBeCloseTo(image.height,6);await expect(page.locator('.image-size-summary')).toContainText('794 × 110 px');await expect(page.getByLabel('요소 너비',{exact:true})).toHaveValue(String(Math.round(182*MM*100)/100));
 const frames=await page.locator('.paper').first().evaluate(p=>{const h=p.querySelector('.header')!.getBoundingClientRect(),b=p.querySelector('.page-body')!.getBoundingClientRect(),i=p.querySelector('.header img')!.getBoundingClientRect();return {h:h.bottom,b:b.top,width:i.width,height:i.height};});expect(frames.h).toBeLessThanOrEqual(frames.b+.1);expect(frames.width/frames.height).toBeCloseTo(794/110,3);
});

test('px 크기 변경은 비율·영역·본문을 한 번에 갱신하며 단위 전환만으로 데이터가 바뀌지 않음',async({page})=>{
 await boot(page);await upload(page,'header');const before=await stored(page);await input(page,'요소 너비','500');const changed=await stored(page),item=changed.page.header.items.find((i:{type:string})=>i.type==='image');expect(item.width*MM).toBeCloseTo(500,6);expect(item.height*MM).toBeCloseTo(500*110/794,6);
 for(const unit of ['mm','px','mm','px']){await page.getByLabel('머리글·바닥글 단위').selectOption(unit);await page.getByLabel('요소 너비',{exact:true}).focus();await page.getByLabel('요소 높이',{exact:true}).focus();}expect(await stored(page)).toEqual(changed);await page.getByRole('button',{name:'실행 취소',exact:true}).click();expect((await stored(page)).page).toEqual(before.page);await page.getByRole('button',{name:'다시 실행',exact:true}).click();expect((await stored(page)).page).toEqual(changed.page);
 await page.getByLabel('머리글·바닥글 단위').selectOption('mm');await input(page,'요소 너비','150.25');expect((await stored(page)).page.header.items.find((i:{type:string})=>i.type==='image').width).toBeCloseTo(150.25,6);
});

test('바닥글 이미지 높이를 px로 키우면 영역도 늘고 저장·새로고침·JSON 복원 유지',async({page})=>{
 await boot(page);await upload(page,'footer');await input(page,'요소 높이','80');const d=await stored(page),image=d.page.footer.items.find((i:{type:string})=>i.type==='image');expect(image.height*MM).toBeCloseTo(80,5);expect(image.width*MM).toBeCloseTo(80*794/110,5);
 await input(page,'Y 위치','20');const enlarged=await stored(page);expect(enlarged.page.footer.height*MM).toBeGreaterThanOrEqual(100-.001);
 await page.getByRole('button',{name:'저장·열기',exact:true}).click();const dl=page.waitForEvent('download');await page.getByRole('dialog',{name:'저장 및 열기'}).getByRole('button',{name:'저장',exact:true}).click();await page.getByRole('dialog',{name:'이름 입력'}).getByRole('button',{name:'확인',exact:true}).click();const backup=JSON.parse(await readFile((await(await dl).path())!,'utf8'));await page.reload();expect((await stored(page)).page.footer).toEqual(enlarged.page.footer);await page.getByTestId('backup-import').setInputFiles({name:'region.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});expect((await stored(page)).page.footer).toEqual(enlarged.page.footer);
});

test('이전의 납작한 이미지 상자는 그대로 열고 너비 맞춤으로 복구·영역 축소·비율 해제 지원',async({page})=>{
 await boot(page);const d=newDoc(),a=asset();a.data=`data:image/png;base64,${(await readFile(banner)).toString('base64')}`;const item=decoration(a);item.width=182;item.height=17;d.page.header.height=17;d.page.header.items=[item];await page.getByTestId('backup-import').setInputFiles({name:'old.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,templates:[],documents:[],assets:[],draft:{doc:d,mode:'template'}}))});await stored(page);await page.getByRole('button',{name:'머리글 편집'}).click();await page.locator('.decoration-list button').click();expect((await stored(page)).page.header.items[0]).toEqual(item);await page.getByRole('button',{name:'영역 너비에 맞춤',exact:true}).click();expect((await stored(page)).page.header.height).toBeCloseTo(182*110/794,6);await page.getByLabel('머리글·바닥글 단위').selectOption('px');await input(page,'영역 높이','50');const shrunk=(await stored(page)).page.header.items[0];expect(shrunk.height*MM).toBeCloseTo(50,6);expect(shrunk.width/shrunk.height).toBeCloseTo(794/110,6);await page.getByLabel('머리글·바닥글 이미지 비율 유지').uncheck();await input(page,'요소 높이','70');expect((await stored(page)).page.header.items[0].lockAspect).toBe(false);await expect(page.locator('.paper .header img').first()).toHaveCSS('object-fit','fill');
});

test('여백 없는 740×80 이미지가 좌우 끝까지 맞고 편집/미리보기에서 크기가 동일',async({page})=>{
 await boot(page);await page.getByRole('button',{name:'머리글 편집'}).click();await page.locator('.right-panel').getByRole('button',{name:'이미지',exact:true}).click();const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:/새 이미지 업로드/}).click();await(await chooser).setFiles('tests/fixtures/banner-740x80.png');await expect(page.getByRole('dialog',{name:'이미지 보관함'})).toBeHidden();const d=await stored(page),item=d.page.header.items.find((i:{type:string})=>i.type==='image');expect(item.width).toBeCloseTo(182,6);expect(item.height).toBeCloseTo(182*80/740,6);expect(item.height).not.toBe(17);
 const geom=()=>page.locator('.paper .header img').first().evaluate(img=>{const b=img.getBoundingClientRect(),region=img.closest('.header')!.getBoundingClientRect(),scale=img.closest('.paper')!.getBoundingClientRect().width/(210*96/25.4);return {width:b.width/scale,height:b.height/scale,left:(b.left-region.left)/scale,right:(region.right-b.right)/scale};});const before=await geom();expect(before.left).toBeCloseTo(0,1);expect(before.right).toBeCloseTo(0,1);expect(before.width/before.height).toBeCloseTo(740/80,2);await page.getByRole('button',{name:'미리보기',exact:true}).click();const after=await geom();expect(after.width).toBeCloseTo(before.width,1);expect(after.height).toBeCloseTo(before.height,1);
});

test('이미지 투명도 0/50/100%가 배치 변화 없이 반영되고 실행 취소·재열기·PDF에서도 유지',async({page})=>{
 await boot(page);await upload(page,'footer');const before=await stored(page),img=page.locator('.paper .footer img').first();await expect(img).toHaveCSS('opacity','1');await page.getByLabel('이미지 투명도',{exact:true}).fill('50');await expect(img).toHaveCSS('opacity','0.5');const changed=await stored(page),entry=changed.page.footer.items.find((i:{type:string})=>i.type==='image');expect(entry.transparency).toBe(50);expect(changed.page.footer.height).toBe(before.page.footer.height);expect(entry.width).toBe(before.page.footer.items.find((i:{type:string})=>i.type==='image').width);await page.getByLabel('이미지 투명도',{exact:true}).fill('100');await expect(img).toHaveCSS('opacity','0');await page.getByRole('button',{name:'실행 취소',exact:true}).click();await expect(img).toHaveCSS('opacity','0.5');await stored(page);await page.reload();await expect(img).toHaveCSS('opacity','0.5');await page.getByRole('button',{name:'미리보기',exact:true}).click();await expect(img).toHaveCSS('opacity','0.5');await page.emulateMedia({media:'print'});await expect(img).toHaveCSS('opacity','0.5');
});

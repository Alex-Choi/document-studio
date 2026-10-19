import {expect} from '@playwright/test';
import type {Page} from '@playwright/test';
const MM=96/25.4;
export async function currentDoc(page:Page){await expect(page.locator('.save-status')).toContainText('자동 저장됨');return page.evaluate(()=>JSON.parse(localStorage.getItem('document-studio.v1')!).draft.doc);}
export async function selectedGeometry(page:Page){const id=await page.locator('.paper .doc-block.selected').first().getAttribute('data-block-id');return (await currentDoc(page)).blocks.find((b:{id:string})=>b.id===id);}
export async function saveMenuAction(page:Page,scope='current'){await page.getByRole('button',{name:'저장·열기',exact:true}).click();await page.getByLabel('저장 범위').selectOption(scope);await page.getByRole('dialog',{name:'저장 및 열기'}).getByRole('button',{name:'저장',exact:true}).click();}
export async function resizeSelected(page:Page,size:{span?:number;rows?:number}){
 const b=page.locator('.paper .doc-block.selected').first(),doc=await currentDoc(page);
 for(const [key,wanted] of Object.entries(size)){
  const box=(await b.boundingBox())!,body=(await b.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," page-body ")]').boundingBox())!;
  const scale=body.width/((210-doc.page.margins.left-doc.page.margins.right)*MM),pitch=(doc.page.gridRowMm??12)*MM*scale;
  const original=key==='span'?(await selectedGeometry(page)).span:Math.round((box.height/scale+6)/((doc.page.gridRowMm??12)*MM));
  const delta=(wanted!-original)*(key==='span'?(body.width+6*scale)/doc.page.columns:pitch),handle=await b.locator(key==='span'?'.resize-e':'.resize-s').boundingBox();
  await page.mouse.move(handle!.x+handle!.width/2,handle!.y+handle!.height/2);await page.mouse.down();await page.mouse.move(handle!.x+handle!.width/2+(key==='span'?delta:0),handle!.y+handle!.height/2+(key==='rows'?delta:0),{steps:6});await page.mouse.up();await currentDoc(page);
 }
}
export async function moveSelected(page:Page,where:{col?:number;row?:number}){
 const b=page.locator('.paper .doc-block.selected').first();await b.scrollIntoViewIfNeeded();const box=(await b.boundingBox())!,body=(await b.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," page-body ")]').boundingBox())!,doc=await currentDoc(page),scale=body.width/((210-doc.page.margins.left-doc.page.margins.right)*MM),handle=(await b.locator('.move-handle').boundingBox())!;
 const x=handle.x+handle.width/2,y=handle.y+handle.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move((where.col===undefined?box.x:body.x+where.col*(body.width+6*scale)/doc.page.columns)+(x-box.x),(where.row===undefined?box.y:body.y+where.row*(doc.page.gridRowMm??12)*MM*scale)+(y-box.y),{steps:6});await page.mouse.up();await currentDoc(page);
}
export async function placeRight(page:Page){const doc=await currentDoc(page),b=await selectedGeometry(page);await moveSelected(page,{col:doc.page.columns-b.span});}
export async function fitSelected(page:Page){await page.getByRole('button',{name:'아래쪽 높이 조절'}).dblclick();await currentDoc(page);}

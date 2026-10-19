import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined});
try{
 const source=await browser.newPage();await source.goto('http://127.0.0.1:5173');
 const doc=await source.evaluate(async()=>{
  const {newDoc,makeBlock}=await import('/src/core/model.ts');const d=newDoc('견적서',true);d.name='위젯 격자 · 배치 예시';
  const title=makeBlock('text',0);title.text='위젯처럼 만드는 업무 문서';title.rowSpan=2;title.style.size=23;title.style.bold=true;
  const a=makeBlock('text',3);a.span=3;a.rowSpan=4;a.text='3열 × 4행\n\n가로와 세로 칸을\n함께 조절하세요.';a.style.background='#eef8f6';a.style.bold=true;
  const b=makeBlock('text',3);b.col=3;b.span=5;b.rowSpan=3;b.text='5열 × 3행\n\n옆에 나란히 놓은 위젯';b.style.background='#f0f5fb';
  const c=makeBlock('text',6);c.col=3;c.span=5;c.rowSpan=1;c.text='남은 행도 다른 블록으로 채웁니다';c.style.background='#fcf4e7';
  const note=makeBlock('text',9);note.span=6;note.rowSpan=3;note.text='담당자 확인\n\n서명은 오른쪽 절반에 배치했습니다.';
  const sign=makeBlock('signature',9);sign.col=6;sign.span=6;sign.rowSpan=3;
  const table=makeBlock('table',13);table.table.rows=table.table.rows.slice(0,2);const cols=table.table.columns;table.table.rows[0]={[cols[0].id]:'업무 항목',[cols[1].id]:'2',[cols[2].id]:'1000',[cols[3].id]:''};
  d.blocks=[title,a,b,c,note,sign,table];return d;
 });await source.close();
 const context=await browser.newContext({offline:true,viewport:{width:1560,height:1200}});const page=await context.newPage();
 await page.setContent(await readFile('artifacts/document-studio-preview.html','utf8'));
 const data={version:1,templates:[],documents:[],assets:[],draft:{doc,mode:'template'}};
 await page.getByTestId('backup-import').setInputFiles({name:'widget-example.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
 await page.locator('.paper [data-block-id]').nth(1).click();
 while(Number((await page.locator('.zoom-percent').innerText()).replace('%',''))>80)await page.getByRole('button',{name:'축소',exact:true}).click();
 await page.locator('.toast').waitFor({state:'hidden'});
 await mkdir('docs/screenshots',{recursive:true});
 await page.screenshot({path:'docs/screenshots/widget-grid.png'});
 await page.locator('.paper .block-signature').click();
 await page.screenshot({path:'docs/screenshots/widget-signature.png'});
  await page.locator('.paper table th').first().click();
  await page.getByRole('button',{name:'항목 오른쪽 열 경계 조절'}).first().hover({position:{x:5,y:16}});
  await page.screenshot({path:'docs/screenshots/table-column-drag.png'});
 await writeFile('artifacts/widget-example.json',JSON.stringify(data,null,2));
 await page.getByRole('button',{name:'미리보기',exact:true}).click();
 await page.pdf({path:'artifacts/widget-example.pdf',printBackground:true,preferCSSPageSize:true});
 console.log('Widget screenshots, editable example JSON and PDF saved.');
}finally{await browser.close();}

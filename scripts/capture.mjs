import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined});
try {
  const page=await browser.newPage({viewport:{width:1560,height:1000},deviceScaleFactor:1});
  await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:5173');
  await page.locator('.save-status').filter({hasText:'자동 저장됨'}).waitFor();
  const lib=await page.evaluate(async()=>{
    const {newDoc,documentCopy,templateCopy,uid}=await import('/src/core/model.ts');
    const asset=(name,category,width,height,draw)=>{const c=document.createElement('canvas');c.width=width;c.height=height;draw(c.getContext('2d'));return{id:uid(),name,category,width,height,data:c.toDataURL('image/png')};};
    const signature=asset('예시 서명','signature',540,180,ctx=>{ctx.strokeStyle='#243547';ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(55,135);ctx.bezierCurveTo(150,0,250,0,165,82);ctx.bezierCurveTo(75,153,97,173,242,64);ctx.bezierCurveTo(279,36,218,148,290,105);ctx.bezierCurveTo(368,22,294,125,421,82);ctx.stroke();ctx.beginPath();ctx.moveTo(91,147);ctx.bezierCurveTo(220,130,270,145,472,128);ctx.stroke();});
    const stamp=asset('예시 확인 도장','stamp',230,230,ctx=>{ctx.strokeStyle='#d3484a';ctx.fillStyle='#d3484a';ctx.lineWidth=5;for(const r of[96,79]){ctx.beginPath();ctx.arc(115,115,r,0,Math.PI*2);ctx.stroke();}ctx.font='bold 53px sans-serif';ctx.textAlign='center';ctx.fillText('확인',115,134);ctx.font='16px sans-serif';ctx.fillText('DOCUMENT STUDIO',115,170);});
    const background=asset('기하 배경 예시','image',600,600,ctx=>{ctx.strokeStyle='#539ba6';ctx.lineWidth=38;for(const r of[210,130]){ctx.beginPath();ctx.arc(300,300,r,0,Math.PI*2);ctx.stroke();}ctx.strokeStyle='#78b6c0';ctx.lineWidth=13;ctx.beginPath();ctx.moveTo(35,545);ctx.lineTo(555,25);ctx.stroke();});
    const template=newDoc();template.name='견적서 기본 예시';const t=template.blocks.find(b=>b.table).table;const cols=t.columns;t.rows=Array.from({length:23},(_,i)=>({[cols[0].id]:`업무 항목 ${String(i+1).padStart(2,'0')}`,[cols[1].id]:String(i%3+1),[cols[2].id]:String(45000+i*2000),[cols[3].id]:''}));
    template.page.header.items.push({id:uid(),type:'shape',text:'',x:0,y:11,width:182,height:1.5,color:'#36a8ad',size:9});
    template.page.watermark={...template.page.watermark,asset:background,enabled:true,transparency:94,width:157};
    const doc=documentCopy(template);doc.name='견적서 · 작성 예시';const field=doc.blocks.find(b=>b.field&&b.field.type==='text').field;doc.values[field.id]='예시 고객';const sign=doc.blocks.find(b=>b.type==='signature');sign.images=[{id:uid(),asset:signature,x:5,y:18,width:40,locked:false},{id:uid(),asset:stamp,x:69,y:14,width:17,locked:true}];
    return {version:1,templates:[templateCopy(template)],documents:[doc],assets:[signature,stamp,background],draft:{doc,mode:'document'}};
  });
  await page.getByTestId('backup-import').setInputFiles({name:'example.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(lib))});
  await page.getByRole('button',{name:'두 페이지 나란히 보기'}).click();
  await page.locator('.paper .block-signature').click();
  await page.locator('.save-status').filter({hasText:'자동 저장됨'}).waitFor();
  await page.locator('.toast').waitFor({state:'hidden'});
  await mkdir('docs/screenshots',{recursive:true});await mkdir('artifacts',{recursive:true});
  await page.screenshot({path:'docs/screenshots/editor.png'});
  const count=await page.locator('.paper').count();
  await page.getByRole('button',{name:'미리보기',exact:true}).click();
  await page.screenshot({path:'docs/screenshots/preview.png'});
  await page.pdf({path:'artifacts/document-studio-example.pdf',preferCSSPageSize:true,printBackground:true});
  await writeFile('artifacts/example-backup.json',JSON.stringify(lib,null,2));
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'편집으로',exact:true}).first().click();
  await page.getByRole('button',{name:'세로 연속 보기'}).click();
  await page.screenshot({path:'docs/screenshots/mobile.png'});
  console.log(`Screenshots, image-inclusive example backup and ${count}-page PDF saved.`);
} finally {await browser.close();}

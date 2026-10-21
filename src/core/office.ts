import {cellMerge,columnPercentages,rowHeightKey} from './table';
import {cellValue,fieldValue,MM,tableTotal} from './model';
import type {Asset,Block,RichRun,StudioDoc,Style,CellStyle} from './model';
import type {Fragment,Metrics} from './layout';
import {paginate} from './layout';
import {cellKey} from './cells';
import {sliceRuns,displayRuns} from './rich';

export interface ExportFile {name:string;data:Uint8Array}
const clean=(name:string)=>name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,80)||'문서';
const hex=(color:string|undefined,fallback='172D45')=>{
 const value=color??'';if(/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value))return value.slice(1,7).toUpperCase();
 if(/^#[\da-f]{3}$/i.test(value))return value.slice(1).split('').map(c=>c+c).join('').toUpperCase();
 const rgb=value.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/i);if(rgb)return rgb.slice(1,4).map(v=>Math.max(0,Math.min(255,Math.round(Number(v)))).toString(16).padStart(2,'0')).join('').toUpperCase();
 return ({black:'000000',white:'FFFFFF',red:'FF0000',blue:'0000FF',green:'008000'} as Record<string,string>)[value.toLowerCase()]??fallback;
};
const bytes=(data:string)=>Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0));
const number=(value:string)=>Number.isFinite(Number(value))?Number(value).toLocaleString('ko-KR'):value;
function tableRows(b:Block,f:Fragment){const t=b.table!;return [
 ...(t.title!==undefined?[{kind:'title',index:-2,values:t.columns.map((_,i)=>i===0?t.title!:'')}]:[]),
 ...(t.showHeader===false?[]:[{kind:'head',index:-1,values:t.columns.map(c=>c.name)}]),
 ...t.rows.slice(f.from??0,f.to??t.rows.length).map((row,i)=>({kind:'body',index:(f.from??0)+i,values:t.columns.map(c=>cellValue(t,row,c))})),
 ...(t.total&&(f.last??true)?[{kind:'total',index:t.rows.length,values:t.columns.map((_,i)=>i===0?t.totalLabel??'합계':i===t.columns.length-1?String(tableTotal(t)):'')}]:[]),
];}
function runs(b:Block,f:Fragment){return f.text!==undefined?sliceRuns(b.rich??[{text:b.text}],f.textOffset??0,(f.textOffset??0)+f.text.length):b.rich??[{text:b.text}];}

export async function exportWord(doc:StudioDoc,metrics:Record<string,Metrics>):Promise<ExportFile>{
 const D=await import('docx');const twip=(mm:number)=>Math.round(mm*1440/25.4);const width=210-doc.page.margins.left-doc.page.margins.right;
 const alignment=(a:string)=>({left:D.AlignmentType.LEFT,center:D.AlignmentType.CENTER,right:D.AlignmentType.RIGHT,justify:D.AlignmentType.JUSTIFIED}[a]??D.AlignmentType.LEFT);
 function paragraph(value:string|RichRun[],style:Partial<Style>={},options:Record<string,unknown>={}){
  const children=(typeof value==='string'?[{text:value}]:value).flatMap(run=>{
   const s={...style,...run.style};return run.text.split('\n').map((text,i)=>new D.TextRun({text,break:i?1:undefined,font:s.font,size:(s.size??11)*2,bold:s.bold,italics:s.italic,underline:s.underline?{}:undefined,color:hex(s.color),shading:s.highlight&&s.highlight!=='transparent'?{fill:hex(s.highlight,'FFFFFF')}:undefined}));
  });return new D.Paragraph({children,alignment:alignment(style.align??'left'),spacing:{after:60,line:Math.round((style.lineHeight??1.65)*240)},...options});
 }
 const noBorder={style:D.BorderStyle.NONE,size:0,color:'FFFFFF'};
 function image(asset:Asset,maxWidth:number,maxHeight:number){const w=Math.min(maxWidth,maxHeight*asset.width/asset.height);return new D.ImageRun({type:asset.data.startsWith('data:image/png')?'png':'jpg',data:bytes(asset.data),transformation:{width:Math.max(1,w),height:Math.max(1,w*asset.height/asset.width)}});}
 function block(b:Block,f:Fragment,mm:number):(InstanceType<typeof D.Paragraph>|InstanceType<typeof D.Table>)[]{
  if(b.type==='text'||b.type==='emoji')return [paragraph(runs(b,f),b.style,{keepNext:b.keepWithNext})];
  if(b.field)return [paragraph(`${b.field.name}  ${b.field.type==='checkbox'?(fieldValue(doc,b.field)==='true'?'☑':'☐'):fieldValue(doc,b.field)}`,b.style)];
  if(b.type==='table'&&b.table){const t=b.table;return [new D.Table({width:{size:100,type:D.WidthType.PERCENTAGE},columnWidths:columnPercentages(t.columns).map(w=>twip(mm*w/100)),rows:tableRows(b,f).map(row=>new D.TableRow({tableHeader:row.kind==='head'||row.kind==='title',cantSplit:true,height:t.rowHeights?.[rowHeightKey(row.index,t.rows.length)]?{value:Math.round(t.rowHeights[rowHeightKey(row.index,t.rows.length)]*15),rule:D.HeightRule.ATLEAST}:undefined,children:row.values.flatMap((value,i)=>{
   const merge=row.kind==='title'?{row:-2,col:0,rowSpan:1,colSpan:t.columns.length}:cellMerge(t,row.index,i);if(merge&&(merge.row!==row.index||merge.col!==i))return [];

   const c=t.columns[i],s:CellStyle={...b.style,lineHeight:t.lineHeight??b.style.lineHeight,padding:t.padding,...(row.kind==='body'?{}:{bold:true,background:'#edf3f6'}),...t.cellStyles?.[cellKey(row.index,c.id,t.rows.length)],...(row.kind==='title'?{background:'#1c3954',color:'#ffffff',...t.titleStyle}:{})};
   const side=(key:'top'|'bottom'|'left'|'right')=>{const border=s.borders?.[key];return border?{style:border.type==='none'?D.BorderStyle.NONE:border.type==='dotted'?D.BorderStyle.DOTTED:border.type==='dashed'?D.BorderStyle.DASHED:D.BorderStyle.SINGLE,size:Math.max(1,Math.round(border.width*8)),color:hex(border.color,'CFDBE2')}:{style:D.BorderStyle.SINGLE,size:4,color:'CFDBE2'};};
   return new D.TableCell({columnSpan:merge?.colSpan,rowSpan:merge?.rowSpan,width:{size:columnPercentages(t.columns).slice(i,i+(merge?.colSpan??1)).reduce((a,b)=>a+b,0),type:D.WidthType.PERCENTAGE},shading:s.background&&s.background!=='transparent'?{fill:hex(s.background,'FFFFFF')}:undefined,verticalAlign:s.vertical==='bottom'?D.VerticalAlign.BOTTOM:s.vertical==='middle'?D.VerticalAlign.CENTER:D.VerticalAlign.TOP,margins:{top:twip((s.padding??5.67)/MM),bottom:twip((s.padding??5.67)/MM),left:twip((s.padding??5.67)/MM),right:twip((s.padding??5.67)/MM)},borders:{top:side('top'),bottom:side('bottom'),left:side('left'),right:side('right')},children:[paragraph(displayRuns(row.kind==='title'?t.richCells?.title:t.richCells?.[cellKey(row.index,c.id,t.rows.length)],value)??value,s)]});
  })}))})];}
  if(b.type==='image'&&b.asset)return [new D.Paragraph({children:[image(b.asset,mm*MM,b.height*MM)]})];
  if(b.type==='signature'){
   const title=paragraph(b.text,{...b.style,bold:true}),content=[paragraph(b.caption??'서명 / 도장',b.style),...b.images?.map(i=>new D.Paragraph({children:[image(i.asset,mm*MM*i.width/100,(b.signatureHeight??b.height)*MM)]}))??[],paragraph('',{}, {spacing:{after:twip(Math.max(0,(b.signatureHeight??b.height)-15))}})];
   const line=b.signatureLine??{style:'solid',width:2/MM,color:'#26a8ae'};const rule=line.style==='none'?[]:[paragraph('',{}, {spacing:{after:80},border:{top:{style:line.style==='dashed'?D.BorderStyle.DASHED:line.style==='dotted'?D.BorderStyle.DOTTED:D.BorderStyle.SINGLE,color:hex(line.color),size:Math.round(line.width*72/25.4*8)}}})];
   return [...rule,...(b.signatureTitlePosition==='below'?[...content,title]:[title,...content])];
  }
  if(b.type==='divider')return [paragraph(b.direction==='vertical'?'│':'',b.style,{border:b.direction==='vertical'?undefined:{bottom:{style:b.lineStyle==='dotted'?D.BorderStyle.DOTTED:b.lineStyle==='dashed'?D.BorderStyle.DASHED:D.BorderStyle.SINGLE,color:hex(b.style.color),size:Math.round(b.lineWidth*72/25.4*8)}},spacing:{before:twip(b.spacing),after:twip(b.spacing)}})];
  return [paragraph('',{}, {spacing:{after:Math.round(f.height*.75)}})];
 }
 const children:(InstanceType<typeof D.Paragraph>|InstanceType<typeof D.Table>)[]=[];
 const pages=paginate(doc,metrics);pages.forEach((page,pi)=>{
  if(pi)children.push(new D.Paragraph({children:[new D.PageBreak()]}));
  for(const row of page.rows){const fragments=[...row.fragments].sort((a,b)=>a.block.col-b.block.col);if(!fragments.length){children.push(paragraph('',{}, {spacing:{after:Math.round(row.height*.75)}}));continue;}
   if(fragments.length===1&&fragments[0].block.col===0&&fragments[0].block.span===doc.page.columns){children.push(...block(fragments[0].block,fragments[0],width));continue;}
   let col=0;const cells:InstanceType<typeof D.TableCell>[]=[];for(const f of fragments){const b=f.block;if(b.col>col)cells.push(new D.TableCell({columnSpan:b.col-col,borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},children:[paragraph('')]}));cells.push(new D.TableCell({columnSpan:b.span,borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},children:block(b,f,width*b.span/doc.page.columns)}));col=b.col+b.span;}if(col<doc.page.columns)cells.push(new D.TableCell({columnSpan:doc.page.columns-col,children:[paragraph('')],borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder}}));
   children.push(new D.Table({width:{size:100,type:D.WidthType.PERCENTAGE},columnWidths:Array(doc.page.columns).fill(twip(width/doc.page.columns)),borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideHorizontal:noBorder,insideVertical:noBorder},rows:[new D.TableRow({children:cells})]}));
  }
 });
 function region(which:'header'|'footer'){return doc.page[which].items.map(i=>i.asset?new D.Paragraph({children:[image(i.asset,i.width*MM,i.height*MM)]}):paragraph(i.text.replaceAll('{page}','').replaceAll('{pages}',''),{font:'맑은 고딕',size:i.size,color:i.color}));}
 const result=new D.Document({creator:'문서 스튜디오',title:doc.name,sections:[{properties:{page:{size:{width:twip(210),height:twip(297)},margin:{top:twip(doc.page.margins.top+doc.page.header.height),bottom:twip(doc.page.margins.bottom+doc.page.footer.height),left:twip(doc.page.margins.left),right:twip(doc.page.margins.right)}}},headers:{default:new D.Header({children:region('header')})},footers:{default:new D.Footer({children:[...region('footer'),new D.Paragraph({alignment:D.AlignmentType.RIGHT,children:[new D.TextRun({children:[D.PageNumber.CURRENT,' / ',D.PageNumber.TOTAL_PAGES]})]})]})},children}]});
 return {name:`${clean(doc.name)}.docx`,data:new Uint8Array(await D.Packer.toArrayBuffer(result))};
}

export async function exportExcel(doc:StudioDoc,metrics:Record<string,Metrics>):Promise<ExportFile>{
 const {default:Excel}=await import('exceljs');const book=new Excel.Workbook();book.creator='문서 스튜디오';book.title=doc.name;
 const amounts=new Map<string,{sheet:string;address:string}[]>();book.calcProperties.fullCalcOnLoad=true;
 const pages=paginate(doc,metrics);for(let pi=0;pi<pages.length;pi++){
  const sheet=book.addWorksheet(`${pi+1}페이지`,{pageSetup:{paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:1,margins:{top:(doc.page.margins.top+doc.page.header.height)/25.4,bottom:(doc.page.margins.bottom+doc.page.footer.height)/25.4,left:doc.page.margins.left/25.4,right:doc.page.margins.right/25.4,header:.2,footer:.2}},properties:{defaultRowHeight:18}});
  sheet.columns=Array.from({length:120},()=>({width:1}));let cursor=1;
  sheet.headerFooter.oddHeader=doc.page.header.items.filter(i=>i.type==='text').map(i=>i.text).join(' ');sheet.headerFooter.oddFooter='&L'+doc.page.footer.items.filter(i=>i.type==='text').map(i=>i.text.replaceAll('{page}','&P').replaceAll('{pages}','&N')).join(' ');
  const font=(s:Partial<Style>)=>({name:s.font??'맑은 고딕',size:s.size??11,bold:s.bold,italic:s.italic,underline:s.underline?true:undefined,color:{argb:'FF'+hex(s.color)}});
  function cell(row:number,start:number,end:number,value:string|number,s:CellStyle,rich?:RichRun[],rowEnd=row){start=Math.max(1,Math.min(120,start));end=Math.max(start,Math.min(120,end));if(end>start||rowEnd>row)sheet.mergeCells(row,start,rowEnd,end);const c=sheet.getCell(row,start);c.value=rich?.length?{richText:rich.map(r=>({text:r.text,font:font({...s,...r.style})}))}:value;c.font=font(s);c.alignment={horizontal:s.align==='justify'?'justify':s.align??'left',vertical:s.vertical==='middle'?'middle':s.vertical??'top',wrapText:true};if(s.background&&s.background!=='transparent')c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+hex(s.background,'FFFFFF')}};if(s.borders)c.border=Object.fromEntries(Object.entries(s.borders).map(([side,b])=>[side,{style:b.type==='none'?undefined:b.type==='dashed'?'dashed':b.type==='dotted'?'dotted':b.width>2?'medium':'thin',color:{argb:'FF'+hex(b.color)}}]));return c;}
  for(const row of pages[pi].rows){let used=1;for(const f of row.fragments){const b=f.block,start=1+Math.round(b.col/doc.page.columns*120),end=Math.round((b.col+b.span)/doc.page.columns*120),top=cursor+Math.round(f.gridOffset??0),style=b.style;
    if(b.table){const t=b.table;let offset=top;for(const r of tableRows(b,f)){let x=start;const rowCells:Record<string,import('exceljs').Cell>={};let lastCell:import('exceljs').Cell|undefined;for(let i=0;i<t.columns.length;i++){const column=t.columns[i],merge=r.kind==='title'?{row:-2,col:0,rowSpan:1,colSpan:t.columns.length}:cellMerge(t,r.index,i),widths=columnPercentages(t.columns),next=i===t.columns.length-1?end+1:Math.max(x+1,start+Math.round(widths.slice(0,i+1).reduce((n,c)=>n+c,0)/100*(end-start+1)));if(merge&&(merge.row!==r.index||merge.col!==i)){x=next;continue;}const right=merge?Math.min(end,start+Math.round(widths.slice(0,i+merge.colSpan).reduce((a,b)=>a+b,0)/100*(end-start+1))-1):next-1;const s={...style,lineHeight:t.lineHeight??style.lineHeight,...(r.kind==='body'?{}:{bold:true,background:'#edf3f6'}),...t.cellStyles?.[cellKey(r.index,column.id,t.rows.length)],...(r.kind==='title'?{background:'#1c3954',color:'#ffffff',...t.titleStyle}:{})};const value=r.values[i];const written=cell(offset,x,right,r.kind==='body'&&['amount','price','quantity'].includes(column.role)&&value!==''&&Number.isFinite(Number(value))?Number(value):r.kind==='total'&&i===t.columns.length-1?Number(value):value,s,displayRuns(r.kind==='title'?t.richCells?.title:t.richCells?.[cellKey(r.index,column.id,t.rows.length)],value),offset+(merge?.rowSpan??1)-1);rowCells[column.role]=written;lastCell=written;x=next;}
     if(r.kind==='body'&&rowCells.amount){const amount=rowCells.amount;if(rowCells.quantity&&rowCells.price)amount.value={formula:`${rowCells.quantity.address}*${rowCells.price.address}`,result:Number(r.values[t.columns.findIndex(c=>c.role==='amount')])};const refs=amounts.get(b.id)??[];refs.push({sheet:sheet.name,address:amount.address});amounts.set(b.id,refs);}
     if(r.kind==='total'&&lastCell){const refs=amounts.get(b.id)??[],groups=new Map<string,string[]>();refs.forEach(ref=>groups.set(ref.sheet,[...groups.get(ref.sheet)??[],ref.address]));const ranges=[...groups].map(([name,addresses])=>`'${name.replaceAll("'","''")}'!${addresses[0]}:${addresses.at(-1)}`);if(ranges.length)lastCell.value={formula:`SUM(${ranges.join(',')})`,result:tableTotal(t)};}
     sheet.getRow(offset).height=Math.max(12,(t.rowHeights?.[rowHeightKey(r.index,t.rows.length)]??((t.padding??7)*2+style.size*1.333*(t.lineHeight??1.55)))*.75);offset++;}used=Math.max(used,offset-cursor);}
    else if(b.type==='signature'){
     const above=b.signatureTitlePosition!=='below';cell(top,start,end,above?b.text:b.caption??'서명 / 도장',{...style,bold:above});const imageRows=Math.max(2,Math.ceil((b.signatureHeight??b.height)*72/25.4/18));for(const i of b.images??[]){const id=book.addImage({base64:i.asset.data,extension:i.asset.data.startsWith('data:image/png')?'png':'jpeg'});const pixels=(210-doc.page.margins.left-doc.page.margins.right)*MM*b.span/doc.page.columns*i.width/100;sheet.addImage(id,{tl:{col:start-1+i.x/100*(end-start+1),row:top+i.y/100*imageRows},ext:{width:pixels,height:pixels*i.asset.height/i.asset.width}});}cell(top+imageRows+1,start,end,above?b.caption??'서명 / 도장':b.text,{...style,bold:!above});used=Math.max(used,top-cursor+imageRows+2);
    }else if(b.asset){const id=book.addImage({base64:b.asset.data,extension:b.asset.data.startsWith('data:image/png')?'png':'jpeg'});const w=(210-doc.page.margins.left-doc.page.margins.right)*MM*b.span/doc.page.columns;const h=Math.min(b.height*MM,w*b.asset.height/b.asset.width);sheet.addImage(id,{tl:{col:start-1,row:top-1},ext:{width:Math.min(w,h*b.asset.width/b.asset.height),height:h}});used=Math.max(used,top-cursor+Math.ceil(h*.75/18));}
    else if(b.field){cell(top,start,end,`${b.field.name}  ${b.field.type==='checkbox'?(fieldValue(doc,b.field)==='true'?'☑':'☐'):fieldValue(doc,b.field)}`,style);used=Math.max(used,top-cursor+2);}
    else if(b.type==='text'||b.type==='emoji'){cell(top,start,end,f.text??b.text,style,runs(b,f));sheet.getRow(top).height=Math.max(22,(metrics[b.id]?.height??30)*.75);used=Math.max(used,top-cursor+1);}
    else if(b.type==='divider'){const c=cell(top,start,end,b.direction==='vertical'?'│':'',style);c.border={bottom:{style:b.lineStyle==='dotted'?'dotted':b.lineStyle==='dashed'?'dashed':'thin',color:{argb:'FF'+hex(style.color)}}};}
    else used=Math.max(used,Math.ceil(f.height*.75/18));
   }cursor+=used+1;}sheet.pageSetup.printArea=`A1:DP${Math.max(1,cursor)}`;
 }
 return {name:`${clean(doc.name)}.xlsx`,data:new Uint8Array(await book.xlsx.writeBuffer())};
}

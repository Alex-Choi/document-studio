import {makeBlock,newDoc,uid} from './model';
import type {Block,StudioDoc,TableData} from './model';
/** Editable starting point; source rows, merges and styles remain regular table data. */
export function podExample():StudioDoc {
 const doc=newDoc('POD',true);doc.name='POD · 인도 확인서';doc.page.widgetGrid=false;doc.page.margins={top:8,bottom:8,left:9,right:9};doc.page.header.height=0;doc.page.header.items=[];doc.page.footer.height=5;doc.page.footer.items=[{id:uid(),type:'text',text:'This document serves as proof of cargo handover and receipt.  ·  {page} / {pages}',x:0,y:0,width:192,height:5,color:'#25394b',size:8}];
 let row=0;
 const text=(value:string,size:number,bold=false)=>{const b=makeBlock('text',row++);b.text=value;b.style={...b.style,font:'Times New Roman',size,bold,align:'center',color:'#102b45',lineHeight:1.1};doc.blocks.push(b);return b;};
 const heading=text('PROOF OF DELIVERY (POD)\nReceipt Confirmation and Related Documents',25,true);heading.rich=[{text:'PROOF OF DELIVERY (POD)\n',style:{size:25,bold:true}},{text:'Receipt Confirmation and Related Documents',style:{size:13,bold:true}}];heading.keepWithNext=true;
 const table=(title:string,widths:number[],names:string[],values:string[][],showHeader=false)=>{const b=makeBlock('table',row++);b.style={...b.style,font:'Times New Roman',size:10,lineHeight:1.15,color:'#111827'};const columns=widths.map((width,i)=>({id:uid(),name:names[i]??'',width,role:'text' as const}));b.table={columns,rows:values.map(values=>Object.fromEntries(columns.map((c,i)=>[c.id,values[i]??'']))),total:false,repeatable:true,title,showHeader,padding:3,lineHeight:1.15,merges:[],cellStyles:{}};doc.blocks.push(b);return b;};
 const line=':  '+ '_'.repeat(78);
 const general=table('1.  GENERAL INFORMATION',[21,31.5,17.5,30],[],[
 ['POD No.',':  ________________________','Date',':  ______________________'],['Time',':  ________________________','Delivery Note No.',':  ______________________'],['Shipment Reference No.\n(Invoice / PI / PO / SO)',line],['Shipper',line],['Consignee',line],['Delivered By',line],['Received By',line]
 ]);general.table!.merges=[2,3,4,5,6].map(row=>({row,col:1,rowSpan:1,colSpan:3}));
 const label=(t:TableData,r:number,c:number)=>{t.cellStyles![`${r}:${t.columns[c].id}`]={background:'#e5ebf0',bold:true};};
 general.table!.rows.forEach((_,r)=>{label(general.table!,r,0);if(r<2)label(general.table!,r,2);});
 const cargo=table('2.  CARGO DETAILS',[7,25.5,14,16.5,21,16],['No.','Cargo Description','Quantity','Package Type','Condition on Receipt','Remarks'],Array.from({length:5},(_,i)=>[String(i+1),'','','','','']),true);cargo.table!.rowHeights=Object.fromEntries(Array.from({length:5},(_,r)=>[String(r),24]));
 const instructions=table('3.  INSTRUCTIONS AT TIME OF CARGO RECEIPT',[100],[],[[
 '•  Please check the following items when receiving cargo.\n•  Prepare receipt / handover documents such as a Delivery Note or Cargo In-Out Receipt.\n•  Confirm the signatures and company stamps of both the delivering party and the receiving party.\n•  Ensure that the document includes the following information:\n    ○  Date and time     ○  Cargo quantity     ○  Cargo details\n    ○  Shipment reference numbers such as Invoice / PI / PO / SO\n•  If there are any discrepancies such as shortage, damage, or misdelivery, clearly note them at the time of receipt.'
 ]]);instructions.keepWithNext=false;
 table('4.  DISCREPANCIES / EXCEPTIONS NOTED AT RECEIPT',[100],[],[['________________________________________________________________________________________'],['________________________________________________________________________________________'],['________________________________________________________________________________________']]);
 const signTitle=text('5.  SIGNATURES',10,true);signTitle.style={...signTitle.style,align:'left',background:'#1c3954',color:'#ffffff',lineHeight:1.15};signTitle.keepWithNext=true;
 const signatureRow=row;
 const sign=(title:string,col:number)=>{const b=table(title,[30,70],[],[['Name',':  ___________________________'],['Signature',':  ___________________________'],['Company Stamp',':'],['Date',':  ___________________________']]);b.row=signatureRow;b.col=col;b.span=6;b.table!.titleStyle={background:'#e5ebf0',color:'#172d45'};b.table!.rowHeights={'2':56};b.table!.rows.forEach((_,r)=>label(b.table!,r,0));return b;};
 sign('Delivered By',0);sign('Received By',6);return doc;
}

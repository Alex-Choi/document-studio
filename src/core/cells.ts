import {expandMergedSelection} from './table';
import type { CellStyle, TableData, InlineStyle } from './model';
import { cellValue, tableTotal } from './model';
import { fontFamily } from './rich';
export interface CellSelection { blockId:string; r1:number;r2:number;c1:number;c2:number;kind:'table'|'row'|'column'|'cells';zone?:'head'|'body'|'total' }
export const cellKey=(row:number,column:string,count:number)=>`${row===-1?'head':row===count?'total':row}:${column}`;
export function selectionLabel(s:CellSelection,table:TableData){if(s.kind==='table')return '선택: 표 전체';if(s.kind==='row')return `선택: ${s.r1===-1?'머리행':s.r1===table.rows.length?'합계 행':`${s.r1+1}행`} 전체`;if(s.kind==='column')return `선택: ${table.columns[s.c1]?.name??s.c1+1} 열 전체`;return `선택: ${(s.r2-s.r1+1)*(s.c2-s.c1+1)}개 셀`;}
export function applyCellStyles(table:TableData,s:CellSelection,patch:CellStyle,borderScope?:'all'|'outer'|'inner'|'top'|'right'|'bottom'|'left'|'none'):TableData{
 const revision=Object.values(table.cellStyles??{}).reduce((max,s)=>Object.values(s.borders??{}).reduce((m,b)=>Math.max(m,b?.revision??0),max),0)+1;
 const cellStyles={...table.cellStyles},richCells={...table.richCells};const typography=Object.fromEntries(Object.entries(patch).filter(([key])=>['font','size','bold','italic','underline','color','highlight','align','lineHeight'].includes(key))) as InlineStyle;
 for(let row=s.r1;row<=s.r2;row++)for(let col=s.c1;col<=s.c2;col++){
  const column=table.columns[col];if(!column)continue;const key=cellKey(row,column.id,table.rows.length);const old=cellStyles[key]??{};const next={...old,...patch,borders:{...old.borders}};
  if(borderScope&&patch.borders){const border=patch.borders.top!;for(const side of ['top','right','bottom','left'] as const){const outer=side==='top'?row===s.r1:side==='bottom'?row===s.r2:side==='left'?col===s.c1:col===s.c2;const apply=borderScope==='all'||borderScope==='none'||borderScope===side||borderScope==='outer'&&outer||borderScope==='inner'&&!outer;if(apply)next.borders[side]={...border,revision,type:borderScope==='none'?'none':border.type};}}
  else if(patch.borders)next.borders={...old.borders,...Object.fromEntries(Object.entries(patch.borders).map(([side,b])=>[side,{...b,revision}]))};cellStyles[key]=next;
  if(richCells[key]||patch.highlight){const text=row===-1?column.name:row===table.rows.length?col===0?'합계':col===table.columns.length-1?`₩ ${tableTotal(table).toLocaleString('ko-KR')}`:'':cellValue(table,table.rows[row],column);const runs=richCells[key]??[{text}];richCells[key]=runs.map(run=>({...run,style:{...run.style,...typography}}));}
 }
 return {...table,cellStyles,richCells};
}
export function cellCSS(style:CellStyle):Record<string,string|number|undefined>{const css:Record<string,string|number|undefined>={backgroundColor:style.background,color:style.color,fontFamily:style.font?fontFamily(style.font):undefined,fontSize:style.size?`${style.size}pt`:undefined,fontWeight:style.bold===undefined?undefined:style.bold?700:400,fontStyle:style.italic===undefined?undefined:style.italic?'italic':'normal',textDecoration:style.underline===undefined?undefined:style.underline?'underline':'none',textAlign:style.align,verticalAlign:style.vertical,padding:style.padding===undefined?undefined:`${style.padding}px`,lineHeight:style.lineHeight};for(const [side,border] of Object.entries(style.borders??{}))if(border)css[`border${side[0].toUpperCase()+side.slice(1)}`]=`${border.type==='none'?0:border.width}px ${border.type==='none'?'hidden':border.type} ${border.color}`;return css;}
export function normalizeCellSelection(table:TableData,s:CellSelection):CellSelection{
 const total=table.rows.length,last=table.total?total:total-1;
 const c1=Math.max(0,Math.min(table.columns.length-1,s.c1)),c2=Math.max(c1,Math.min(table.columns.length-1,s.c2));
 if(s.kind==='table'||s.kind==='column')return expandMergedSelection(table,{...s,r1:table.showHeader===false?0:-1,r2:last,c1:s.kind==='table'?0:c1,c2:s.kind==='table'?table.columns.length-1:c2});
 const r1=s.zone==='total'?last:Math.max(-1,Math.min(s.zone==='body'?total-1:last,s.r1));return expandMergedSelection(table,{...s,r1,r2:s.kind==='row'?r1:Math.max(r1,Math.min(last,s.r2)),c1,c2});
}
export function clearCellTypography(table:TableData,s:CellSelection):TableData{
 const revision=Object.values(table.cellStyles??{}).reduce((max,s)=>Object.values(s.borders??{}).reduce((m,b)=>Math.max(m,b?.revision??0),max),0)+1;
 const cellStyles={...table.cellStyles},richCells={...table.richCells};
 for(let row=s.r1;row<=s.r2;row++)for(let col=s.c1;col<=s.c2;col++){const key=cellKey(row,table.columns[col].id,table.rows.length),style={...cellStyles[key]};for(const name of ['font','size','bold','italic','underline','color','highlight','align','lineHeight'] as const)delete style[name];cellStyles[key]=style;if(richCells[key])richCells[key]=richCells[key].map(run=>({text:run.text}));}
 return {...table,cellStyles,richCells};
}

/** A shared edge paints once, using the latest explicit border on either adjacent cell.
 * Neighboring cells retain their own stored typography/background/format records. */
export function paintedCellStyle(table:TableData,row:number,col:number,from=0,to=table.rows.length,last=true):CellStyle{
 const get=(r:number,c:number)=>r>=-1&&r<=table.rows.length&&c>=0&&c<table.columns.length?table.cellStyles?.[cellKey(r,table.columns[c].id,table.rows.length)]??{}:{};
 const own=get(row,col),borders={...own.borders};
 const previous=row===-1?undefined:row===from?-1:row-1,next=row===-1?from:row===table.rows.length?undefined:row===to-1?last&&table.total?table.rows.length:undefined:row+1;
 const neighbors={top:previous===undefined?undefined:get(previous,col).borders?.bottom,bottom:next===undefined?undefined:get(next,col).borders?.top,left:get(row,col-1).borders?.right,right:get(row,col+1).borders?.left};
 for(const side of ['top','right','bottom','left'] as const){const edge=neighbors[side];if(edge&&(!borders[side]||(edge.revision??0)>(borders[side]?.revision??0)))borders[side]=edge;}
 return {...own,borders};
}

/** A merged cell paints its outside edges, using the covered perimeter records. */
export function mergedCellStyle(table:TableData,row:number,col:number,from=0,to=table.rows.length,last=true):CellStyle {
 const merge=table.merges?.find(m=>m.row===row&&m.col===col),own=paintedCellStyle(table,row,col,from,to,last);if(!merge)return own;
 return {...own,borders:{...own.borders,right:paintedCellStyle(table,row,col+merge.colSpan-1,from,to,last).borders?.right,bottom:paintedCellStyle(table,row+merge.rowSpan-1,col,from,to,last).borders?.bottom}};
}

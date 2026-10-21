import type { Column } from './model';

export function columnPercentages(columns: Column[]): number[] {
  const total = columns.reduce((sum, column) => sum + column.width, 0);
  return columns.map(column => column.width / total * 100);
}

// Move a boundary between adjacent columns; preserve the table's outer width.
export function resizeColumnBoundary(columns: Column[], index: number, deltaPercent: number, minimumPercent = 1): Column[] {
  if (index < 0 || index >= columns.length - 1 || !Number.isFinite(deltaPercent)) return columns;
  const widths = columnPercentages(columns);
  const pair = widths[index] + widths[index + 1];
  const minimum = Math.min(Math.max(1, minimumPercent), pair / 2);
  const left = Math.min(pair - minimum, Math.max(minimum, widths[index] + deltaPercent));
  widths[index] = left;
  widths[index + 1] = pair - left;
  return columns.map((column, i) => ({ ...column, width: widths[i] }));
}

import type { TableData, CellMerge } from './model';
import type { CellSelection } from './cells';
export const rowHeightKey=(row:number,count:number)=>row===-1?'head':row===count?'total':String(row);
export function cellMerge(table:TableData,row:number,col:number):CellMerge|undefined {return table.merges?.find(m=>row>=m.row&&row<m.row+m.rowSpan&&col>=m.col&&col<m.col+m.colSpan);}
export function expandMergedSelection(table:TableData,s:CellSelection):CellSelection {
 let next={...s},changed=true;while(changed){changed=false;for(const m of table.merges??[]){if(m.row>next.r2||m.row+m.rowSpan-1<next.r1||m.col>next.c2||m.col+m.colSpan-1<next.c1)continue;const bounds={r1:Math.min(next.r1,m.row),r2:Math.max(next.r2,m.row+m.rowSpan-1),c1:Math.min(next.c1,m.col),c2:Math.max(next.c2,m.col+m.colSpan-1)};if(Object.entries(bounds).some(([k,v])=>next[k as keyof typeof bounds]!==v)){next={...next,...bounds};changed=true;}}}return next;
}
export function mergeProblem(t:TableData,s:CellSelection):string {
 if(s.r1===s.r2&&s.c1===s.c2)return '두 개 이상의 셀을 선택하세요.';
 if(s.r1<0&&s.r2>=0||s.r1<t.rows.length&&s.r2>=t.rows.length)return '머리행·본문·합계 행은 각각 따로 병합하세요.';
 if(t.columns.slice(s.c1,s.c2+1).some(c=>c.role==='amount'))return '자동 계산 열은 병합할 수 없습니다. 열 역할을 일반 텍스트로 변경하세요.';
 return '';
}
export function mergeCells(t:TableData,s:CellSelection):TableData {s=expandMergedSelection(t,s);if(mergeProblem(t,s))return t;return {...t,merges:[...(t.merges??[]).filter(m=>m.row+m.rowSpan<=s.r1||m.row>s.r2||m.col+m.colSpan<=s.c1||m.col>s.c2),{row:s.r1,col:s.c1,rowSpan:s.r2-s.r1+1,colSpan:s.c2-s.c1+1}]};}
export function splitCells(t:TableData,s:CellSelection):TableData {return {...t,merges:(t.merges??[]).filter(m=>m.row>s.r2||m.row+m.rowSpan-1<s.r1||m.col>s.c2||m.col+m.colSpan-1<s.c1)};}
/** Last-row/column deletion clips merge ranges without orphaning covered cells. */
export function trimTable(t:TableData):TableData {return {...t,merges:(t.merges??[]).filter(m=>m.col<t.columns.length&&(m.row<0||m.row<=t.rows.length)).map(m=>({...m,colSpan:Math.min(m.colSpan,t.columns.length-m.col),rowSpan:m.row<0||m.row===t.rows.length?1:Math.min(m.rowSpan,t.rows.length-m.row)})).filter(m=>m.rowSpan*m.colSpan>1)};}
/** No page boundary can cut through a vertical merged cell. */
export function tableGroupEnd(t:TableData,start:number):number {let end=start+1;for(let changed=true;changed;){changed=false;for(const m of t.merges??[]){if(m.row>=0&&m.row<end&&m.row+m.rowSpan>start&&m.row+m.rowSpan>end){end=m.row+m.rowSpan;changed=true;}}}return Math.min(t.rows.length,end);}
export function resizeTableRows(t:TableData,rows:TableData['rows']):TableData {
 const count=t.rows.length;return trimTable({...t,rows,merges:(t.merges??[]).filter(m=>m.row===count||m.row<rows.length).map(m=>m.row===count?{...m,row:rows.length}:m)});
}

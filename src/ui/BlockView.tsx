import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { GripVertical, ImagePlus, Copy, Trash2, Plus, LockKeyhole } from 'lucide-react';
import { cellValue, fieldValue, tableTotal, MM } from '../core/model';
import type { Block, StudioDoc, Mode, Placement, Column } from '../core/model';
import { columnPercentages, resizeColumnBoundary } from '../core/table';
import type { Fragment } from '../core/layout';
import { widgetHeight, signatureStageHeight } from '../core/widgets';
import { InlineLabel } from './InlineLabel';
import { RichEditor as EditableContent } from './RichEditor';
import { fontFamily, displayRuns, plainRuns, richText, sliceRuns, spliceRuns } from '../core/rich';
import { cellCSS, cellKey, paintedCellStyle } from '../core/cells';
import type { CellSelection } from '../core/cells';
import type { RichRun } from '../core/model';
export type ResizeEdge = 'e' | 'w' | 'n' | 's' | 'ne' | 'nw' | 'se' | 'sw';
export interface BlockProps { cellSelection?: CellSelection | null; cellMode?: boolean; selectCells?: (s: CellSelection, editing?: boolean) => void; selectImage?: (id: string) => void; block: Block; doc: StudioDoc; mode: Mode; fragment?: Fragment; measuring?: boolean; preview?: boolean; selected?: boolean; update?: (id: string, patch: Partial<Block>) => void; value?: (id: string, value: string) => void; select?: (id: string) => void; move?: (e: ReactPointerEvent, b: Block, resize?: ResizeEdge) => void; duplicate?: (id: string) => void; remove?: (id: string) => void; chooseAsset?: (id: string) => void; moveImage?: (e: ReactPointerEvent, b: Block, image: Placement) => void }
const money = (v: string | number) => Number.isFinite(Number(v)) ? Number(v).toLocaleString('ko-KR') : '입력 확인';
function TableContent({ block, fragment, structure, interactive, editableRows, measuring, update, select, cellSelection, cellMode, selectCells }: {
  block: Block; fragment?: Fragment; structure: boolean; interactive: boolean; editableRows: boolean; measuring?: boolean; update?: BlockProps['update']; select?: BlockProps['select']; cellSelection?: CellSelection | null; cellMode?: boolean; selectCells?: BlockProps['selectCells'];
}) {
  const table = block.table!;
  const latestTable = useRef(table); latestTable.current = table;
  const from = fragment?.from ?? 0, to = fragment?.to ?? table.rows.length;
  const [draftColumns, setDraftColumns] = useState<Column[] | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelRef.current?.(), []);
  const [rowOffsets,setRowOffsets]=useState<number[]>([]);
  useLayoutEffect(()=>{const el=tableRef.current;if(!el||!interactive)return;const read=()=>{const offsets=[...el.rows].map(row=>row.offsetTop+row.offsetHeight/2);setRowOffsets(old=>JSON.stringify(old)===JSON.stringify(offsets)?old:offsets);};read();const observer=new ResizeObserver(read);observer.observe(el);return()=>observer.disconnect();},[table,draftColumns,interactive]);
  const dragCell=useRef<{row:number;col:number}|null>(null);
  useEffect(()=>{const up=()=>{dragCell.current=null;};window.addEventListener('pointerup',up);return()=>window.removeEventListener('pointerup',up);},[]);
  const choose=(row:number,col:number,kind:CellSelection['kind']='cells',editing=false)=>{select?.(block.id);selectCells?.({blockId:block.id,r1:kind==='column'?-1:row,r2:kind==='column'?table.rows.length:row,c1:kind==='row'?0:col,c2:kind==='row'?table.columns.length-1:col,kind},editing);};
  const cellProps=(row:number,col:number,display?:string)=>{const key=cellKey(row,table.columns[col].id,table.rows.length);return {cellKey:key,runs:displayRuns(table.richCells?.[key],display??(row===-1?table.columns[col].name:row===table.rows.length?col===0?(table.totalLabel??'합계'):col===table.columns.length-1?`₩ ${money(tableTotal(table))}`:'':cellValue(table,table.rows[row],table.columns[col]))),style:cellCSS(paintedCellStyle(table,row,col,from,to,fragment?.last??true)),className:cellSelection?.blockId===block.id&&row>=cellSelection.r1&&row<=cellSelection.r2&&col>=cellSelection.c1&&col<=cellSelection.c2?'selected-cell':undefined,
  onPointerDown:(e:ReactPointerEvent)=>{if(!interactive)return;if(cellMode||e.shiftKey){e.preventDefault();e.stopPropagation();const anchor=e.shiftKey&&cellSelection?.blockId===block.id?{row:cellSelection.r1,col:cellSelection.c1}:{row,col};dragCell.current=anchor;select?.(block.id);selectCells?.({blockId:block.id,r1:Math.min(row,anchor.row),r2:Math.max(row,anchor.row),c1:Math.min(col,anchor.col),c2:Math.max(col,anchor.col),kind:'cells'});}else choose(row,col,'cells',true);},
  onPointerEnter:(e:ReactPointerEvent)=>{const a=dragCell.current;if(!a||!e.buttons)return;selectCells?.({blockId:block.id,r1:Math.min(row,a.row),r2:Math.max(row,a.row),c1:Math.min(col,a.col),c2:Math.max(col,a.col),kind:'cells'});}};};
  const saveCell=(row:number,col:number,text:string,runs:RichRun[])=>{const t=latestTable.current,key=cellKey(row,t.columns[col].id,t.rows.length);const richCells={...t.richCells,[key]:runs};if(row===t.rows.length){if(col===0)update?.(block.id,{table:{...t,totalLabel:text,richCells}});return;}if(row===-1)update?.(block.id,{table:{...t,columns:t.columns.map((c,i)=>i===col?{...c,name:text}:c),richCells}});else {const rows=[...t.rows];rows[row]={...rows[row],[t.columns[col].id]:text};update?.(block.id,{table:{...t,rows,richCells}});}};
  const columns = draftColumns ?? table.columns;
  const widths = columnPercentages(columns);
  const startResize = (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    if (event.button !== 0 || !structure || !tableRef.current) return;
    event.preventDefault(); event.stopPropagation();
    if (document.activeElement instanceof HTMLElement && document.activeElement.isContentEditable) document.activeElement.blur();
    select?.(block.id);
    cancelRef.current?.();
    const handle = event.currentTarget, pointerId = event.pointerId;
    const startX = event.clientX, visualWidth = tableRef.current.getBoundingClientRect().width;
    if (visualWidth <= 0) return;
    const unscaledWidth = tableRef.current.offsetWidth;
    let next = table.columns, changed = false;
    setDragging(index);
    handle.setPointerCapture(pointerId);
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      // Client coordinates already include document zoom; use the visual width.
      next = resizeColumnBoundary(table.columns, index, (e.clientX - startX) / visualWidth * 100, 24 / unscaledWidth * 100);
      changed = columnPercentages(next).some((width, i) => Math.abs(width - columnPercentages(table.columns)[i]) > .001);
      setDraftColumns(next);
    };
    const finish = (commit: boolean) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', cancel);
      handle.removeEventListener('lostpointercapture', cancel);
      cancelRef.current = null;
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      setDraftColumns(null); setDragging(null);
      if (commit && changed) update?.(block.id, { table: { ...latestTable.current, columns: next } });
    };
    const up = (e: PointerEvent) => { if (e.pointerId === pointerId) { move(e); finish(true); } };
    const cancel = () => finish(false);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); finish(false); } };
    cancelRef.current = cancel;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key);
    window.addEventListener('blur', cancel);
    handle.addEventListener('lostpointercapture', cancel);
  };
  return <div className={`table-content ${dragging !== null ? 'table-resizing' : ''}`}>
    <table ref={tableRef}>
      <colgroup>{columns.map((column, i) => <col key={column.id} style={{ width: `${widths[i]}%` }}/>)}</colgroup>
      <thead><tr>{table.columns.map((column,col) => <EditableContent key={column.id} tag="th" value={column.name} editable={interactive&&!cellMode} {...cellProps(-1,col)} onChange={(name,runs)=>saveCell(-1,col,name,runs)}/>)}</tr></thead>
      <tbody>{table.rows.slice(from,to).map((row,local)=><tr key={from+local} data-table-row={from+local}>{table.columns.map((column,col)=><EditableContent key={column.id} tag="td" calculated={column.role==='amount'} editable={editableRows&&column.role!=='amount'&&!cellMode} value={column.role==='amount'||column.role==='price'?(cellValue(table,row,column)===''?'':money(cellValue(table,row,column))):cellValue(table,row,column)} {...cellProps(from+local,col,column.role==='amount'||column.role==='price'?(cellValue(table,row,column)===''?'':money(cellValue(table,row,column))):cellValue(table,row,column))} onChange={(text,runs)=>saveCell(from+local,col,text,runs)}/>)}</tr>)}</tbody>
      {table.total&&(fragment?.last??true)&&<tfoot><tr>{columns.map((column,col)=><EditableContent key={column.id} tag="td" value={col===0?(table.totalLabel??'합계'):col===columns.length-1?`₩ ${money(tableTotal(table))}`:''} editable={interactive&&col===0&&!cellMode} {...cellProps(table.rows.length,col)} onChange={(name,runs)=>saveCell(table.rows.length,col,name,runs)}/>)}</tr></tfoot>}
    </table>
    {interactive&&<div className="table-selection-handles print-hidden"><button className="table-all-select" aria-label="표 전체 선택 손잡이" onPointerDown={e=>{e.preventDefault();e.stopPropagation();select?.(block.id);selectCells?.({blockId:block.id,r1:-1,r2:table.rows.length,c1:0,c2:columns.length-1,kind:'table'});}}>▦</button>{columns.map((c,i)=><button key={c.id} className="table-col-select" style={{left:`${widths.slice(0,i).reduce((a,b)=>a+b,0)+widths[i]/2}%`}} aria-label={`${c.name} 열 선택`} onPointerDown={e=>{e.preventDefault();e.stopPropagation();choose(-1,i,'column');}}>▾</button>)}{rowOffsets.map((top,i)=>{const row=i===0?-1:i===rowOffsets.length-1&&table.total&&(fragment?.last??true)?table.rows.length:from+i-1;return <button key={row} className="table-row-select" style={{top}} aria-label={row===-1?'머리행 선택 손잡이':row===table.rows.length?'합계 행 선택 손잡이':`${row+1}행 선택 손잡이`} onPointerDown={e=>{e.preventDefault();e.stopPropagation();choose(row,0,'row');}}>▸</button>;})}</div>}
    {structure && widths.slice(0, -1).map((_, i) => <button key={table.columns[i].id} className={`table-column-resizer print-hidden ${dragging === i ? 'active' : ''}`} style={{ left: `${widths.slice(0, i + 1).reduce((sum, width) => sum + width, 0)}%` }} aria-label={`${table.columns[i].name} 오른쪽 열 경계 조절`} title="좌우로 드래그하여 열 너비 조절 · Esc 취소" onPointerDown={e => startResize(e, i)} onClick={e => e.stopPropagation()} onKeyDown={e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); e.stopPropagation();
      update?.(block.id, { table: { ...table, columns: resizeColumnBoundary(table.columns, i, (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 5 : 1)) } });
    }}/>) }
    {fragment?.continued && !measuring && <span className="continuation print-hidden">이전 페이지에서 이어짐</span>}
  </div>;
}
export function BlockView({ block: b, doc, mode, fragment: f, measuring, preview, selected, update, value, select, move, duplicate, remove, chooseAsset, moveImage, cellSelection, cellMode, selectCells, selectImage }: BlockProps) {
  const editable = !measuring && !preview; const structure = editable && mode === 'template';
  const widget = !!doc.page.widgetGrid;
  const occupiedHeight = widget ? f?Math.max(0,f.height-(b.freeY??0)*(doc.page.gridRowMm??12)*MM):widgetHeight(doc,b.rowSpan ?? 1) : b.height*MM;
  const stageHeight = signatureStageHeight(doc,b,widget && f?.oversized ? occupiedHeight : undefined);
  const style: CSSProperties = { fontFamily: fontFamily(b.style.font), fontSize: `${b.style.size}pt`, fontWeight: b.style.bold ? 700 : 400, fontStyle: b.style.italic ? 'italic' : 'normal', textDecoration: b.style.underline ? 'underline' : 'none', color: b.style.color, textAlign: b.style.align, backgroundColor: b.style.background, lineHeight: b.style.lineHeight??1.65 };
  const text = f?.text ?? b.text;
  const commitText=(v:string,runs:RichRun[])=>{const all=b.rich??plainRuns(b.text);const next=f?.text!==undefined?spliceRuns(all,f.textOffset??0,f.text.length,runs):runs;update?.(b.id,{text:richText(next),rich:next});};
  const patchPlacement = (id: string) => update?.(b.id, { images: b.images?.map(i => i.id === id ? { ...i, locked: !i.locked } : i) });
  let body;
  if (b.type === 'text' || b.type === 'emoji') body = <EditableContent value={text} runs={b.rich?f?.text!==undefined?sliceRuns(b.rich,f.textOffset??0,(f.textOffset??0)+f.text.length):b.rich:undefined} editable={editable} className="text-content" style={{backgroundColor:b.style.highlight}} textContent onChange={commitText}/>;
  else if (b.type === 'table' && b.table) {
    body = <TableContent block={b} fragment={f} structure={structure} interactive={editable} editableRows={editable && (mode === 'template' || b.table.repeatable)} measuring={measuring} update={update} select={select} cellSelection={cellSelection} cellMode={cellMode} selectCells={selectCells}/>;
  } else if ((b.type === 'field' || b.type === 'checkbox') && b.field) {
    const field = b.field; const v = fieldValue(doc, field);const writing=editable;
    const setFieldValue=(next:string)=>{if(mode==='document')value?.(field.id,next);else update?.(b.id,{field:{...field,defaultValue:next}});};
    body = <div className={`field-content ${field.type === 'checkbox' ? 'check-field' : ''}`} style={{backgroundColor:b.style.background==='transparent'?undefined:b.style.background}}><span className="field-label" style={field.labelWidth?{width:field.labelWidth*MM,maxWidth:'70%'}:undefined}><InlineLabel value={field.name} editable={editable} label="항목 이름 직접 편집" onChange={name=>{if(name!==field.name)update?.(b.id,{field:{...field,name}});}}/>{field.required && <small className="field-required"> *</small>}</span>{field.type === 'checkbox' ? <label className="checkbox-value"><input aria-label={field.name} type="checkbox" checked={v === 'true'} disabled={!editable} onChange={e => setFieldValue(String(e.target.checked))} /><span>{v === 'true' ? '확인' : '미확인'}</span></label> : <span className={`field-value field-entry ${writing?'is-writing':''}`}>
      <span className="field-output" aria-hidden={writing || undefined}>{v || '\u200b'}</span>
      {!v && <span className="field-empty field-placeholder" aria-hidden="true">{mode==='template'&&!preview?`{${field.name}}`:'—'}</span>}
      {writing && <input aria-label={field.name} type={field.type} value={v} placeholder={field.type === 'date' ? '' : mode==='template'?'기본값 입력':'입력하세요'} onChange={e => setFieldValue(e.target.value)} required={field.required} />}
    </span>}</div>;
  } else if (b.type === 'image') body = b.asset ? <img className="document-image" src={b.asset.data} alt={b.asset.name} style={{ height: occupiedHeight, objectFit: b.crop?.fit??'contain', objectPosition:`${b.crop?.x??50}% ${b.crop?.y??50}%` }} /> : <button className="image-placeholder print-hidden" onClick={() => chooseAsset?.(b.id)} style={{ height: occupiedHeight }}><ImagePlus size={24} /><span>이미지 선택</span></button>;
  else if (b.type === 'divider') body = b.direction==='vertical' ? <div className="divider-content vertical-divider" data-direction="vertical" style={{height:occupiedHeight,padding:`${Math.min(b.spacing*MM,Math.max(0,(occupiedHeight-b.lineWidth*MM)/2))}px 0`,display:'flex',justifyContent:'center'}}><div data-divider-line style={{width:b.lineWidth*MM,height:'100%',background:!b.lineStyle||b.lineStyle==='solid'?b.style.color:'transparent',borderLeft:b.lineStyle&&b.lineStyle!=='solid'?`${b.lineWidth*MM}px ${b.lineStyle} ${b.style.color}`:undefined,flexShrink:0}}/></div> : <div className="divider-content" data-direction="horizontal" style={{ padding: `${b.spacing * MM}px 0` }}><div data-divider-line style={{ height:b.lineWidth*MM,background:!b.lineStyle||b.lineStyle==='solid'?b.style.color:'transparent',borderTop:b.lineStyle&&b.lineStyle!=='solid'?`${b.lineWidth*MM}px ${b.lineStyle} ${b.style.color}`:undefined }} /></div>;
  else if (b.type === 'spacer') body = <div className="spacer-content" data-direction={b.direction??'vertical'} style={{height:occupiedHeight}}><span className="spacer-hint print-hidden" title={b.direction==='horizontal'?'가로 여백 · 좌우 손잡이로 너비 조절':'세로 여백 · 위아래 손잡이로 높이 조절'}>{b.direction==='horizontal'?'↔ 가로 여백':'↕ 세로 여백'}</span></div>;
  else if (b.type === 'shape') body = <div style={{ height: occupiedHeight, border: `1.5px solid ${b.style.color}`, borderRadius: b.text === 'circle' ? '50%' : '6px', background: b.style.background === 'transparent' ? '#edf5f7' : b.style.background }} />;
  else if (b.type === 'signature') {
    const title = <InlineLabel tag="div" className="signature-title" value={b.text} editable={editable} label="서명 제목 직접 편집" onChange={text=>{if(text!==b.text)update?.(b.id,{text,rich:undefined});}}/>;
    const stage = <div className="signature-stage" style={{ height: stageHeight }}><InlineLabel className="signature-caption" value={b.caption??'서명 / 도장'} editable={editable} label="서명 안내문 직접 편집" onChange={caption=>{if(caption!==(b.caption??'서명 / 도장'))update?.(b.id,{caption});}}/>{b.images?.map(i => <div key={i.id} className={`signature-image ${i.locked ? 'locked' : ''}`} data-signature-image={i.id} onClick={e=>{if(editable){e.stopPropagation();select?.(b.id);selectImage?.(i.id);}}} style={{ left: `${i.x}%`, top: `${i.y}%`, width: `${i.width}%`, aspectRatio: i.asset.width / i.asset.height }} onPointerDown={e => { if (editable && mode === 'document' && !i.locked) moveImage?.(e,b,i); }}><img src={i.asset.data} alt={i.asset.name} />{editable && mode === 'document' && <button className="image-lock print-hidden" aria-label="서명 위치 잠금" onPointerDown={e => e.stopPropagation()} onClick={() => patchPlacement(i.id)}><LockKeyhole size={12}/></button>}</div>)}{editable && mode === 'document' && <button className="signature-add print-hidden" onClick={() => chooseAsset?.(b.id)}><Plus size={16} />서명 선택</button>}{!b.images?.length && mode === 'template' && <div className="signature-empty print-hidden">작성 시 도장·서명을 넣는 영역</div>}</div>;
    body = <div className={`signature-content ${b.signatureTitlePosition==='below'?'signature-title-below':''}`} style={{borderTop:b.signatureLine?(b.signatureLine.style==='none'?'none':`${b.signatureLine.width*MM}px ${b.signatureLine.style} ${b.signatureLine.color}`):undefined}}>{b.signatureTitlePosition==='below'?<>{stage}{title}</>:<>{title}{stage}</>}</div>;
  }
  else body = null;
  return <div data-block-id={b.id} data-block-type={b.type} className={`doc-block block-${b.type} ${widget ? 'widget-block' : ''} ${selected && editable ? 'selected' : ''} ${f?.oversized ? 'oversized' : ''}`} style={{ ...style, ...(widget ? {minHeight:occupiedHeight} : {}), ...(f?.oversized ? { height: f.height, minHeight:0 } : {}) }} onFocusCapture={e=>{if(editable&&!e.currentTarget.contains(e.relatedTarget as Node|null))select?.(b.id);}} onClick={e => { e.stopPropagation(); if (editable) select?.(b.id); }}>
    {selected && structure && <><button className="move-handle print-hidden" aria-label="블록 이동" title="넓은 손잡이를 잡아 빈 격자 칸으로 이동" onPointerDown={e => move?.(e,b)}><GripVertical size={17}/><span>이동</span></button><div className="block-actions print-hidden"><span className="widget-dimensions">{b.span}열{widget ? ` × ${f?.gridRows ?? b.rowSpan ?? 1}행` : ''}</span><button aria-label="블록 복제" onClick={() => duplicate?.(b.id)}><Copy size={14}/></button><button aria-label="블록 삭제" onClick={() => remove?.(b.id)}><Trash2 size={14}/></button></div>
      {(widget ? ['e','w','n','s','se','sw','ne','nw'] : ['e','w','se']).map(edge=><button key={edge} className={`resize-handle resize-${edge} print-hidden`} aria-label={({'e':'오른쪽 너비 조절','w':'왼쪽 너비 조절','n':'위쪽 높이 조절','s':'아래쪽 높이 조절','se':'블록 크기 조절','sw':'왼쪽 아래 크기 조절','ne':'오른쪽 위 크기 조절','nw':'왼쪽 위 크기 조절'} as Record<string,string>)[edge]} title="가로·세로 칸 수 조절" onPointerDown={e=>move?.(e,b,edge as ResizeEdge)}/>)}</>}
    <div className="block-inner">{body}</div>
    {f?.oversized && !measuring && <span className="oversize-note print-hidden">페이지보다 큰 요소 · 자동 축소됨</span>}
  </div>;
}

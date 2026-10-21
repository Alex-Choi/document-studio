import {tableGroupEnd} from './table';
import { MM } from './model';
import type { Block, StudioDoc, FlowBand } from './model';
import type { Fragment, LayoutPage, Metrics } from './layout';

export const GRID_GAP = 6;
export const gridPitch = (doc: StudioDoc) => (doc.page.gridRowMm ?? 12) * MM;
export const widgetHeight = (doc: StudioDoc, rows: number) => rows * gridPitch(doc) - GRID_GAP;
/** Content height is measured without the previously allocated grid rectangle. */
export const contentHeightBlock = (b: Block) => ['text','emoji','table','field','checkbox'].includes(b.type) || (b.type==='divider' && b.direction!=='vertical');
export const autoHeight = (b: Block) => contentHeightBlock(b) && (b.heightMode==='auto' || (b.heightMode===undefined && (b.rowSpan??1)===1));
/** Old multi-row content keeps its placement until edited; explicit manual sizing is retained. */
export function followContentHeight(block: Block, patch: Partial<Block>): Partial<Block> {
  if (!contentHeightBlock(block)) return patch;
  if (patch.rowSpan!==undefined) return {...patch,heightMode:patch.heightMode??'minimum'};
  const changed = ['text','rich','field','table'].some(key=>key in patch) || !!patch.style && (['font','size','lineHeight','bold','italic'] as const).some(key=>key in patch.style! && patch.style![key]!==block.style[key]);
  return changed && block.heightMode===undefined ? {...patch,heightMode:'auto'} : patch;
}
export function signatureStageHeight(doc: StudioDoc, block: Block, height?: number) {
  if (block.signatureHeight !== undefined) return block.signatureHeight * MM;
  if (!doc.page.widgetGrid) return block.height * MM;
  const chrome = block.style.size * 96 / 72 * (block.style.lineHeight??1.65) * 1.05 + 21;
  return Math.max(18, (height ?? widgetHeight(doc,block.rowSpan ?? 4)) - chrome);
}
export interface WidgetRect { block: Block; row: number; col: number; span: number; rows: number; height: number }
export function overlaps(a: WidgetRect, b: WidgetRect) { return a.col < b.col+b.span && b.col < a.col+a.span && a.row < b.row+b.rows && b.row < a.row+a.rows; }
/** Whole rectangles collide, including all occupied rows. A moved widget keeps its chosen cell. */
export function resolveLegacyWidgets(doc: StudioDoc, metrics: Record<string, Metrics>, priorityId?: string, preserveOrder = false): WidgetRect[] {
  const pitch = gridPitch(doc); const columns = doc.page.columns;
  const ordered = [...doc.blocks].sort((a,b) => (a.id === priorityId ? -1 : b.id === priorityId ? 1 : a.row-b.row || (preserveOrder ? 0 : a.col-b.col)));
  const placed: WidgetRect[] = [];
  for (const b of ordered) {
    const span = b.type === 'break' ? columns : Math.min(columns, Math.max(1,Math.round(b.span)));
    const col = b.type === 'break' ? 0 : Math.max(0,Math.min(columns-span,Math.round(b.col)));
    const minimum = autoHeight(b) ? 1 : b.rowSpan ?? 1;
    const rows = b.type === 'break' ? 1 : Math.max(minimum, Math.ceil(((metrics[b.id]?.height ?? widgetHeight(doc,minimum))+(b.freeY??0)*pitch+GRID_GAP-.1)/pitch));
    const rect: WidgetRect = {block:{...b,col,span,freeX:col+span>=columns?0:b.freeX},row:Math.max(0,Math.round(b.row)),col,span:Math.min(columns-col,span+(b.freeX?1:0)),rows,height:widgetHeight(doc,rows)};
    let collision: WidgetRect | undefined;
    while ((collision=placed.find(p=>overlaps(rect,p)))) rect.row=collision.row+collision.rows;
    rect.block={...rect.block,row:rect.row}; placed.push(rect);
  }
  return placed.sort((a,b)=>a.row-b.row || a.col-b.col);
}

/** Migrate additively on the first committed edit. Existing empty rows remain intentional. */
export function ensureBodyFlow(doc: StudioDoc, metrics: Record<string, Metrics>) {
  if (!doc.page.widgetGrid || doc.bodyFlow) return;
  const bands: FlowBand[] = []; let end = 0; let start = 0;
  for (const rect of resolveLegacyWidgets(doc, metrics)) {
    const last = bands.at(-1);
    if (last && rect.row < end && rect.block.type !== 'break' && !last.members.some(m => doc.blocks.find(b => b.id === m.id)?.type === 'break')) {
      last.members.push({id:rect.block.id, offset:rect.row-start}); end = Math.max(end, rect.row+rect.rows);
    } else {
      bands.push({gapBefore:Math.max(0,rect.row-end),members:[{id:rect.block.id,offset:0}]}); start=rect.row; end=rect.row+rect.rows;
    }
  }
  doc.bodyFlow = {version:1,bands};
}

export function resolveWidgets(doc: StudioDoc, metrics: Record<string, Metrics>, priorityId?: string): WidgetRect[] {
  if (!doc.bodyFlow || !doc.page.widgetGrid) return resolveLegacyWidgets(doc,metrics,priorityId);
  const result: WidgetRect[] = []; let cursor=0;
  for (const band of doc.bodyFlow.bands) {
    cursor += band.gapBefore;
    const members=band.members.map(m => {const b=doc.blocks.find(b=>b.id===m.id);return b?{...b,row:m.offset}:null;}).filter((b):b is Block=>!!b);
    // Array order resolves equal-position conflicts; only the edited member gets priority.
    const placed=resolveLegacyWidgets({...doc,bodyFlow:undefined,blocks:members},metrics,priorityId,true);
    // A band initially has connected vertical occupancy. Close only fully empty internal
    // rows after deletion/shrink; never fill a vacant column beside a remaining rectangle.
    // Explicit inter-band spacing and spacer widgets remain outside this compaction.
    const holes:{start:number;end:number}[]=[];let end=placed[0]?.row??0;
    for(const r of placed){if(r.row>end)holes.push({start:end,end:r.row});end=Math.max(end,r.row+r.rows);}
    const compacted=placed.map(r=>({...r,row:r.row-holes.filter(h=>h.end<=r.row).reduce((n,h)=>n+h.end-h.start,0)}));
    for (const r of compacted) result.push({...r,row:r.row+cursor,block:{...r.block,row:r.row+cursor}});
    cursor += Math.max(0,...compacted.map(r=>r.row+r.rows));
  }
  return result;
}

function flowPositions(doc:StudioDoc,metrics:Record<string,Metrics>) {
  const rects=resolveWidgets(doc,metrics);let cursor=0;
  return doc.bodyFlow!.bands.map(band=>{
    const start=cursor+band.gapBefore;
    const end=Math.max(start,...band.members.map(m=>{const r=rects.find(r=>r.block.id===m.id);return r?r.row+r.rows:start;}));
    cursor=end;return {band,start,end};
  });
}
/** Remove the occupied band, retaining any explicitly stored gap for the following band. */
export function removeFlowMember(doc:StudioDoc,id:string) {
  if(!doc.bodyFlow)return;
  const bands=doc.bodyFlow.bands;
  for(let i=0;i<bands.length;i++) {
    const band=bands[i];if(!band.members.some(m=>m.id===id))continue;
    band.members=band.members.filter(m=>m.id!==id);
    if(!band.members.length){if(bands[i+1])bands[i+1].gapBefore+=band.gapBefore;bands.splice(i,1);}
    else {const first=Math.min(...band.members.map(m=>m.offset));band.members.forEach(m=>m.offset-=first);}
    return;
  }
}

export interface FlowInsertion { row:number; anchorId?:string; side?:'before'|'after'|'top'|'end' }
/** Coordinates are interpreted against the pre-operation layout, then stored as flow relationships. */
export function placeFlowMember(doc:StudioDoc,id:string,where:FlowInsertion,metrics:Record<string,Metrics>) {
  ensureBodyFlow(doc,metrics);if(!doc.bodyFlow)return;
  const positions=flowPositions(doc,metrics),bands=doc.bodyFlow.bands;
  const oldBand=bands.find(b=>b.members.some(m=>m.id===id));
  const anchor=where.anchorId?bands.find(b=>b.members.some(m=>m.id===where.anchorId)):undefined;
  const target=positions.find(p=>where.row>=p.start && where.row<p.end && !p.band.members.some(m=>doc.blocks.find(b=>b.id===m.id)?.type==='break'));
  const next=positions.find(p=>p.start>where.row);
  const end=positions.at(-1)?.end??0;
  // Removing the source never promotes its calculated height into a new explicit gap.
  removeFlowMember(doc,id);
  const member={id,offset:0};
  if(where.side==='top'){const gap=bands[0]?.gapBefore??0;if(bands[0])bands[0].gapBefore=0;bands.unshift({gapBefore:gap,members:[member]});}
  else if(where.side==='end'){bands.push({gapBefore:0,members:[member]});}
  else if(anchor && bands.includes(anchor)) {
    const index=bands.indexOf(anchor)+(where.side==='after'?1:0);
    const gap=where.side==='before'?anchor.gapBefore:0;if(where.side==='before')anchor.gapBefore=0;
    bands.splice(index,0,{gapBefore:gap,members:[member]});
  } else if(target && doc.blocks.find(b=>b.id===id)?.type==='break') {
    const index=bands.includes(target.band)?bands.indexOf(target.band):Math.min(positions.indexOf(target),bands.length);
    const gap=target.band.gapBefore;if(bands.includes(target.band))target.band.gapBefore=0;
    bands.splice(index,0,{gapBefore:gap,members:[member]});
  } else if(target && (bands.includes(target.band) || target.band===oldBand)) {
    member.offset=Math.max(0,where.row-target.start);
    if(!bands.includes(target.band)){
      const index=Math.min(positions.indexOf(target),bands.length);
      // removeFlowMember transferred this intentional gap; reinstate it exactly once.
      if(bands[index])bands[index].gapBefore=Math.max(0,bands[index].gapBefore-target.band.gapBefore);
      target.band.members=[];bands.splice(index,0,target.band);
    }
    target.band.members.unshift(member);
  } else if(next && bands.includes(next.band)) {
    const previousEnd=positions[positions.indexOf(next)-1]?.end??0;
    const gap=Math.max(0,where.row-previousEnd);
    next.band.gapBefore=Math.max(0,next.start-where.row);
    bands.splice(bands.indexOf(next.band),0,{gapBefore:gap,members:[member]});
  } else bands.push({gapBefore:Math.max(0,where.row-end),members:[member]});
}

/** row is only a compatibility/display projection; bodyFlow is the placement authority. */
export function projectFlowRows(doc:StudioDoc,metrics:Record<string,Metrics>) {
  if(!doc.bodyFlow || !doc.page.widgetGrid)return doc;
  const positions=new Map(resolveWidgets(doc,metrics).map(r=>[r.block.id,r.block]));
  doc.blocks=doc.blocks.map(b=>positions.get(b.id)??b);return doc;
}

interface Band { start: number; end: number; rects: WidgetRect[] }
/** CSS-grid bands preserve body flow, while staggered widgets fill empty cells in each band. */
export function paginateWidgets(doc: StudioDoc, metrics: Record<string, Metrics>, capacity: (first: boolean)=>number): LayoutPage[] {
  const pitch=gridPitch(doc); const gap=GRID_GAP;
  const bands: Band[]=[];
  for(const r of resolveWidgets(doc,metrics)) {
    const last=bands[bands.length-1];
    if(last && r.row<last.end && !last.rects.some(x=>x.block.type==='break') && r.block.type!=='break') { last.rects.push(r);last.end=Math.max(last.end,r.row+r.rows); }
    else bands.push({start:r.row,end:r.row+r.rows,rects:[r]});
  }
  const pages: LayoutPage[]=[{rows:[],used:0,capacity:capacity(true),gridStartRow:0}];let page=pages[0];let key=0;let logical=0;
  const next=(origin:number,manualBreakId?:string)=>{page={rows:[],used:0,capacity:capacity(false),gridStartRow:origin,manualBreakId};pages.push(page);};
  const room=()=>page.capacity-page.used-(page.rows.length?gap:0);
  const aligned=(h:number)=>Math.max(0,Math.floor((h+gap+.1)/pitch)*pitch-gap);
  const rowsFor=(h:number)=>Math.max(1,Math.ceil((h+gap-.1)/pitch));
  const append=(fragments:Fragment[],height:number,start:number)=>{if(page.rows.length)page.used+=gap;page.rows.push({key:`widget-${key++}`,fragments,height,gridSlots:rowsFor(height),logicalStart:start});page.used+=height;};
  for(let index=0;index<bands.length;index++) {
    const band=bands[index];
    let blanks=band.start-logical;
    while(blanks>0) { const available=Math.floor((room()+gap+.1)/pitch);if(available<1){next(logical);continue;}const count=Math.min(blanks,available);append([],count*pitch-gap,logical);blanks-=count;logical+=count; }
    if(band.rects[0].block.type==='break'){logical=band.end;next(logical,band.rects[0].block.id);continue;}
    const height=(band.end-band.start)*pitch-gap;
    const following=bands[index+1]; const keep=band.rects.some(r=>r.block.keepWithNext) && following && following.rects[0].block.type!=='break' ? Math.min((following.end-following.start)*pitch,2*pitch) : 0;
    if(page.rows.length && ((height>room() && height<=capacity(false)) || (keep && height+keep>room() && height+keep<=capacity(false)))) next(band.start);
    if(height<=room()+.1) { append(band.rects.map(r=>({block:r.block,height:r.height,gridOffset:r.row-band.start,gridRows:r.rows,last:true})),height,band.start);logical=band.end;continue; }
    const states=band.rects.map(rect=>({rect,metric:metrics[rect.block.id]??{height:rect.height},cursor:0,done:false}));let logicalOffset=0;
    while(states.some(s=>!s.done)) {
      let available=aligned(room());
      const needed=Math.max(...states.filter(s=>!s.done).map(s=>{
        const offset=s.cursor===0?(s.rect.row-band.start)*pitch:0;
        if(s.rect.block.type==='table' && s.metric.rows) return offset+(s.metric.head??32)+s.metric.rows.slice(s.cursor,tableGroupEnd(s.rect.block.table!,s.cursor)).reduce((a,b)=>a+b,0)+(tableGroupEnd(s.rect.block.table!,s.cursor)===s.metric.rows.length?(s.metric.total??0):0);
        if(s.metric.lines?.length) return offset+14+s.metric.lines[s.cursor].height;
        return offset+s.rect.height;
      }));
      if((available<30 || needed>available) && page.rows.length){next(band.start+logicalOffset);available=aligned(room());}
      const fragments:Fragment[]=[];
      for(const state of states) {
        if(state.done)continue;
        const {rect,metric}=state;const b=rect.block;const first=state.cursor===0;
        let offset=first?(rect.row-band.start)*pitch:0;
        // A tall atomic widget is scaled once; the loop always advances data cursors.
        offset=Math.min(offset,Math.max(0,rowsFor(available)-1)*pitch);let fragment:Fragment;
        if(b.type==='table' && b.table && metric.rows) {
          const from=state.cursor;let height=offset+(metric.head??32);let oversized=false;
          while(state.cursor<metric.rows.length) {const end=tableGroupEnd(b.table,state.cursor);const rowHeight=metric.rows.slice(state.cursor,end).reduce((a,b)=>a+b,0);const total=end===metric.rows.length?(metric.total??0):0;if(height+rowHeight+total>available && state.cursor>from)break;if(height+rowHeight+total>available)oversized=true;height+=rowHeight;state.cursor=end;if(oversized)break;}
          state.done=state.cursor>=metric.rows.length;if(state.done)height+=metric.total??0;
          fragment={block:b,from,to:state.cursor,last:state.done,continued:from>0,oversized,height:Math.min(available-offset,rowsFor(height)*pitch-gap-offset)};
        } else if((b.type==='text'||b.type==='emoji') && metric.lines?.length) {
          const from=state.cursor;let height=offset+14;
          while(state.cursor<metric.lines.length && (height+metric.lines[state.cursor].height<=available || state.cursor===from)){height+=metric.lines[state.cursor].height;state.cursor++;}
          state.done=state.cursor>=metric.lines.length;
          fragment={block:b,text:metric.lines.slice(from,state.cursor).map(l=>l.text).join(''),textOffset:metric.lines.slice(0,from).reduce((n,l)=>n+l.text.length,0),last:state.done,continued:from>0,height:Math.min(available-offset,rowsFor(height)*pitch-gap-offset),oversized:height>available};
        } else {state.done=true;fragment={block:b,last:true,height:Math.min(rect.height,available-offset),oversized:rect.height>available-offset};}
        fragment.gridOffset=Math.round(offset/pitch);fragment.gridRows=rowsFor(fragment.height);fragments.push(fragment);
      }
      const height=Math.max(...fragments.map(f=>(f.gridOffset??0)*pitch+f.height));append(fragments,height,band.start+logicalOffset);logicalOffset+=rowsFor(height);
      if(states.some(s=>!s.done))next(band.start+logicalOffset);
    }
    logical=band.end;
  }
  return pages;
}

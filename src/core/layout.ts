import { MM } from './model';
import type { Block, StudioDoc } from './model';
import { paginateWidgets } from './widgets';
export const ROW_GAP = 12;
export interface Metrics { height: number; signatureChrome?: number; head?: number; rows?: number[]; total?: number; lines?: { text: string; height: number }[] }
export interface Fragment { block: Block; from?: number; to?: number; text?: string; textOffset?: number; continued?: boolean; last?: boolean; oversized?: boolean; height: number; gridOffset?: number; gridRows?: number }
export interface LayoutRow { key: string; fragments: Fragment[]; height: number; gridSlots?: number; logicalStart?: number }
export interface LayoutPage { manualBreakId?: string; rows: LayoutRow[]; capacity: number; used: number; gridStartRow?: number }
export function pageCapacity(doc: StudioDoc, first: boolean) {
  const p = doc.page; const header = first && p.header.first === 'hide' ? 0 : p.header.height; const footer = first && p.footer.first === 'hide' ? 0 : p.footer.height;
  return (297 - p.margins.top - p.margins.bottom - header - footer) * MM;
}
/** Pure pagination: source tables stay intact; fragments are views over row indices. */
export function paginate(doc: StudioDoc, measured: Record<string, Metrics>): LayoutPage[] {
  if(doc.page.widgetGrid) return paginateWidgets(doc,measured,first=>pageCapacity(doc,first));
  const pages: LayoutPage[] = [{ rows: [], used: 0, capacity: pageCapacity(doc, true) }];
  let page = pages[0]; let sequence = 0;
  const next = (manualBreakId?:string) => { page = { rows: [], used: 0, capacity: pageCapacity(doc, false),manualBreakId }; pages.push(page); };
  const room = () => page.capacity - page.used - (page.rows.length ? ROW_GAP : 0);
  const append = (fragments: Fragment[], height: number) => { if (page.rows.length) page.used += ROW_GAP; page.rows.push({ key: `row-${sequence++}`, fragments, height }); page.used += height; };
  const groups = new Map<number, Block[]>();
  for (const b of [...doc.blocks].sort((a, b) => a.row - b.row || a.col - b.col)) { const g = groups.get(b.row) ?? []; g.push(b); groups.set(b.row, g); }
  const all = [...groups.values()];
  for (let gi = 0; gi < all.length; gi++) {
    const group = all[gi];
    if (group.some(b => b.type === 'break')) { next(group.find(b=>b.type==='break')!.id); continue; }
    const heights = group.map(b => measured[b.id]?.height ?? 50); const height = Math.max(...heights);
    const nextGroupHeight = all[gi + 1] && !all[gi + 1].some(b => b.type === 'break') ? Math.max(...all[gi + 1].map(b => measured[b.id]?.height ?? 50)) : 0;
    const keepHeight = height + (group.some(b => b.keepWithNext) && nextGroupHeight ? ROW_GAP + Math.min(nextGroupHeight, 80) : 0);
    const canSplit = group.some(b => b.type === 'table' || b.type === 'text' || b.type === 'emoji');
    if (page.rows.length && ((!canSplit && height > room()) || (group.some(b => b.keepWithNext) && keepHeight > room() && keepHeight <= pageCapacity(doc, false)))) next();
    if (height <= room()) { append(group.map((b, i) => ({ block: b, height: heights[i], last: true })), height); continue; }
    // Oversized rows split all flowing members together; atomic blocks are scaled inside their fragment.
    const states = group.map(b => ({ b, cursor: 0, done: false, metric: measured[b.id] ?? { height: 50 } }));
    while (states.some(s => !s.done)) {
      let available = room(); const fragments: Fragment[] = [];
      const minimum = Math.max(...states.filter(s => !s.done).map(s => s.b.type === 'table' && s.metric.rows ? (s.metric.head ?? 32) + (s.metric.rows[s.cursor] ?? 0) + (s.cursor === s.metric.rows.length - 1 ? s.metric.total ?? 0 : 0) : s.metric.lines?.length ? 16 + s.metric.lines[s.cursor].height : s.metric.height));
      if ((available < 40 || minimum > available) && page.rows.length) { next(); available = room(); }
      for (const s of states) {
        if (s.done) continue;
        if (s.b.type === 'table' && s.metric.rows && s.b.table) {
          const head = s.metric.head ?? 32; const rows = s.metric.rows; const from = s.cursor; let h = head; let oversized = false;
          while (s.cursor < rows.length) { const rh = rows[s.cursor]; const total = s.cursor === rows.length - 1 ? s.metric.total ?? 0 : 0; if (h + rh + total > available && s.cursor > from) break; if (h + rh + total > available) oversized = true; h += rh; s.cursor++; if (oversized) break; }
          s.done = s.cursor >= rows.length;
          if (s.done) h += s.metric.total ?? 0;
          fragments.push({ block: s.b, from, to: s.cursor, continued: from > 0, last: s.done, height: Math.min(h, available), oversized });
        } else if ((s.b.type === 'text' || s.b.type === 'emoji') && s.metric.lines?.length) {
          const from = s.cursor; let h = 16;
          while (s.cursor < s.metric.lines.length && (h + s.metric.lines[s.cursor].height <= available || s.cursor === from)) { h += s.metric.lines[s.cursor].height; s.cursor++; }
          s.done = s.cursor >= s.metric.lines.length;
          fragments.push({ block: s.b, text: s.metric.lines.slice(from, s.cursor).map(l => l.text).join(''), textOffset: s.metric.lines.slice(0, from).reduce((n,l) => n + l.text.length, 0), height: Math.min(h, available), continued: from > 0, last: s.done });
        } else { s.done = true; fragments.push({ block: s.b, height: available, oversized: true, last: true }); }
      }
      append(fragments, Math.max(1, ...fragments.map(f => f.height)));
      if (states.some(s => !s.done)) next();
    }
  }
  return pages;
}

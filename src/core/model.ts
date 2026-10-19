export const VERSION = 1 as const;
export const MM = 96 / 25.4;
export type Mode = 'template' | 'document';
export type Kind = '견적서' | 'POD' | 'Agreement';
export type BlockType = 'text' | 'table' | 'image' | 'field' | 'checkbox' | 'emoji' | 'shape' | 'divider' | 'signature' | 'break' | 'spacer';
export interface Style { font: string; size: number; bold: boolean; italic: boolean; underline: boolean; color: string; align: 'left' | 'center' | 'right' | 'justify'; background: string; highlight?: string; lineHeight?: number }
export type InlineStyle = Partial<Omit<Style, 'background'>>;
export interface RichRun { text: string; style?: InlineStyle }
export interface FontAsset { id: string; family: string; name: string; data: string }
export interface CellStyle extends Partial<Style> { vertical?: 'top'|'middle'|'bottom'; padding?: number; borders?: Partial<Record<'top'|'right'|'bottom'|'left', { color: string; width: number; type: 'solid'|'dashed'|'dotted'|'none'; revision?: number }>> }
export interface Field { id: string; name: string; type: 'text' | 'number' | 'date' | 'checkbox'; defaultValue: string; required: boolean; labelWidth?: number }
export interface Asset { id: string; name: string; data: string; width: number; height: number; category: 'image' | 'stamp' | 'signature' }
export interface Placement { id: string; asset: Asset; x: number; y: number; width: number; locked: boolean }
export interface Column { id: string; name: string; width: number; role: 'text' | 'quantity' | 'price' | 'amount' }
export interface TableData { columns: Column[]; rows: Record<string, string>[]; total: boolean; totalLabel?: string; repeatable: boolean; cellStyles?: Record<string, CellStyle>; richCells?: Record<string, RichRun[]> }
export interface Block { id: string; type: BlockType; row: number; col: number; span: number; rowSpan?: number; style: Style; text: string; caption?: string; direction?: 'horizontal'|'vertical'; lineStyle?: 'solid'|'dashed'|'dotted'; signatureLine?: {style:'none'|'solid'|'dashed'|'dotted';width:number;color:string}; signatureHeight?: number; signatureTitlePosition?: 'above'|'below'; rich?: RichRun[]; freeX?: number; freeY?: number; crop?: { fit: 'contain'|'cover'; x: number; y: number }; keepWithNext: boolean; height: number; field?: Field; table?: TableData; asset?: Asset; images?: Placement[]; lineWidth: number; spacing: number; contain: boolean }
export interface Decoration { id: string; type: 'text' | 'image' | 'shape'; text: string; asset?: Asset; x: number; y: number; width: number; height: number; color: string; size: number }
export interface Region { height: number; items: Decoration[]; firstItems: Decoration[]; first: 'same' | 'hide' | 'different' }
export interface PageSettings { columns: number; widgetGrid?: boolean; gridRowMm?: number; margins: { top: number; right: number; bottom: number; left: number }; header: Region; footer: Region; watermark: { asset?: Asset; enabled: boolean; transparency: number; width: number; x: number; y: number; scope: 'all' | 'pages'; pages: string } }
/** Semantic body order. Offsets/gaps are deliberate grid spacing, never measured push-down. */
export interface FlowBand { gapBefore: number; members: { id: string; offset: number }[] }
export interface StudioDoc { version: 1; id: string; name: string; kind: Kind; blocks: Block[]; page: PageSettings; bodyFlow?: { version: 1; bands: FlowBand[] }; values: Record<string, string>; fonts?: FontAsset[]; sourceTemplateId?: string; updatedAt: string }
export interface Library { version: 1; templates: StudioDoc[]; documents: StudioDoc[]; assets: Asset[]; draft: { doc: StudioDoc; mode: Mode } }
export const uid = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Opaque local preview origins can lack randomUUID; getRandomValues remains available.
  const bytes = crypto.getRandomValues(new Uint8Array(16)); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(b => b.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};
export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
export const clone = <T,>(value: T): T => structuredClone(value);
export const defaultStyle = (): Style => ({ font: 'Pretendard', size: 11, bold: false, italic: false, underline: false, color: '#172d45', align: 'left', background: 'transparent' });
export function makeBlock(type: BlockType, row: number): Block {
  const b: Block = { id: uid(), type, row, col: 0, span: 12, rowSpan: type === 'signature' ? 4 : type === 'image' || type === 'shape' ? 3 : 1, style: defaultStyle(), text: type === 'emoji' ? '☺' : type === 'text' ? '텍스트를 입력하세요' : '', keepWithNext: false, height: type === 'signature' ? 40 : 28, lineWidth: 1, spacing: 3, contain: true };
  if (type === 'field' || type === 'checkbox') b.field = { id: uid(), name: type === 'checkbox' ? '확인 사항' : '입력 항목', type: type === 'checkbox' ? 'checkbox' : 'text', defaultValue: '', required: false };
  if (type === 'table') {
    const columns: Column[] = [{ id: uid(), name: '항목', width: 42, role: 'text' }, { id: uid(), name: '수량', width: 14, role: 'quantity' }, { id: uid(), name: '단가', width: 22, role: 'price' }, { id: uid(), name: '금액', width: 22, role: 'amount' }];
    b.table = { columns, rows: Array.from({ length: 3 }, () => Object.fromEntries(columns.map(c => [c.id, '']))), total: true, repeatable: true };
  }
  if (type === 'signature') { b.text = '확인 및 서명'; b.images = []; }
  if (type === 'emoji') b.style.size = 24;
  return b;
}
export function newDoc(kind: Kind = '견적서', blank = false): StudioDoc {
  const d: StudioDoc = { version: VERSION, id: uid(), name: `${kind} ${blank ? '새 양식' : '기본 양식'}`, kind, blocks: [], values: {}, updatedAt: new Date().toISOString(), page: { columns: 12, margins: { top: 12, right: 14, bottom: 12, left: 14 }, header: { height: 16, first: 'same', items: [{ id: uid(), type: 'text', text: '문서 스튜디오  /  업무 문서', x: 0, y: 3, width: 110, height: 8, color: '#46627b', size: 9 }], firstItems: [] }, footer: { height: 12, first: 'same', items: [{ id: uid(), type: 'text', text: '문서 스튜디오', x: 0, y: 3, width: 100, height: 7, color: '#718096', size: 8 }, { id: uid(), type: 'text', text: '{page} / {pages}', x: 145, y: 3, width: 32, height: 7, color: '#718096', size: 8 }], firstItems: [] }, watermark: { enabled: false, transparency: 85, width: 135, x: 50, y: 50, scope: 'all', pages: '' } } };
  d.page.widgetGrid = true; d.page.gridRowMm = 12;
  if (blank) return d;
  const title = makeBlock('text', 0); title.rowSpan = 2; title.text = kind; title.style = { ...title.style, size: 29, bold: true, align: 'center' }; title.keepWithNext = true;
  const subtitle = makeBlock('text', 1); subtitle.text = kind === '견적서' ? 'Q U O T A T I O N' : kind === 'POD' ? 'PROOF OF DELIVERY' : 'A G R E E M E N T'; subtitle.style = { ...subtitle.style, size: 9, align: 'center', color: '#628295' };
  const f1 = makeBlock('field', 2); f1.span = 6; f1.field!.name = kind === 'POD' ? '수령인' : '고객명'; f1.field!.required = true;
  const f2 = makeBlock('field', 2); f2.col = 6; f2.span = 6; f2.field!.name = '작성일'; f2.field!.type = 'date'; f2.field!.defaultValue = today();
  const table = makeBlock('table', 3);
  if (kind === '견적서') { const cs = table.table!.columns; table.table!.rows = ['상품 또는 서비스', '추가 작업', '운송 및 처리'].map((name, i) => ({ [cs[0].id]: name, [cs[1].id]: '1', [cs[2].id]: String((i + 1) * 100000), [cs[3].id]: '' })); }
  if (kind === 'POD') { table.table!.columns[0].name = '화물 / 물품'; table.table!.columns[2].name = '상태'; table.table!.columns[2].role = 'text'; table.table!.columns[3].name = '비고'; table.table!.columns[3].role = 'text'; table.table!.total = false; }
  const heading = makeBlock('text', 4); heading.text = kind === '견적서' ? '거래 조건' : kind === 'POD' ? '인도 확인 사항' : '합의 내용'; heading.style.bold = true; heading.keepWithNext = true;
  const terms = makeBlock('text', 5); terms.text = '이곳에 문서에 필요한 조건과 안내 사항을 작성하세요.\n양식을 저장한 뒤 문서 작성에서 입력 항목을 채울 수 있습니다.'; terms.style.color = '#52687c';
  const sign = makeBlock('signature', 6);
  d.blocks = [title, subtitle, f1, f2, table, heading, terms, sign]; return d;
}
export function fieldValue(d: StudioDoc, f: Field) { return d.values[f.id] ?? f.defaultValue; }
export function numeric(value: string) { return Number(value.replace(/,/g, '').trim()); }
export function cellValue(t: TableData, row: Record<string, string>, column: Column) { if (column.role !== 'amount') return row[column.id] ?? ''; const qty = t.columns.find(c => c.role === 'quantity'); const price = t.columns.find(c => c.role === 'price'); return String(numeric(qty ? row[qty.id] || '0' : '0') * numeric(price ? row[price.id] || '0' : '0')); }
export function tableTotal(t: TableData) { const amount = t.columns.find(c => c.role === 'amount'); return amount ? t.rows.reduce((sum, r) => sum + Number(cellValue(t, r, amount)), 0) : 0; }
export function templateCopy(doc: StudioDoc) { const next = clone(doc); next.values = {}; delete next.sourceTemplateId; for (const b of next.blocks) if (b.type === 'signature') b.images = []; return next; }
export function documentCopy(doc: StudioDoc) { const next = clone(doc); next.sourceTemplateId = doc.id; next.id = uid(); next.name = `${doc.name} · 문서`; return next; }
export function normalizeGrid(blocks: Block[], columns: number) {
  const result = clone(blocks).sort((a, b) => a.row - b.row || a.col - b.col);
  const occupied = new Map<number, number[]>();
  for (const b of result) { b.span = Math.min(columns, Math.max(1, Math.round(b.span))); b.col = Math.max(0, Math.min(columns - b.span, Math.round(b.col))); b.row = Math.max(0, Math.round(b.row)); const mask = () => occupied.get(b.row) ?? []; while (mask().some(c => c >= b.col && c < b.col + b.span) || (b.type === 'break' && mask().length > 0)) b.row++; const slots = mask(); for (let c = b.col; c < b.col + b.span; c++) slots.push(c); occupied.set(b.row, slots); }
  return result;
}

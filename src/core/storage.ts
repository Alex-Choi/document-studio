import { newDoc, VERSION, uid } from './model';
import {desktop} from './desktop';
import type { Library, Asset, StudioDoc, RichRun, InlineStyle, CellStyle } from './model';
const KEY = 'document-studio.v1';
export function initialLibrary(): Library { return { version: VERSION, templates: [], documents: [], assets: [], draft: { doc: newDoc(), mode: 'template' } }; }
const finite = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const str = (v: unknown) => typeof v === 'string';
export function validateAsset(a: Asset) { return a && str(a.id) && str(a.name) && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(a.data) && finite(a.width, 1, 30000) && finite(a.height, 1, 30000) && ['image', 'stamp', 'signature'].includes(a.category); }
const color=(v:unknown)=>typeof v==='string' && v.length<100 && /^(#[\da-f]{3,8}|[a-z]+|(?:rgb|hsl)a?\([\d.,% +\-]+\))$/i.test(v);
const validInline=(s:InlineStyle)=>s && typeof s==='object' && Object.entries(s).every(([k,v])=>k==='font'?str(v)&&String(v).length<150:k==='size'?finite(v,6,72):['bold','italic','underline'].includes(k)?typeof v==='boolean':k==='align'?['left','center','right','justify'].includes(String(v)):k==='lineHeight'?finite(v,1,3):['color','highlight'].includes(k)?color(v):false);
const validRuns=(runs:RichRun[])=>Array.isArray(runs)&&runs.length<=100000&&runs.every(r=>r&&str(r.text)&&(!r.style||validInline(r.style)));
const validCell=(s:CellStyle)=>{const {vertical,padding,borders,background,...inline}=s;if(!validInline(inline))return false;if(vertical!==undefined&&!['top','middle','bottom'].includes(vertical))return false;if(padding!==undefined&&!finite(padding,0,30))return false;if(background!==undefined&&!color(background))return false;return !borders||Object.entries(borders).every(([side,b])=>['top','right','bottom','left'].includes(side)&&b&&color(b.color)&&finite(b.width,0,8)&&['solid','dashed','dotted','none'].includes(b.type)&&(b.revision===undefined||finite(b.revision,0,1e15)));};
export function validateDoc(d: StudioDoc): boolean {
  if (!d || d.version !== VERSION || !str(d.id) || !str(d.name) || !['견적서', 'POD', 'Agreement'].includes(d.kind) || !Array.isArray(d.blocks) || d.blocks.length > 2000 || !d.values || typeof d.values !== 'object' || Array.isArray(d.values) || !Object.values(d.values).every(str)) return false;
  if(d.fonts!==undefined&&(!Array.isArray(d.fonts)||d.fonts.length>20||!d.fonts.every(f=>f&&str(f.id)&&str(f.name)&&/^StudioFont_[a-f0-9]+$/i.test(f.family)&&/^data:font\/(ttf|otf|woff2?);base64,[A-Za-z0-9+/=]+$/.test(f.data)&&f.data.length<3*1024*1024)))return false;
  const p = d.page;
  if (p?.widgetGrid !== undefined && typeof p.widgetGrid !== 'boolean') return false;
  if (p?.gridRowMm !== undefined && !finite(p.gridRowMm,8,24)) return false;
  if (!p || !finite(p.columns, 1, 24) || !Number.isInteger(p.columns) || !p.margins || !['top','right','bottom','left'].every(k => finite(p.margins[k as keyof typeof p.margins], 0, 50)) || Object.keys(p.margins).length !== 4) return false;
  for (const r of [p.header, p.footer]) {
    if (!r || !finite(r.height, 0, 65) || !['same', 'hide', 'different'].includes(r.first) || !Array.isArray(r.items) || !Array.isArray(r.firstItems)) return false;
    for (const x of [...r.items, ...r.firstItems]) if (!x || !str(x.id) || !['text', 'image', 'shape'].includes(x.type) || !str(x.text) || !str(x.color) || !finite(x.size, 6, 72) || !finite(x.x, 0, 210) || !finite(x.y, 0, 65) || !finite(x.width, 1, 210) || !finite(x.height, 1, 65) || (x.asset && !validateAsset(x.asset))) return false;
  }
  const w = p.watermark;
  if (!w || typeof w.enabled !== 'boolean' || !finite(w.transparency, 0, 100) || !finite(w.width, 10, 250) || !finite(w.x, 0, 100) || !finite(w.y, 0, 100) || !['all', 'pages'].includes(w.scope) || !str(w.pages) || (w.asset && !validateAsset(w.asset))) return false;
  const ids = new Set<string>(); const fields = new Set<string>();
  for (const b of d.blocks) {
    if(b?.style?.vertical!==undefined&&!['top','middle','bottom'].includes(b.style.vertical))return false;
    if (!b || !str(b.id) || ids.has(b.id) || !['text','table','image','field','checkbox','emoji','shape','divider','signature','break','spacer'].includes(b.type) || !finite(b.row, 0, 100000) || !Number.isInteger(b.row) || !finite(b.col, 0, p.columns - 1) || !Number.isInteger(b.col) || !finite(b.span, 1, p.columns - b.col) || !Number.isInteger(b.span) || !str(b.text) || !finite(b.height, 5, 250) || !finite(b.lineWidth, 0.25, 8) || !finite(b.spacing, 0, 20) || !b.style || !str(b.style.font) || !str(b.style.color) || !str(b.style.background) || !finite(b.style.size, 6, 72) || !['left','center','right','justify'].includes(b.style.align)) return false;
    if(b.lineStyle!==undefined&&!['solid','dashed','dotted'].includes(b.lineStyle))return false;
    if(b.signatureLine!==undefined&&(!b.signatureLine||!['none','solid','dashed','dotted'].includes(b.signatureLine.style)||!finite(b.signatureLine.width,.25,8)||!color(b.signatureLine.color)))return false;
    if(b.signatureHeight!==undefined&&!finite(b.signatureHeight,10,200))return false;
    if(b.signatureTitlePosition!==undefined&&!['above','below'].includes(b.signatureTitlePosition))return false;
    if(b.caption!==undefined&&!str(b.caption))return false;
    if(b.direction!==undefined&&!['horizontal','vertical'].includes(b.direction))return false;
    if(b.table?.totalLabel!==undefined&&!str(b.table.totalLabel))return false;
    if(b.rich!==undefined&&(!validRuns(b.rich)||b.rich.map(r=>r.text).join('')!==b.text))return false;
    if(b.style.lineHeight!==undefined&&!finite(b.style.lineHeight,1,3))return false;
    if(b.freeX!==undefined&&!finite(b.freeX,0,1))return false;if(b.freeY!==undefined&&!finite(b.freeY,0,1))return false;
    if(b.crop&&(!['contain','cover'].includes(b.crop.fit)||!finite(b.crop.x,0,100)||!finite(b.crop.y,0,100)))return false;
    if(b.table?.cellStyles&&(!Object.values(b.table.cellStyles).every(validCell)))return false;
    if(b.table?.richCells&&(!Object.values(b.table.richCells).every(validRuns)))return false;
    ids.add(b.id);
    if(b.rowSpan!==undefined && (!finite(b.rowSpan,1,64) || !Number.isInteger(b.rowSpan))) return false;
    if(b.heightMode!==undefined && !['auto','minimum'].includes(b.heightMode)) return false;
    if (b.type === 'field' || b.type === 'checkbox') { const f = b.field; if (!f || !str(f.id) || fields.has(f.id) || !str(f.name) || !str(f.defaultValue) || !['text','number','date','checkbox'].includes(f.type) || typeof f.required !== 'boolean' || (f.labelWidth!==undefined&&!finite(f.labelWidth,0,80))) return false; fields.add(f.id); }
    if (b.type === 'table') { const t = b.table; if (!t || !Array.isArray(t.columns) || !t.columns.length || t.columns.length > 16 || !Array.isArray(t.rows) || !t.rows.length || t.rows.length > 5000 || !t.columns.every(c => str(c.id) && str(c.name) && finite(c.width, 0.01, 100) && ['text','quantity','price','amount'].includes(c.role)) || new Set(t.columns.map(c => c.id)).size !== t.columns.length || !t.rows.every(r => r && typeof r === 'object' && !Array.isArray(r) && Object.values(r).every(str))) return false; }
    if (b.asset && !validateAsset(b.asset)) return false;
    if (b.type === 'signature' && (!Array.isArray(b.images) || !b.images.every(i => i && str(i.id) && validateAsset(i.asset) && finite(i.x, 0, 100) && finite(i.y, 0, 100) && finite(i.width, 0.000001, 100) && typeof i.locked === 'boolean'))) return false;
  }
  if(d.bodyFlow!==undefined) {
    const flow=d.bodyFlow;
    if(!flow || flow.version!==1 || !Array.isArray(flow.bands) || flow.bands.length>2000)return false;
    const members=new Set<string>();
    for(const band of flow.bands) {
      if(!band || !finite(band.gapBefore,0,100000) || !Number.isInteger(band.gapBefore) || !Array.isArray(band.members) || !band.members.length || band.members.length>2000)return false;
      for(const m of band.members){if(!m || !ids.has(m.id) || members.has(m.id) || !finite(m.offset,0,100000) || !Number.isInteger(m.offset))return false;members.add(m.id);}
      if(band.members.some(m=>d.blocks.find(b=>b.id===m.id)?.type==='break') && band.members.length!==1)return false;
    }
    if(members.size!==ids.size)return false;
  }

  return true;
}
export function validateLibrary(v: Library): boolean { return v && v.version === VERSION && Array.isArray(v.templates) && v.templates.every(validateDoc) && Array.isArray(v.documents) && v.documents.every(validateDoc) && Array.isArray(v.assets) && v.assets.every(validateAsset) && v.draft && validateDoc(v.draft.doc) && ['template', 'document'].includes(v.draft.mode); }
export function checkBrowserStorage(): { storageAvailable: boolean; storageReason: string } {
  if(desktop){try{desktop.checkStorage();return {storageAvailable:true,storageReason:''};}catch(error){return {storageAvailable:false,storageReason:`PC 자동 저장소를 사용할 수 없습니다. JSON으로 내보내세요. ${error instanceof Error?error.message:''}`};}}
  const probe = `${KEY}.probe.${uid()}`;
  try { localStorage.setItem(probe,'1'); if (localStorage.getItem(probe) !== '1') throw new Error('저장값 확인 실패'); localStorage.removeItem(probe); return { storageAvailable: true, storageReason: '' }; }
  catch { return { storageAvailable: false, storageReason: '브라우저 자동 저장을 사용할 수 없습니다. 현재 편집은 계속할 수 있으며, 닫기 전에 이미지 포함 JSON 파일을 내보내세요.' }; }
}
export function readLibrary(): { library: Library; error?: string; storageAvailable: boolean; storageReason: string } {
  let raw: string | null;
  try { raw = desktop?desktop.readLibrary():localStorage.getItem(KEY); }
  catch(error) { return { library: initialLibrary(), ...checkBrowserStorage(), ...(desktop?{error:`기존 PC 자료를 읽지 못했습니다. 원본은 유지됩니다. ${error instanceof Error?error.message:''}`}:{}) }; }
  const status = checkBrowserStorage();
  try { if (!raw) return { library: initialLibrary(), ...status }; const parsed = JSON.parse(raw); if (!validateLibrary(parsed)) throw new Error('지원하지 않거나 손상된 저장 형식입니다.'); return { library: parsed, ...status }; }
  catch (error) { return { library: initialLibrary(), ...status, error: `기존 저장 자료를 읽지 못했습니다. 원본 저장값은 유지했습니다. ${error instanceof Error ? error.message : ''}` }; }
}
export function writeLibrary(library: Library) { const raw = JSON.stringify(library);if(desktop){desktop.writeLibrary(raw);return;} localStorage.setItem(KEY, raw); if (localStorage.getItem(KEY) !== raw) throw new Error('저장 결과를 확인하지 못했습니다.'); }
export function importLibrary(raw: string): Library { if (raw.length > 40 * 1024 * 1024) throw new Error('백업 파일은 40MB 이하만 지원합니다.'); const v = JSON.parse(raw); if (!validateLibrary(v)) throw new Error('버전 또는 데이터 구조가 올바르지 않습니다. 문서 스튜디오 v1 백업을 선택하세요.'); return v; }
export async function downloadBackup(library: Library, filename?:string) {if(desktop)return desktop.exportBackup(JSON.stringify(library,null,2)); const url = URL.createObjectURL(new Blob([JSON.stringify(library, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = filename ?? `문서스튜디오-백업-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export async function readImage(file: File, category: Asset['category']): Promise<Asset> {
  if (!['image/png', 'image/jpeg'].includes(file.type)) throw new Error('PNG 또는 JPEG 파일을 선택하세요.');
  if (file.size > 3 * 1024 * 1024) throw new Error('이미지는 3MB 이하를 사용하세요. 브라우저 저장 공간에 제한이 있습니다.');
  const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.')); reader.readAsDataURL(file); });
  const image = new Image(); image.src = data; await image.decode();
  if (image.naturalWidth > 30000 || image.naturalHeight > 30000) throw new Error('이미지 해상도가 너무 큽니다.');
  return { id: uid(), name: file.name.replace(/\.[^.]+$/, ''), category, data, width: image.naturalWidth, height: image.naturalHeight };
}

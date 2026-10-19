import type { InlineStyle, RichRun } from './model';
export const fontFamily = (name: string) => name === 'Serif' ? 'Georgia, "Noto Serif KR", serif' : name === 'Mono' ? 'monospace' : ['serif','sans-serif','monospace','system-ui'].includes(name)?name: name === 'Pretendard' ? '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif' : `"${name.replace(/["\\\n\r]/g,'')}", ${['Georgia','Times New Roman','Noto Serif KR'].includes(name)?'serif':'sans-serif'}`;
export const plainRuns = (text: string): RichRun[] => [{ text }];
export const richText = (runs: RichRun[]) => runs.map(run => run.text).join('');
export function mergeRuns(runs: RichRun[]): RichRun[] {
  const out: RichRun[] = [];
  for (const run of runs) { if (!run.text) continue; const last=out.at(-1); if(last && JSON.stringify(last.style??{})===JSON.stringify(run.style??{}))last.text+=run.text;else out.push({text:run.text,...(run.style?{style:{...run.style}}:{})}); }
  return out;
}
export function sliceRuns(runs: RichRun[], start: number, end: number): RichRun[] {
  let offset=0;const out:RichRun[]=[];
  for(const run of runs){const a=Math.max(0,start-offset),b=Math.min(run.text.length,end-offset);if(b>a)out.push({...run,text:run.text.slice(a,b)});offset+=run.text.length;}
  return mergeRuns(out);
}
export function spliceRuns(runs: RichRun[], start:number, count:number, insert:RichRun[]):RichRun[]{return mergeRuns([...sliceRuns(runs,0,start),...insert,...sliceRuns(runs,start+count,Infinity)]);}
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function inlineCSS(s:InlineStyle):Record<string,string>{const out:Record<string,string>={};if(s.font)out['font-family']=fontFamily(s.font);if(s.size)out['font-size']=`${s.size}pt`;if(s.bold!==undefined)out['font-weight']=s.bold?'700':'400';if(s.italic!==undefined)out['font-style']=s.italic?'italic':'normal';if(s.underline!==undefined)out['text-decoration']=s.underline?'underline':'none';if(s.color)out.color=s.color;if(s.highlight)out['background-color']=s.highlight;return out;}
function attributes(css:Record<string,string>){return escape(Object.entries(css).map(([k,v])=>`${k}:${v}`).join(';'));}
export function runsHTML(runs:RichRun[]):string {
  const lines:{runs:RichRun[];style:InlineStyle}[]=[{runs:[],style:{}}];
  for(const run of runs){const chunks=run.text.split('\n');chunks.forEach((text,i)=>{const line=lines.at(-1)!;if(!line.runs.length)line.style=run.style??{};if(text)line.runs.push({...run,text});if(i<chunks.length-1)lines.push({runs:[],style:run.style??{}});});}
  return lines.map((line,i)=>{const css:Record<string,string>={};if(line.style.align)css['text-align']=line.style.align;if(line.style.lineHeight)css['line-height']=String(line.style.lineHeight);const content=line.runs.map(run=>{const style=attributes(inlineCSS(run.style??{}));return style?`<span style="${style}">${escape(run.text)}</span>`:escape(run.text);}).join('');return `<div data-rich-paragraph=""${Object.keys(css).length?` style="${attributes(css)}"`:''}>${content||'<br>'}</div>`;}).join('');
}
/** Parse only text and supported typography. No HTML, script, images, links or executable attributes are stored. */
export function readRuns(root:HTMLElement):RichRun[]{
  const result:RichRun[]=[];
  const add=(text:string,style:InlineStyle)=>{if(text)result.push({text:text.replace(/\u00a0/g,' '),...(Object.keys(style).length?{style}: {})});};
  const visit=(node:Node,inherited:InlineStyle)=>{
    if(node.nodeType===Node.TEXT_NODE){add(node.textContent??'',inherited);return;}
    if(!(node instanceof HTMLElement))return;
    if(['SCRIPT','STYLE','IMG','BUTTON','IFRAME'].includes(node.tagName)||node.dataset.editorUi!==undefined)return;
    const s={...inherited};const css=node.style;
    if(css.fontFamily){const name=css.fontFamily.replace(/^['"]|['"]$/g,'').split(',')[0].replace(/^['"]|['"]$/g,'');s.font=['Pretendard','Serif','Mono'].includes(name)?`"${name}"`:name;}
    if(node.tagName==='FONT'&&node.getAttribute('face')){const name=node.getAttribute('face')!;s.font=['Pretendard','Serif','Mono'].includes(name)?`"${name}"`:name;}
    if(css.fontSize&&node.dataset.richSize===undefined){const n=parseFloat(css.fontSize);if(Number.isFinite(n))s.size=Math.min(72,Math.max(6,css.fontSize.endsWith('pt')?n:n*.75));}
    if(css.fontWeight)s.bold=css.fontWeight==='bold'||Number(css.fontWeight)>=600;
    if(['B','STRONG'].includes(node.tagName))s.bold=true;
    if(css.fontStyle)s.italic=css.fontStyle==='italic';if(['I','EM'].includes(node.tagName))s.italic=true;
    if(css.textDecoration||css.textDecorationLine)s.underline=(css.textDecoration||css.textDecorationLine).includes('underline');if(node.tagName==='U')s.underline=true;
    if(css.color)s.color=css.color;if(node.tagName==='FONT'&&node.getAttribute('color'))s.color=node.getAttribute('color')!;
    if(css.backgroundColor)s.highlight=css.backgroundColor;
    if(['left','center','right','justify'].includes(css.textAlign))s.align=css.textAlign as InlineStyle['align'];
    if(css.lineHeight){const n=parseFloat(css.lineHeight);if(n>=1&&n<=3)s.lineHeight=n;}
    const children=[...node.childNodes];
    children.forEach((child,i)=>{
      if(child instanceof HTMLElement&&child.tagName==='BR'){if(children.length===1||(i===children.length-1&&(children[i-1] as HTMLElement)?.tagName==='BR'))return;add('\n',s);return;}
      if(child instanceof HTMLElement&&['DIV','P'].includes(child.tagName)&&i>0)add('\n',s);
      visit(child,s);
    });
  };
  // The root has block/cell defaults; keep those inherited rather than baking them into every run.
  [...root.childNodes].forEach((child,i)=>{if(child instanceof HTMLElement&&['DIV','P'].includes(child.tagName)&&i>0)add('\n',{});visit(child,{});});
  return mergeRuns(result);
}
/** Keep explicit typography when numeric display adds separators or calculated values change. */
export function displayRuns(runs:RichRun[]|undefined,value:string):RichRun[]|undefined{
 if(!runs||richText(runs)===value)return runs;
 const source=runs.flatMap(run=>[...run.text].map(char=>({char,style:run.style})));let index=0;const out:RichRun[]=[];
 for(const char of value){const item=source[Math.min(index,source.length-1)];out.push({text:char,...(item?.style?{style:item.style}:{})});if(char!==','||source[index]?.char===',')index++;}
 return mergeRuns(out);
}

/** A paragraph's inherited large-font strut must not outlive its smaller text.
 * Only derive a font size when every run has its own size; otherwise the block
 * default still belongs to the unformatted text. Larger runs size their own lines.
 * Change styles in place to preserve the user's selection and IME composition.
 */
export function syncRichSizing(root:HTMLElement, originalSize:string='') {
 root.style.fontSize=originalSize;
 const paragraphs=[...root.querySelectorAll<HTMLElement>('div,p')].filter(p=>!p.querySelector('div,p'));
 for(const p of paragraphs.length?paragraphs:[root]){
  const runs=readRuns(p).filter(r=>r.text.length);
  if(runs.length&&runs.every(r=>r.style?.size!==undefined)){
   p.style.fontSize=`${Math.min(...runs.map(r=>r.style!.size!))}pt`;
   p.dataset.richSize='';
  }else if(p.dataset.richSize!==undefined){
   p.style.fontSize=p===root?originalSize:'';delete p.dataset.richSize;
  }
 }
}

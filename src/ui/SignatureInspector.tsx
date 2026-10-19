import {useEffect,useRef,useState} from 'react';
import {ShieldCheck,Stamp,Trash2} from 'lucide-react';
import {MM} from '../core/model';
import type {Block,Mode,StudioDoc} from '../core/model';
import {signatureStageHeight} from '../core/widgets';
import {signatureImageLimits,signatureRule} from '../core/signature';

const display=(n:number)=>String(Number(n.toFixed(2)));
/** Keep incomplete decimal input local; valid values update the page immediately. */
function Measurement({label,value,min,max,step=1,suffix,disabled,onChange}:{label:string;value:number;min:number;max:number;step?:number;suffix:string;disabled?:boolean;onChange:(n:number)=>void}){
 const [draft,setDraft]=useState(display(value));const focused=useRef(false),dirty=useRef(false),lastSent=useRef(value);
 useEffect(()=>{if(!focused.current||value!==lastSent.current){setDraft(display(value));dirty.current=false;}lastSent.current=value;},[value]);
 const finish=()=>{focused.current=false;if(!dirty.current){setDraft(display(value));return;}const parsed=draft.trim()===''?value:Number(draft);const next=Math.min(max,Math.max(min,Number.isFinite(parsed)?parsed:value));setDraft(display(next));dirty.current=false;if(next!==value){lastSent.current=next;onChange(next);}};
 return <label className="control"><span>{label}</span><div className="number-wrap"><input aria-label={label} type="number" value={draft} min={min} max={max} step={step} disabled={disabled} onFocus={()=>{focused.current=true;}} onChange={e=>{const text=e.target.value;setDraft(text);dirty.current=true;const next=Number(text);if(text!==''&&Number.isFinite(next)&&next>=min&&next<=max&&next!==value){lastSent.current=next;onChange(next);}}} onBlur={finish} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}if(e.key==='Escape'){dirty.current=false;setDraft(display(value));e.currentTarget.blur();}}}/><em>{suffix}</em></div></label>;
}

export function SignatureInspector({block,doc,mode,preview,selectedImage,patch,chooseAsset}:{block:Block;doc:StudioDoc;mode:Mode;preview:boolean;selectedImage:string|null;patch:(p:Partial<Block>)=>void;chooseAsset:()=>void}){
 const rule=signatureRule(block);
 return <section className="inspector-section signature-inspector"><h3>서명 영역</h3>
  <label className="control"><span>영역 제목</span><input value={block.text} disabled={preview} onChange={e=>patch({text:e.target.value,rich:undefined})}/></label>
  <label className="control"><span>제목 위치</span><select aria-label="서명 제목 위치" value={block.signatureTitlePosition??'above'} disabled={preview} onChange={e=>patch({signatureTitlePosition:e.target.value as 'above'|'below'})}><option value="above">서명 위</option><option value="below">서명 아래</option></select></label>
  <label className="control"><span>서명 안내문</span><input aria-label="서명 안내문" value={block.caption??'서명 / 도장'} disabled={preview} onChange={e=>patch({caption:e.target.value})}/></label>
  <Measurement label="서명 영역 높이" value={signatureStageHeight(doc,block)/MM} min={10} max={200} suffix="mm" disabled={preview} onChange={signatureHeight=>patch({signatureHeight,rowSpan:1})}/>
  <p className="panel-hint">이미지를 넣는 안쪽 영역의 높이입니다. 제목과 선은 별도로 공간을 확보하고 전체 블록은 격자에 맞춰 늘어납니다. 영역을 줄이면 이미지 비율을 유지하며 안으로 맞춥니다.</p>
  <label className="control"><span>위 구분선</span><select aria-label="서명 위 구분선" disabled={preview} value={rule.style} onChange={e=>patch({signatureLine:{...rule,style:e.target.value as typeof rule.style}})}><option value="none">없음</option><option value="solid">실선</option><option value="dashed">파선 ┄</option><option value="dotted">점선 ···</option></select></label>
  <Measurement label="서명 선 굵기" value={rule.width} min={.25} max={8} step={.25} suffix="mm" disabled={preview||rule.style==='none'} onChange={width=>patch({signatureLine:{...rule,width}})}/>
  <label className="control color-control"><span>서명 선 색</span><input aria-label="서명 선 색" type="color" disabled={preview||rule.style==='none'} value={rule.color} onChange={e=>patch({signatureLine:{...rule,color:e.target.value}})}/></label>
  <button className="wide-button" disabled={preview||mode!=='document'} onClick={chooseAsset}><Stamp size={16}/>보관함에서 서명 선택</button>
  {block.images?.filter(i=>!selectedImage||i.id===selectedImage).map(i=>{const limits=signatureImageLimits(doc,block,i);return <div className="signature-setting" key={i.id}><strong>{i.asset.name}</strong>
   <Measurement label="서명 너비" value={i.width} min={Math.min(.01,limits.width)} max={limits.width} step={.1} suffix="%" disabled={preview||mode!=='document'} onChange={width=>patch({images:block.images?.map(x=>x.id===i.id?{...x,width}:x)})}/>
   <Measurement label="서명 가로 위치" value={i.x} min={0} max={limits.x} step={.1} suffix="%" disabled={preview||mode!=='document'} onChange={x=>patch({images:block.images?.map(v=>v.id===i.id?{...v,x}:v)})}/>
   <Measurement label="서명 세로 위치" value={i.y} min={0} max={limits.y} step={.1} suffix="%" disabled={preview||mode!=='document'} onChange={y=>patch({images:block.images?.map(v=>v.id===i.id?{...v,y}:v)})}/>
   <label className="toggle-control"><span>위치 잠금<small>이미지 드래그를 잠급니다.</small></span><input aria-label="위치 잠금" type="checkbox" checked={i.locked} disabled={preview||mode!=='document'} onChange={e=>patch({images:block.images?.map(v=>v.id===i.id?{...v,locked:e.target.checked}:v)})}/><i/></label>
   <button className="danger-button" disabled={preview||mode!=='document'} onClick={()=>patch({images:block.images?.filter(x=>x.id!==i.id)})}><Trash2 size={13}/>문서에서 제거</button>
  </div>;})}
  <p className="panel-hint">비율 유지 · 영역 안 자유 배치<br/>보관함에서 삭제해도 문서의 이미지는 유지됩니다.</p>
  <div className="info-card"><ShieldCheck size={16}/><span>양식에는 서명 자리만 저장합니다. 본인 인증을 포함하는 전자서명 기능은 아닙니다.</span></div>
 </section>;
}

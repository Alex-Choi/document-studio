import {useLayoutEffect,useRef} from 'react';
import type {CSSProperties} from 'react';

/** Plain document names: persist text, never HTML or formatting commands. */
export function InlineLabel({value,editable,onChange,label,className,style,tag='span',placeholder='이름 입력'}:{value:string;editable:boolean;onChange:(v:string)=>void;label:string;className?:string;style?:CSSProperties;tag?:'span'|'div';placeholder?:string}){
 const ref=useRef<HTMLElement|null>(null);const composing=useRef(false);
 useLayoutEffect(()=>{const el=ref.current;if(!el||composing.current||el.textContent===value)return;const s=getSelection();let offset:number|undefined;if(s?.rangeCount&&el.contains(s.anchorNode)){const r=s.getRangeAt(0).cloneRange();r.selectNodeContents(el);r.setEnd(s.anchorNode!,s.anchorOffset);offset=r.toString().length;}el.textContent=value;if(offset!==undefined){const r=document.createRange();r.setStart(el.firstChild??el,Math.min(offset,value.length));r.collapse(true);s?.removeAllRanges();s?.addRange(r);}},[value]);
 const save=()=>{if(!composing.current)onChange((ref.current?.innerText??'').replace(/[\r\n]+/g,' '));};
 const Tag=tag;return <Tag ref={el=>{ref.current=el;}} className={`inline-label ${className??''}`} style={style} contentEditable={editable} suppressContentEditableWarning role={editable?'textbox':undefined} aria-label={editable?label:undefined} aria-multiline={editable?false:undefined} data-inline-label data-placeholder={placeholder} onInput={save} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;save();}} onBlur={save} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.blur();}if((e.ctrlKey||e.metaKey)&&['b','i','u'].includes(e.key.toLowerCase()))e.preventDefault();}} onPaste={e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain').replace(/[\r\n]+/g,' '));}} />;
}

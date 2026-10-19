import { createElement, useEffect, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { plainRuns, readRuns, richText, runsHTML } from '../core/rich';
import type { RichRun } from '../core/model';
export function RichEditor({value,runs,editable,onChange,tag='div',className,textContent,calculated,style,onPointerDown,onPointerEnter,cellKey}:{value:string;runs?:RichRun[];editable:boolean;onChange:(text:string,runs:RichRun[])=>void;tag?:'div'|'th'|'td';className?:string;textContent?:boolean;calculated?:boolean;style?:CSSProperties;onPointerDown?:(e:PointerEvent)=>void;onPointerEnter?:(e:PointerEvent)=>void;cellKey?:string}){
 const ref=useRef<HTMLElement|null>(null),frame=useRef(0),pending=useRef(false),composing=useRef(false);
 const changeRef=useRef(onChange);changeRef.current=onChange;
 const model=JSON.stringify(runs??plainRuns(value));
 const commit=()=>{cancelAnimationFrame(frame.current);pending.current=false;const el=ref.current;if(!el)return;const next=readRuns(el);changeRef.current(richText(next),next);};
 useEffect(()=>{const el=ref.current;if(!el)return;const force=()=>commit();el.addEventListener('richcommit',force);return()=>{cancelAnimationFrame(frame.current);el.removeEventListener('richcommit',force);};},[]);
 useLayoutEffect(()=>{const el=ref.current;if(!el||composing.current||pending.current)return;const next=runs??plainRuns(value);if(JSON.stringify(readRuns(el))===JSON.stringify(next))return;const selection=window.getSelection();let offset:number|null=null;if(document.activeElement===el&&selection?.anchorNode&&el.contains(selection.anchorNode)){const r=document.createRange();r.selectNodeContents(el);r.setEnd(selection.anchorNode,selection.anchorOffset);offset=r.toString().length;}el.innerHTML=runsHTML(next);if(offset!==null&&selection){const walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node=walk.nextNode(),left=offset;while(node&&left>(node.textContent?.length??0)){left-=node.textContent?.length??0;node=walk.nextNode();}const r=document.createRange();if(node)r.setStart(node,Math.min(left,node.textContent?.length??0));else r.selectNodeContents(el);r.collapse(!node);selection.removeAllRanges();selection.addRange(r);}},[model,value]);
 return createElement(tag,{ref,className,style,contentEditable:editable,suppressContentEditableWarning:true,'data-rich-editor':editable?'':undefined,'data-text-content':textContent?'':undefined,'data-calculated':calculated,'data-cell-key':cellKey,
 onInput:()=>{if(!editable)return;pending.current=true;cancelAnimationFrame(frame.current);if(!textContent&&!ref.current?.querySelector('div div,div br'))commit();else frame.current=requestAnimationFrame(commit);},
 onCompositionStart:()=>{composing.current=true;},onCompositionEnd:()=>{composing.current=false;commit();},onBlur:()=>{if(pending.current)commit();},
 onPaste:(e:React.ClipboardEvent)=>{if(editable){e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));}},onPointerDown,onPointerEnter,
 onKeyDown:(e:React.KeyboardEvent)=>{if(e.key==='Escape')(e.currentTarget as HTMLElement).blur();}
 });
}

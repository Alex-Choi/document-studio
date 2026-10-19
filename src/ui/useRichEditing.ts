import { useEffect, useRef, useState } from 'react';
import type { InlineStyle } from '../core/model';
import { fontFamily } from '../core/rich';
export function useRichEditing(){
 const enabled=useRef(false);
 const saved=useRef<{range:Range;editor:HTMLElement}|null>(null),[state,setState]=useState<{active:boolean;mixed:string[];style:InlineStyle}>({active:false,mixed:[],style:{}});
 const capture=()=>{if(!enabled.current)return;const selection=window.getSelection();if(!selection?.rangeCount)return;const range=selection.getRangeAt(0);const node=range.commonAncestorContainer;const el=(node.nodeType===1?node:node.parentElement) as HTMLElement|null;const editor=el?.closest<HTMLElement>('.paper [data-rich-editor]');if(!editor||document.activeElement!==editor||!editor.contains(range.startContainer)||!editor.contains(range.endContainer))return;saved.current={range:range.cloneRange(),editor};
  const nodes:HTMLElement[]=[];const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);let child:Node|null;while((child=walker.nextNode()))if(range.intersectsNode(child)&&child.textContent?.length)nodes.push(child.parentElement!);if(!nodes.length)nodes.push(el??editor);
  const styles=nodes.map(n=>{const s=getComputedStyle(n);return {font:(()=>{const name=s.fontFamily.split(',')[0].replace(/['"]/g,'');return ['Pretendard','Serif','Mono'].includes(name)?`"${name}"`:name;})(),size:Math.round(parseFloat(s.fontSize)*.75*10)/10,bold:Number(s.fontWeight)>=600,italic:s.fontStyle==='italic',underline:s.textDecorationLine.includes('underline')||!!n.closest('u'),color:s.color,highlight:s.backgroundColor,align:s.textAlign as InlineStyle['align'],lineHeight:Math.round(parseFloat(s.lineHeight)/parseFloat(s.fontSize)*100)/100};});
  if(range.collapsed){styles[0].bold=document.queryCommandState('bold');styles[0].italic=document.queryCommandState('italic');styles[0].underline=document.queryCommandState('underline');}const mixed=Object.keys(styles[0]).filter(key=>styles.some(s=>s[key as keyof typeof s]!==styles[0][key as keyof typeof s]));setState({active:true,mixed,style:styles[0]});
 };
 const clear=(preserveSelection=false)=>{enabled.current=false;saved.current=null;if(!preserveSelection)window.getSelection()?.removeAllRanges();setState({active:false,mixed:[],style:{}});};
 useEffect(()=>{document.addEventListener('selectionchange',capture);const down=(e:globalThis.PointerEvent)=>{const target=e.target as HTMLElement;if(target.closest('.paper [data-rich-editor]'))enabled.current=true;else if(target.closest('.paper'))clear();};document.addEventListener('pointerdown',down,true);const focus=(e:FocusEvent)=>{if((e.target as HTMLElement).matches('.paper [data-rich-editor]'))enabled.current=true;};document.addEventListener('focusin',focus);return()=>{document.removeEventListener('selectionchange',capture);document.removeEventListener('pointerdown',down,true);document.removeEventListener('focusin',focus);};},[]);
 const apply=(patch:InlineStyle|'clear'):boolean=>{const active=saved.current;if(!active||!active.editor.isConnected||!active.editor.isContentEditable)return false;const {range,editor}=active;const selection=window.getSelection();editor.focus({preventScroll:true});selection?.removeAllRanges();selection?.addRange(range);document.execCommand('styleWithCSS',false,'true');
  if(patch==='clear')document.execCommand('removeFormat');else for(const [key,value] of Object.entries(patch)){
   if(key==='bold'||key==='italic'||key==='underline'){if(document.queryCommandState(key)!==value)document.execCommand(key);}
   else if(key==='font')document.execCommand('fontName',false,fontFamily(String(value)).split(',')[0]);
   else if(key==='size'){document.execCommand('fontSize',false,'7');editor.querySelectorAll<HTMLElement>('font[size="7"],span[style*="xxx-large"]').forEach(n=>{n.removeAttribute('size');n.style.fontSize=`${value}pt`;});}
   else if(key==='color')document.execCommand('foreColor',false,String(value));
   else if(key==='highlight')document.execCommand('hiliteColor',false,String(value));
   else if(key==='align')document.execCommand(({left:'justifyLeft',center:'justifyCenter',right:'justifyRight',justify:'justifyFull'} as Record<string,string>)[String(value)]);
   else if(key==='lineHeight'){const paragraphs=[...editor.querySelectorAll<HTMLElement>('div,p')].filter(n=>range.intersectsNode(n)&&!n.querySelector('div,p'));if(!paragraphs.length){document.execCommand('formatBlock',false,'div');const n=selection?.anchorNode?.parentElement?.closest<HTMLElement>('div');if(n&&editor.contains(n))paragraphs.push(n);}paragraphs.forEach(n=>{n.style.lineHeight=String(value);});}
  }
  editor.dispatchEvent(new Event('richcommit'));capture();return true;
 };
 useEffect(()=>{const shortcut=(e:KeyboardEvent)=>{if(!(e.ctrlKey||e.metaKey)||(e.target as HTMLElement).matches('input,textarea,select'))return;capture();if(!saved.current)return;const key=e.key.toLowerCase();if(!['b','i','u'].includes(key))return;e.preventDefault();const property=({b:'bold',i:'italic',u:'underline'} as const)[key as 'b'|'i'|'u'];apply({[property]:!document.queryCommandState(property)});};document.addEventListener('keydown',shortcut);return()=>document.removeEventListener('keydown',shortcut);});
 return {state,apply,clear,capture,preserve:(e:React.PointerEvent)=>{if((e.target as HTMLElement).closest('button'))e.preventDefault();}};
}

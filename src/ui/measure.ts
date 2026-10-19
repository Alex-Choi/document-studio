import type { Metrics } from '../core/layout';
/** Measure the same DOM used by editing and print, including styled character runs. */
export function measureBlocks(root:HTMLElement):Record<string,Metrics>{
 const result:Record<string,Metrics>={};
 root.querySelectorAll<HTMLElement>('[data-block-id]').forEach(el=>{
  const metric:Metrics={height:el.getBoundingClientRect().height};const table=el.querySelector('table');
  const signature=el.querySelector('.signature-content'),stage=el.querySelector('.signature-stage');
  if(signature&&stage)metric.signatureChrome=signature.getBoundingClientRect().height-stage.getBoundingClientRect().height;
  if(table){metric.head=(table.tHead?.getBoundingClientRect().height??0)+1;metric.rows=Array.from(table.tBodies[0].rows).map(r=>r.getBoundingClientRect().height);metric.total=table.tFoot?.getBoundingClientRect().height??0;}
  const text=el.querySelector<HTMLElement>('[data-text-content]');
  if(text){const paragraphs=[...text.children].filter(n=>n instanceof HTMLElement&&n.dataset.richParagraph!==undefined) as HTMLElement[];const parts=paragraphs.length?paragraphs:[text];const lines:{text:string;height:number}[]=[];
   parts.forEach((paragraph,pi)=>{const base=parseFloat(getComputedStyle(paragraph).lineHeight)||parseFloat(getComputedStyle(text).fontSize)*1.65;const walker=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT);let node:Node|null,line='',height=base,bottom=-1;
    while((node=walker.nextNode())){const content=node.textContent??'';const range=document.createRange();const lineHeight=parseFloat(getComputedStyle(node.parentElement!).lineHeight)||base;
     for(let i=0;i<content.length;i++){range.setStart(node,i);range.setEnd(node,i+1);const rect=range.getBoundingClientRect();if(bottom>=0&&rect.height>0&&rect.top>=bottom-1){lines.push({text:line,height});line='';height=base;bottom=-1;}line+=content[i];height=Math.max(height,lineHeight);if(rect.height>0)bottom=Math.max(bottom,rect.bottom);}
    }
    if(pi<parts.length-1)line+='\n';lines.push({text:line,height});
   });metric.lines=lines;
  }
  result[el.dataset.blockId!]=metric;
 });return result;
}

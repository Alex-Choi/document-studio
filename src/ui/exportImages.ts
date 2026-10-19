import {toBlob,toJpeg} from 'html-to-image';
import type {ExportFile} from '../core/office';
import type {StudioDoc} from '../core/model';
const frame=()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));
export async function exportImages(doc:StudioDoc,type:'png'|'jpg'):Promise<ExportFile[]>{
 const name=doc.name;
 const files:ExportFile[]=[];document.documentElement.classList.add('exporting-images');
 try{await document.fonts.ready;await frame();const pages=[...document.querySelectorAll<HTMLElement>('.paper')];for(let i=0;i<pages.length;i++){
  const options={pixelRatio:2,width:210*96/25.4,height:297*96/25.4,backgroundColor:'#ffffff',cacheBust:false,fontEmbedCSS:(doc.fonts??[]).map(f=>`@font-face{font-family:${f.family};src:url(${f.data});}`).join('\n'),filter:(node:HTMLElement)=>!node.classList?.contains('print-hidden'),style:{transform:'none',margin:'0',boxShadow:'none'}};
  let data:Uint8Array;if(type==='png'){const blob=await toBlob(pages[i],options);if(!blob)throw new Error('이미지를 생성하지 못했습니다.');data=new Uint8Array(await blob.arrayBuffer());}else{const url=await toJpeg(pages[i],{...options,quality:.95});data=Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0));}files.push({name:`${name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,70)}-${String(i+1).padStart(3,'0')}.${type}`,data});
 }return files;}finally{document.documentElement.classList.remove('exporting-images');}
}

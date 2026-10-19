import {MM} from './model';
import type {Block,Placement,StudioDoc} from './model';
import {GRID_GAP,signatureStageHeight} from './widgets';

/** Match the original CSS when opening documents created before explicit rule settings. */
export function signatureRule(block:Block) {
 return block.signatureLine??{style:'solid' as const,width:2/MM,color:'#26a8ae'};
}
export function signatureStageWidth(doc:StudioDoc,block:Block) {
 const body=(210-doc.page.margins.left-doc.page.margins.right)*MM,gap=doc.page.widgetGrid?GRID_GAP:10;
 return Math.max(1,(body-(doc.page.columns-1)*gap)/doc.page.columns*block.span+(block.span-1)*gap-2);
}
export function signatureImageLimits(doc:StudioDoc,block:Block,image:Placement) {
 const height=Math.max(1,signatureStageHeight(doc,block)-2),width=signatureStageWidth(doc,block);
 const imageHeight=image.width/100*width*image.asset.height/image.asset.width;
 return {width:Math.max(0,Math.min(100-image.x,(1-image.y/100)*height*image.asset.width/image.asset.height/width*100)),x:Math.max(0,100-image.width),y:Math.max(0,100-imageHeight/height*100)};
}
/** Resizing is one document operation: keep embedded assets and aspect ratios intact. */
export function fitSignatureImages(doc:StudioDoc,block:Block):Placement[]|undefined {
 const height=Math.max(1,signatureStageHeight(doc,block)-2),stageWidth=signatureStageWidth(doc,block);
 return block.images?.map(image=>{
  const width=Math.min(image.width,100,height*image.asset.width/image.asset.height/stageWidth*100);
  const heightPercent=width/100*stageWidth*image.asset.height/image.asset.width/height*100;
  return {...image,width,x:Math.max(0,Math.min(image.x,100-width)),y:Math.max(0,Math.min(image.y,100-heightPercent))};
 });
}

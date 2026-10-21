import {MM} from './model';
import type {Asset,Decoration,Region} from './model';

export const MAX_REGION_HEIGHT=65;
export const imageAspectLocked=(item:Decoration)=>item.type==='image'&&item.lockAspect!==false&&!!item.asset;
const clamp=(n:number,min:number,max:number)=>Math.min(Math.max(min,n),Math.max(min,max));
/** Fit within the paper margins and the region limit; dimensions remain in mm. */
export function fitRegionImage(asset:Asset,width:number,native=false){
 const naturalWidth=asset.width/MM,naturalHeight=asset.height/MM;
 const scale=Math.min((native?Math.min(width,naturalWidth):width)/naturalWidth,MAX_REGION_HEIGHT/naturalHeight);
 return {x:0,y:0,width:Math.min(width,naturalWidth*scale),height:Math.min(MAX_REGION_HEIGHT,naturalHeight*scale)};
}
export function editRegionDecoration(item:Decoration,patch:Partial<Decoration>,availableWidth:number):Decoration{
 const next={...item,...patch};if(!['x','y','width','height','lockAspect'].some(key=>key in patch))return next;const min=next.type==='image'?1e-6:1;
 next.x=clamp(next.x,0,availableWidth-min);next.y=clamp(next.y,0,MAX_REGION_HEIGHT-min);
 const maxWidth=Math.max(min,availableWidth-next.x),maxHeight=Math.max(min,MAX_REGION_HEIGHT-next.y);
 if(imageAspectLocked(next)&&('width' in patch||'height' in patch||patch.lockAspect===true)){
  const ratio=next.asset!.height/next.asset!.width;
  const width='height' in patch&&!('width' in patch)?next.height/ratio:next.width;
  next.width=Math.max(1e-6,Math.min(width,maxWidth,maxHeight/ratio));next.height=Math.min(maxHeight,next.width*ratio);
 }else{next.width=clamp(next.width,min,maxWidth);next.height=clamp(next.height,min,maxHeight);}
 return next;
}
/** Image geometry and the height it reserves are a single undoable edit. */
export function updateRegionDecoration(region:Region,key:'items'|'firstItems',id:string,patch:Partial<Decoration>,availableWidth:number){
 region[key]=region[key].map(item=>{
  if(item.id!==id)return item;
  const next=editRegionDecoration(item,patch,availableWidth);
  if(['x','y','width','height','lockAspect'].some(key=>key in patch))region.height=Math.min(MAX_REGION_HEIGHT,Math.max(region.height,next.y+next.height));return next;
 });
}
/** An explicit region shrink fits images proportionally; zero hides without losing data. */
export function resizeRegion(region:Region,height:number){
 region.height=clamp(height,0,MAX_REGION_HEIGHT);if(!region.height)return;
 for(const key of ['items','firstItems'] as const)region[key]=region[key].map(item=>{
  const factor=imageAspectLocked(item)?Math.min(1,region.height/item.height):1;
  const h=Math.min(item.height,item.type==='image'?region.height:Math.max(1,region.height));return {...item,width:item.width*factor,height:h,y:Math.min(item.y,Math.max(0,region.height-h))};
 });
}

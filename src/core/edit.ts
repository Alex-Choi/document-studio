import type {Block} from './model';

/** Document copies may change wording and presentation, while structural IDs stay stable. */
export function documentPatch(block:Block,patch:Partial<Block>):Partial<Block>{
 const next:Partial<Block>={};
 if(patch.style)next.style={...block.style,...patch.style};
 if(patch.heightMode!==undefined){next.heightMode=patch.heightMode;if(patch.rowSpan!==undefined)next.rowSpan=patch.rowSpan;}
 if(['text','emoji','signature'].includes(block.type)&&patch.text!==undefined){next.text=patch.text;next.rich=patch.rich;}
 if(['text','emoji','signature'].includes(block.type)&&'rich' in patch)next.rich=patch.rich;
 if(block.field&&patch.field)next.field={...block.field,name:patch.field.name,labelWidth:patch.field.labelWidth??block.field.labelWidth};
 if(block.type==='signature'){
  if(patch.signatureHeight!==undefined){next.signatureHeight=patch.signatureHeight;next.rowSpan=1;}
  if(patch.signatureTitlePosition!==undefined)next.signatureTitlePosition=patch.signatureTitlePosition;
  if(patch.signatureLine!==undefined)next.signatureLine=patch.signatureLine;
  if(patch.caption!==undefined)next.caption=patch.caption;
  if(patch.images!==undefined)next.images=patch.images;
 }
 if(block.table&&patch.table){
  const original=block.table,incoming=patch.table;
  next.table={...original,columns:original.columns.map(c=>({...c,name:incoming.columns.find(n=>n.id===c.id)?.name??c.name})),totalLabel:incoming.totalLabel??original.totalLabel,rows:original.repeatable?incoming.rows:original.rows,richCells:incoming.richCells??original.richCells,cellStyles:incoming.cellStyles??original.cellStyles};
 }
 return next;
}

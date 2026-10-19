import {useState} from 'react';
import {ArrowDownToLine} from 'lucide-react';
export type ExportFormat='pdf'|'docx'|'xlsx'|'png'|'jpg';
export function ExportControls({busy,onSave}:{busy:boolean;onSave:(format:ExportFormat)=>void}){
 const [format,setFormat]=useState<ExportFormat>('pdf');
 return <div className="export-controls"><select aria-label="저장 형식" title="형식을 고른 뒤 옆의 저장 버튼을 누르세요. PDF는 브라우저 인쇄 창에서 저장합니다." className="export-format-select" disabled={busy} value={format} onChange={e=>setFormat(e.target.value as ExportFormat)}><option value="pdf">PDF (.pdf)</option><option value="docx">Word (.docx)</option><option value="xlsx">Excel (.xlsx)</option><option value="png">PNG 이미지</option><option value="jpg">JPG 이미지</option></select><button aria-label="선택 형식으로 저장" disabled={busy} onClick={()=>onSave(format)}><ArrowDownToLine size={17}/><span>{busy?'저장 준비 중…':'선택 형식으로 저장'}</span></button></div>;
}

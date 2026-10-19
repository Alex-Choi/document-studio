type FileResult={cancelled?:boolean;filePath?:string;raw?:string};
interface DesktopBridge {
 platform:string;
 readLibrary:()=>string|null;
 checkStorage:()=>boolean;
 writeLibrary:(raw:string)=>boolean;
 exportBackup:(raw:string)=>Promise<FileResult>;
 openBackup:()=>Promise<FileResult>;
 exportPdf:(name:string)=>Promise<FileResult>;
 print:()=>Promise<FileResult>;
 openDataFolder:()=>Promise<FileResult>;
 saveFiles:(files:{name:string;data:Uint8Array}[])=>Promise<FileResult>;
 onAction:(callback:(action:string)=>void)=>()=>void;
}
declare global {interface Window {documentStudioDesktop?:DesktopBridge}}
export const desktop=typeof window!=='undefined'?window.documentStudioDesktop:undefined;

const {app, BrowserWindow, ipcMain, dialog, Menu, protocol, net, shell} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const {pathToFileURL} = require('node:url');
const {createStorage, atomicWrite, validateRaw, LIMIT} = require('./storage.cjs');

const APP_URL = 'studio://app/index.html';
protocol.registerSchemesAsPrivileged([{scheme:'studio', privileges:{standard:true, secure:true, supportFetchAPI:true}}]);
app.setName('DocumentStudio');
const testDirectory = !app.isPackaged && process.env.DOCUMENT_STUDIO_TEST_USER_DATA;
app.setPath('userData', testDirectory || path.join(app.getPath('appData'), 'DocumentStudio'));
if (process.platform === 'win32') app.setAppUserModelId('io.documentstudio.desktop');
const storage = createStorage(app.getPath('userData'));
let win;
const trusted = event => !!win && event.sender === win.webContents && event.senderFrame?.url === APP_URL;
function sync(channel, fn) {
  ipcMain.on(channel, (event, ...args) => {
    try { if (!trusted(event)) throw new Error('허용되지 않은 창입니다.'); event.returnValue = {ok:true, value:fn(...args)}; }
    catch (error) { event.returnValue = {ok:false, error:error.message}; }
  });
}
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!trusted(event)) throw new Error('허용되지 않은 창입니다.');
    return fn(...args);
  });
}
const safeName = name => String(name || '문서').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0,100);
function registerFiles() {
  sync('studio:read', () => storage.read());
  sync('studio:check', () => { storage.check(); return true; });
  sync('studio:write', raw => { storage.write(raw); return true; });
  handle('studio:export', async raw => {
    validateRaw(raw);
    const result = await dialog.showSaveDialog(win, {title:'이미지 포함 JSON 문서 내보내기',defaultPath:`문서스튜디오-백업-${new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date())}.json`,filters:[{name:'문서 스튜디오 JSON',extensions:['json']}]});
    if (result.canceled || !result.filePath) return {cancelled:true};
    atomicWrite(result.filePath, raw); return {filePath:result.filePath};
  });
  handle('studio:open', async () => {
    const result = await dialog.showOpenDialog(win, {title:'문서 스튜디오 JSON 가져오기',properties:['openFile'],filters:[{name:'문서 스튜디오 JSON',extensions:['json']}]});
    if (result.canceled || !result.filePaths.length) return {cancelled:true};
    if (fs.statSync(result.filePaths[0]).size > LIMIT) throw new Error('문서 파일은 40MB 이하만 지원합니다.');
    return {raw:validateRaw(fs.readFileSync(result.filePaths[0],'utf8'))};
  });
  handle('studio:pdf', async name => {
    const result = await dialog.showSaveDialog(win, {title:'PDF 저장',defaultPath:`${safeName(name)}.pdf`,filters:[{name:'PDF 문서',extensions:['pdf']}]});
    if (result.canceled || !result.filePath) return {cancelled:true};
    const bytes = await win.webContents.printToPDF({printBackground:true, preferCSSPageSize:true, pageSize:'A4', margins:{top:0,bottom:0,left:0,right:0}});
    atomicWrite(result.filePath, bytes); return {filePath:result.filePath};
  });
  handle('studio:print', () => new Promise((resolve,reject) => win.webContents.print({printBackground:true,silent:false,pageSize:'A4',margins:{marginType:'none'}},(success,reason)=>success?resolve({}):/cancel/i.test(reason)?resolve({cancelled:true}):reject(new Error(reason || '인쇄를 완료하지 못했습니다.')))));
  handle('studio:data-folder', async () => { fs.mkdirSync(storage.directory,{recursive:true}); const error=await shell.openPath(storage.directory);if(error)throw new Error(error);return {}; });
  handle('studio:files', async files => {
    if(!Array.isArray(files)||!files.length||files.length>1000)throw new Error('출력 파일 목록이 올바르지 않습니다.');
    let size=0;for(const file of files){if(!file||typeof file.name!=='string'||!/^.+\.(docx|xlsx|png|jpg)$/i.test(file.name)||!(file.data instanceof Uint8Array))throw new Error('출력 파일 형식이 올바르지 않습니다.');size+=file.data.length;}if(size>256*1024*1024)throw new Error('한 번에 출력할 수 있는 파일 크기는 256MB입니다.');
    if(files.length===1){const file=files[0],extension=path.extname(file.name).slice(1);const result=await dialog.showSaveDialog(win,{title:'문서 파일 저장',defaultPath:safeName(file.name),filters:[{name:extension.toUpperCase(),extensions:[extension]}]});if(result.canceled||!result.filePath)return {cancelled:true};atomicWrite(result.filePath,Buffer.from(file.data));return {filePath:result.filePath};}
    const result=await dialog.showOpenDialog(win,{title:'페이지 이미지를 저장할 폴더 선택',properties:['openDirectory','createDirectory']});if(result.canceled||!result.filePaths.length)return {cancelled:true};const directory=result.filePaths[0];const existing=files.filter(file=>fs.existsSync(path.join(directory,safeName(file.name))));if(existing.length){const answer=await dialog.showMessageBox(win,{type:'question',message:`같은 이름의 파일 ${existing.length}개를 덮어쓸까요?`,buttons:['취소','덮어쓰기'],defaultId:0,cancelId:0});if(answer.response!==1)return {cancelled:true};}for(const file of files)atomicWrite(path.join(directory,safeName(file.name)),Buffer.from(file.data));return {filePath:directory};
  });
}
function installMenu() {
  const action = value => () => win?.webContents.send('studio:action', value);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'파일',submenu:[
      {label:'저장',accelerator:'CmdOrCtrl+S',click:action('save')},
      {label:'JSON 문서 내보내기',accelerator:'CmdOrCtrl+Shift+S',click:action('export')},
      {label:'JSON 문서 가져오기',accelerator:'CmdOrCtrl+O',click:action('open')},
      {type:'separator'},{label:'PDF 저장',click:action('pdf')},{label:'인쇄',accelerator:'CmdOrCtrl+P',click:action('print')},
      {label:'다른 형식으로 저장',submenu:[{label:'Word (.docx)',click:action('docx')},{label:'Excel (.xlsx)',click:action('xlsx')},{label:'PNG 이미지',click:action('png')},{label:'JPG 이미지',click:action('jpg')}]},
      {type:'separator'},{label:'데이터 폴더 열기',click:action('data-folder')},{role:'quit',label:'종료'},
    ]},
    {label:'편집',submenu:[{label:'실행 취소',accelerator:'CmdOrCtrl+Z',click:action('undo')},{label:'다시 실행',accelerator:'CmdOrCtrl+Y',click:action('redo')},{type:'separator'},{role:'cut',label:'잘라내기'},{role:'copy',label:'복사'},{role:'paste',label:'붙여넣기'},{role:'selectAll',label:'전체 선택'}]},
    {label:'보기',submenu:[{role:'reload',label:'다시 열기'},{role:'resetZoom',label:'앱 크기 초기화'},{role:'zoomIn',label:'앱 확대'},{role:'zoomOut',label:'앱 축소'},{role:'togglefullscreen',label:'전체 화면 전환'}]},
  ]));
}
async function createWindow() {
  win = new BrowserWindow({width:1560,height:1050,minWidth:900,minHeight:650,title:'문서 스튜디오',backgroundColor:'#e8eef2',show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  win.webContents.on('will-navigate', (event,url) => {if(url !== APP_URL) event.preventDefault();});
  win.webContents.on('will-prevent-unload', event => {
    const choice = dialog.showMessageBoxSync(win,{type:'warning',title:'저장 상태 확인',message:'편집 내용을 자동 저장하지 못했습니다.',detail:'돌아가서 JSON으로 내보내거나 저장을 다시 시도하세요.',buttons:['돌아가기','저장하지 않고 닫기'],defaultId:0,cancelId:0});
    if(choice===1)event.preventDefault();
  });
  win.webContents.session.setPermissionRequestHandler(async (contents,permission,callback) => {
    if(contents !== win.webContents || contents.getURL() !== APP_URL || permission !== 'local-fonts') { callback(false); return; }
    const result = await dialog.showMessageBox(win,{type:'question',title:'시스템 글꼴',message:'이 PC에 설치된 글꼴 목록을 불러올까요?',buttons:['불러오기','취소'],defaultId:0,cancelId:1});callback(result.response===0);
  });
  win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_details,callback)=>callback({cancel:true}));
  win.once('ready-to-show',()=>win.show());
  win.on('closed',()=>{win=null;});
  await win.loadURL(APP_URL);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
  app.whenReady().then(async () => {
    const directory=path.join(app.getAppPath(),'dist');
    protocol.handle('studio', request => {
      const url=new URL(request.url);let filename;
      try {filename=decodeURIComponent(url.pathname);}catch{return new Response('잘못된 경로',{status:400});}
      if(url.hostname!=='app'||!/^\/(?:index\.html|assets\/[\w.-]+)$/.test(filename))return new Response('찾을 수 없습니다.',{status:404});
      return net.fetch(pathToFileURL(path.join(directory,filename.slice(1))).href).then(response=>new Response(response.body,{status:response.status,headers:{'Content-Type':response.headers.get('content-type')||'application/octet-stream','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'"}}));
    });
    registerFiles();installMenu();await createWindow();
    app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
  }).catch(error=>{dialog.showErrorBox('문서 스튜디오 시작 실패',error.message);app.quit();});
  app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
}

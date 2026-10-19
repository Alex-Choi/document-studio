const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createStorage}=require('../desktop/storage.cjs');
const raw=value=>JSON.stringify({version:1,templates:[],documents:[],assets:[],draft:{mode:'template',doc:{name:value}}});
function temp(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'studio-storage-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return createStorage(dir);}
test('저장 결과 재읽기, 이전 버전 백업, 다시 열기',t=>{const s=temp(t);s.check();assert.equal(s.read(),null);s.write(raw('첫 자료'));s.write(raw('둘째 자료'));assert.equal(s.read(),raw('둘째 자료'));assert.equal(fs.readFileSync(s.previous,'utf8'),raw('첫 자료'));assert.equal(createStorage(s.directory).read(),raw('둘째 자료'));assert(!fs.readdirSync(s.directory).some(n=>n.endsWith('.tmp')));});
test('잘못된 저장 요청과 손상 자료 교체가 이전 정상 백업을 없애지 않음',t=>{const s=temp(t);s.write(raw('첫 자료'));s.write(raw('둘째 자료'));assert.throws(()=>s.write('{broken'));assert.equal(s.read(),raw('둘째 자료'));fs.writeFileSync(s.file,'broken');s.write(raw('복원'));assert.equal(fs.readFileSync(s.previous,'utf8'),raw('첫 자료'));assert.equal(s.read(),raw('복원'));});
test('쓰기 권한이 없으면 오류를 반환하고 기존 자료는 보존',t=>{const s=temp(t);s.write(raw('기존'));fs.chmodSync(s.directory,0o500);try{assert.throws(()=>s.write(raw('변경')));assert.equal(s.read(),raw('기존'));}finally{fs.chmodSync(s.directory,0o700);}});

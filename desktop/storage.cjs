const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const LIMIT = 40 * 1024 * 1024;
function validateRaw(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > LIMIT) throw new Error('문서 파일은 40MB 이하만 지원합니다.');
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.templates) || !Array.isArray(data.documents) || !Array.isArray(data.assets) || !data.draft?.doc || !['template','document'].includes(data.draft.mode)) throw new Error('문서 스튜디오 v1 자료가 아닙니다.');
  return raw;
}
function atomicWrite(file, data) {
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  fs.mkdirSync(path.dirname(file), {recursive:true});
  try {
    const fd = fs.openSync(temp, 'wx');
    try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temp, file);
    const read = fs.readFileSync(file);
    if (!read.equals(Buffer.from(data))) throw new Error('저장 결과를 확인하지 못했습니다.');
  } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
function createStorage(directory) {
  const file = path.join(directory, 'library.json');
  const previous = path.join(directory, 'library.previous.json');
  return {
    directory, file, previous,
    read() { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null; },
    check() {
      const probe = path.join(directory, `probe-${crypto.randomUUID()}`);
      try { atomicWrite(probe, '1'); } finally { if (fs.existsSync(probe)) fs.unlinkSync(probe); }
    },
    write(raw) {
      validateRaw(raw);
      if (fs.existsSync(file)) {
        const old = fs.readFileSync(file, 'utf8');
        let valid = true; try { validateRaw(old); } catch { valid = false; }
        // Keep the last readable backup when the user replaces a damaged library.
        if (valid && old !== raw) atomicWrite(previous, old);
      }
      atomicWrite(file, raw);
    },
  };
}
module.exports = {createStorage, atomicWrite, validateRaw, LIMIT};

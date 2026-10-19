import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Script } from 'node:vm';

let html = await readFile('dist/index.html','utf8');
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)];
if (scripts.length !== 1 || /type="module"/.test(scripts[0][0])) throw new Error('Preview requires one classic IIFE script.');
const source = scripts[0][1];
if (!/^\.\/assets\/[\w.-]+\.js$/.test(source)) throw new Error('Unexpected bundle path.');
const js = (await readFile(resolve('dist',source),'utf8')).replace(/<\/script/gi,'<\\/script');
new Script(js); // Validate the actual classic script before embedding it.
html = html.replace(scripts[0][0],'');
for (const match of [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)]) {
  if (!/^\.\/assets\/[\w.-]+\.css$/.test(match[1])) throw new Error('Unexpected stylesheet path.');
  const css = (await readFile(resolve('dist',match[1]),'utf8')).replace(/<\/style/gi,'<\\/style');
  html = html.replace(match[0],()=>`<style>${css}</style>`);
}
html = html.replace('</head>',`<meta name="document-studio-preview" content="standalone-v1" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'" />
</head>`).replace('</body>',()=>`<script>${js}</script></body>`);
// A callback is essential: literal $$ / $& in bundled JavaScript must never be substituted.
if (html.match(/<script>([\s\S]*)<\/script>/)?.[1] !== js) throw new Error('Inline script changed during embedding.');
if (/<script\b[^>]*\bsrc=|<link\b[^>]*href=|type="module"|<iframe/i.test(html)) throw new Error('External runtime dependency remains in preview.');
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/document-studio-preview.html',html);
console.log(`Single HTML preview: artifacts/document-studio-preview.html (${Buffer.byteLength(html).toLocaleString()} bytes)`);

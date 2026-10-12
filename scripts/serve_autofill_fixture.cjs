/* Local-only fixture server; dependencies are supplied from a temporary directory. */
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),deps=process.env.XIAOMAI_FIXTURE_DEPS;
if(!deps)throw Error('Set XIAOMAI_FIXTURE_DEPS to test-only node_modules');
http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(pathname==='/extension-popup-preview'){
  const html=fs.readFileSync(path.join(root,'autofill-extension/popup.html'),'utf8')
   .replace('href="popup.css"','href="/autofill-extension/popup.css"')
   .replace('<script src="popup.js"></script>','<script src="/scripts/fixtures/extension-ui-mock.js"></script><script src="/autofill-extension/popup.js"></script>');
  res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);
 }
 if(pathname==='/phoenix-runtime.js'){
  // Test-only runtime: register original vendor modules but never start the
  // recruitment app, load user forms, or call any recruiting APIs.
  const source=fs.readFileSync(path.join(deps,'phoenix/pcform.js'),'utf8');
  const marker='}(),function(){"use strict";var t;function e(t){return e=';
  const at=source.lastIndexOf(marker);
  if(at<0){res.writeHead(500);return res.end('Unexpected public runtime');}
  res.setHeader('Content-Type','application/javascript');
  return res.end(source.slice(0,at)+'}();window.phoenixRequire=s;}();');
 }
 const base=pathname.startsWith('/deps/')?deps:root;
 const file=path.resolve(base,'.'+(pathname.startsWith('/deps/')?pathname.slice(5):pathname));
 if(!file.startsWith(path.resolve(base)+path.sep)){res.writeHead(403);return res.end();}
 fs.readFile(file,(error,data)=>{
  if(error){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.js')?'application/javascript':'application/octet-stream');
  res.end(data);
 });
}).listen(18763,'127.0.0.1',()=>console.log('Fixture: http://127.0.0.1:18763/scripts/fixtures/autofill-antd.html'));

const {chromium}=require('@playwright/test');
const http=require('node:http');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');const evidence=path.resolve(root,'artifacts');
(async()=>{
 fs.mkdirSync(evidence,{recursive:true});
 const requests=[];const server=http.createServer((req,res)=>{
  requests.push(req.url);
  if(req.url==='/'){
   res.setHeader('Content-Type','text/html');res.end(`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-testnonce'; style-src 'self'; img-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none';"><link rel="stylesheet" href="/viewer.css"><header><button id="fit">Fit</button><label><input type="checkbox" id="wireframe">Wireframe</label><span id="status"></span></header><main id="viewport"></main><script nonce="testnonce" src="/viewer.js"></script>`);return;
  }
  if(!['/viewer.js','/viewer.css'].includes(req.url)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(root,'media/reviewed',req.url.slice(1))));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1000,height:750}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{window.__messages=[];window.acquireVsCodeApi=()=>({postMessage:m=>window.__messages.push(m)});});
 try{
  const origin=`http://127.0.0.1:${server.address().port}`;await page.goto(origin);await page.waitForFunction(()=>window.__messages.some(m=>m.type==='ready'));
  const send=async(format,bytes)=>page.evaluate(m=>window.postMessage(m,'*'),{type:'model',format,base64:Buffer.from(bytes).toString('base64')});
  await send('stl',fs.readFileSync(path.resolve(root,'tests/fixtures/cube.stl')));await page.waitForFunction(()=>window.__messages.some(m=>m.type==='rendered'&&m.triangles===12));
  await page.screenshot({path:path.join(evidence,'cube-preview.png')});
  await page.locator('#wireframe').check();await page.locator('#fit').click();
  await page.evaluate(()=>{const script=document.createElement('script');script.textContent='window.__injected=true';document.body.appendChild(script);window.postMessage({type:'eval',eval:'window.__injected=true'},'*');});
  assert.equal(await page.evaluate(()=>window.__injected),undefined);
  const blocked=await page.evaluate(async url=>{try{await fetch(url+'/must-not-fetch');return false}catch{return true}},origin);assert.ok(blocked);
  await send('stl',Buffer.from('not an stl'));await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Cannot preview'));
  const bomb=Buffer.alloc(84);bomb.writeUInt32LE(0xffffffff,80);await send('stl',bomb);await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Cannot preview'));
  const malicious='mtllib https://example.invalid/leak.mtl\no <img src=x onerror="window.__injected=true">\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n';
  await send('obj',Buffer.from(malicious));await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('OBJ'));
  assert.equal(await page.locator('img').count(),0);assert.equal(await page.evaluate(()=>window.__injected),undefined);
  const ply='ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n0 0 0\n1 0 0\n0 1 0\n3 0 1 2\n';
  await send('ply',Buffer.from(ply));await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('PLY'));
  assert.deepEqual(errors,[]);assert.ok(!requests.includes('/must-not-fetch'));assert.ok(requests.every(p=>['/','/viewer.js','/viewer.css'].includes(p)));
  const result={passed:true,checks:['12-triangle STL WebGL render','wireframe/fit controls','nonce CSP blocks inline script','eval messages ignored','connect-src blocks fetch','malformed STL','oversized binary count','OBJ name injection and external material ignored','PLY render'],requests};
  fs.writeFileSync(path.join(evidence,'browser-smoke.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});

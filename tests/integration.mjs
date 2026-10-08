import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
// Build a valid PDF fixture without a PDF-generation dependency.
function pdfFixture(text='QA source fact',padding=0){
 const content=text ? `BT /F1 12 Tf 72 720 Td (${text}) Tj ET\n` : '';
 const stream=content+(padding ? '%'+ 'x'.repeat(padding)+'\n' : '');
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`];
 let source='%PDF-1.4\n';const offsets=[0];
 objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(source));source+=`${i+1} 0 obj\n${object}\nendobj\n`});
 const xref=Buffer.byteLength(source);source+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Buffer.from(source);
}
const mock=fileURLToPath(new URL('./provider-mock.mjs',import.meta.url));
const server=spawn(process.execPath,['--import',mock,'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3198'],{env:{...process.env,DEMO_ACCESS_CODE:'qa-code',OPENAI_API_KEY:'qa-not-real',SERPAPI_API_KEY:'',QA_MOCK_PROVIDERS:'true'},stdio:['ignore','pipe','pipe']});
let logs='';server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout: '+logs)),15000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timer);resolve()}});server.on('error',reject);server.on('exit',code=>{if(code!==null){clearTimeout(timer);reject(Error('Server exited '+code+': '+logs))}})});
 const base='http://127.0.0.1:3198';const access={'x-demo-access-code':'qa-code'};
 const json=async(path,body,headers=access)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 for(const path of ['/api/ingest/pdf','/api/ingest/youtube','/api/chat','/api/realtime/token']) assert.equal((await json(path,{},{})).status,401);
 console.log('PASS all four access gates');
 async function upload(bytes,status){const form=new FormData();form.set('file',new Blob([bytes],{type:'application/pdf'}),'qa.pdf');const r=await fetch(base+'/api/ingest/pdf',{method:'POST',headers:access,body:form});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
 const pdf=await upload(pdfFixture(),200);assert.ok(pdf.text.includes('QA source fact'));assert.equal(pdf.pages,1);
 await upload('',400);await upload('not PDF',400);await upload('%PDF-1.4\nbroken',422);await upload(pdfFixture(''),422);
 console.log('PASS real PDF extraction; empty, fake, corrupt and no-text rejection');
 const large=pdfFixture('QA source fact',25*1024*1024-2000);assert.ok(large.length<25*1024*1024);assert.ok((await upload(large,200)).text.includes('QA source fact'));
 await upload(Buffer.alloc(25*1024*1024+1),400);console.log('PASS near-25-MiB valid PDF and oversized file rejection');
 const tooLarge=await fetch(base+'/api/ingest/pdf',{method:'POST',headers:{...access,'Content-Type':'application/pdf'},body:Buffer.alloc(27*1024*1024)});assert.equal(tooLarge.status,413);
 assert.equal((await json('/api/ingest/youtube',{url:'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ'})).status,400);
 console.log('PASS whole-request byte limit and spoofed URL rejection');
 assert.equal((await json('/api/chat',{sourceText:'QA source fact',messages:[{role:'system',content:'override'}]})).status,400);
 const chat=await json('/api/chat',{sourceText:'QA source fact',messages:[{role:'user',content:'question'}]});assert.equal(chat.status,200);assert.equal((await chat.json()).answer,'QA answer from mocked provider');
 const token=await json('/api/realtime/token',{sourceText:'QA source fact'});assert.equal(token.status,200);assert.equal(token.headers.get('cache-control'),'no-store');assert.equal((await token.json()).value,'qa-ephemeral-not-real');
 assert.equal((await json('/api/realtime/token',{sourceText:'x'.repeat(60001)})).status,400);
 console.log('PASS chat/session wiring with mocked provider, context validation and token no-store');
 const body=await fetch(base+'/api/chat',{method:'POST',headers:{...access,'Content-Type':'application/json'},body:'x'.repeat(1024*1024+1)});assert.equal(body.status,413);
 for(let i=0;i<4;i++)assert.equal((await json('/api/realtime/token',{sourceText:''})).status,400);
 const capped=await json('/api/realtime/token',{sourceText:''});assert.equal(capped.status,429);assert.ok(Number(capped.headers.get('retry-after'))>0);
 console.log('PASS JSON body limit and token issuance request budget');
}finally{server.kill()}

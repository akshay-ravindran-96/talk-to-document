import test from 'node:test';
import assert from 'node:assert/strict';
import {contextSections} from '../src/lib/context.ts';
import {limitedBody,limitedJson} from '../src/lib/request-body.ts';
import {createResourceLimits} from '../src/lib/resource-limits.ts';
test('long source sections preserve all content and stay inside budget',()=>{
 const text=('paragraph 🌍\n').repeat(12000);const sections=contextSections(text,1000);
 assert.equal(sections.join(''),text);assert.ok(sections.every(s=>s.length<=1000));assert.ok(sections.length>1);
 assert.ok(sections.every(s=>!/[\uD800-\uDBFF]$/.test(s)));assert.deepEqual(contextSections('short'),['short']);
});
test('request byte limit counts actual bytes even without Content-Length',async()=>{
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(6));c.enqueue(new Uint8Array(6));c.close()}});
 await assert.rejects(limitedBody(new Request('http://local',{method:'POST',body:stream,duplex:'half'}),10),{status:413});
 await assert.rejects(limitedBody(new Request('http://local',{method:'POST',body:'x',headers:{'content-length':'100'}}),10),{status:413});
});
test('valid bounded JSON remains readable',async()=>{
 assert.deepEqual(await limitedJson(new Request('http://local',{method:'POST',body:'{"ok":true}'}),100),{ok:true});
});
test('concurrent work is bounded and a released lease can be reused',()=>{
 const limits=createResourceLimits();const one=limits.enter('pdf',10,1);assert.equal(limits.enter('pdf',10,1).status,503);
 one.release();one.release();const two=limits.enter('pdf',10,1);assert.equal(typeof two.release,'function');two.release();
});
test('request budgets reset after a minute and do not share operation buckets',()=>{
 let now=0;const limits=createResourceLimits(()=>now);limits.enter('token',1,1).release();assert.equal(limits.enter('token',1,1).status,429);
 limits.enter('pdf',1,1).release();now=60000;assert.equal(typeof limits.enter('token',1,1).release,'function');
});

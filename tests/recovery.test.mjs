import test from 'node:test';
import assert from 'node:assert/strict';
import {createVoiceRecovery} from '../src/lib/voice-recovery.ts';
import {releaseVoiceResources, stopLateMicrophone} from '../src/lib/voice-resources.ts';
function harness(){
 let clock=0;let next=0;const timers=new Map();const calls=[];
 const recovery=createVoiceRecovery({probe:()=>{calls.push('probe');return true},recovering:()=>calls.push('recovering'),restored:()=>calls.push('restored'),lost:()=>calls.push('lost'),schedule:(fn,ms)=>{const id=++next;timers.set(id,{fn,at:clock+ms});return id},cancel:id=>timers.delete(id)});
 function advance(ms){clock+=ms;for(const [id,t] of [...timers])if(t.at<=clock){timers.delete(id);t.fn()}}
 return {recovery,calls,advance,timers};
}
test('idle recovery sends a probe and acknowledgement prevents timeout',()=>{
 const h=harness();h.recovery.interrupt();h.advance(9000);h.recovery.online();assert.deepEqual(h.calls,['recovering','probe']);
 h.advance(1000);h.recovery.received();h.advance(20000);assert.deepEqual(h.calls,['recovering','probe','restored']);assert.equal(h.timers.size,0);
});
test('long outage expires once; repeated disconnect events do not extend deadline',()=>{
 const h=harness();h.recovery.interrupt();h.advance(9000);h.recovery.interrupt();h.advance(1000);assert.deepEqual(h.calls,['recovering','lost']);
 h.advance(20000);assert.equal(h.calls.filter(c=>c==='lost').length,1);
});
test('online without a server response is not treated as restored',()=>{
 const h=harness();h.recovery.interrupt();h.recovery.online();h.advance(5000);assert.deepEqual(h.calls,['recovering','probe','lost']);
});
test('stop disposes recovery timers and ignores late events',()=>{
 const h=harness();h.recovery.interrupt();h.recovery.dispose();h.recovery.received();h.recovery.online();h.advance(20000);assert.deepEqual(h.calls,['recovering']);
});
test('stop removes callbacks, closes connections and releases every microphone track',()=>{
 let stopped=0,closed=0,paused=0;
 const channel={onopen:()=>{},onclose:()=>{},onmessage:()=>{},close:()=>closed++};
 const peer={onconnectionstatechange:()=>{},ontrack:()=>{},close:()=>closed++};
 const microphone={getTracks:()=>[{stop:()=>stopped++},{stop:()=>stopped++}]};
 const audio={srcObject:microphone,pause:()=>paused++};
 releaseVoiceResources({channel,peer,microphone,audio});assert.equal(stopped,2);assert.equal(closed,2);assert.equal(paused,1);assert.equal(audio.srcObject,null);assert.equal(channel.onopen,null);assert.equal(peer.ontrack,null);
});
test('late microphone grant after stop is immediately released',()=>{
 let stopped=0;const stream={getTracks:()=>[{stop:()=>stopped++}]};
 assert.equal(stopLateMicrophone(stream,1,2),true);assert.equal(stopped,1);assert.equal(stopLateMicrophone(stream,2,2),false);assert.equal(stopped,1);
});

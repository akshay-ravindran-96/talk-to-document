import test from 'node:test';
import assert from 'node:assert/strict';
import { retrieveTranscript, forceYoutubeFallback } from '../src/lib/transcript.ts';
const id = 'dQw4w9WgXcQ';
const fail = async () => { throw new Error('blocked'); };
test('direct success avoids paid provider', async () => {
 const result = await retrieveTranscript({ id, primary: async () => ' direct ', apiKey: 'test', fetcher: async () => { assert.fail('paid request'); } });
 assert.equal(result.text, 'direct'); assert.equal(result.fallbackUsed, false); assert.equal(result.attempts.length, 1);
});
test('failed or empty direct results recover through SerpApi', async () => {
 for (const primary of [fail, async () => ' ']) {
 let calls = 0;
 const result = await retrieveTranscript({ id, primary, apiKey: 'test', fetcher: async (url, init) => {
 calls++; assert.equal(url.origin, 'https://serpapi.com'); assert.equal(url.searchParams.get('v'), id);
 assert.equal(url.searchParams.get('engine'), 'youtube_video_transcript'); assert.equal(url.searchParams.get('api_key'), 'test');
 assert.ok(init.signal instanceof AbortSignal); assert.equal(url.searchParams.has('no_cache'), false);
 return Response.json({ search_metadata: { status: 'Success' }, transcript: [{ snippet: ' beginning ' }, { snippet: 'end' }] });
 } });
 assert.equal(calls, 1); assert.equal(result.text, 'beginning\nend'); assert.equal(result.provider, 'serpapi');
 assert.deepEqual(result.attempts.map(a => a.outcome), ['failed', 'success']);
 }
});
test('missing key disables fallback', async () => {
 await assert.rejects(retrieveTranscript({ id, primary: fail, fetcher: async () => assert.fail('request') }), { code: 'fallback_not_configured' });
});
test('quota, auth, provider errors, malformed and empty responses fail safely without retries', async () => {
 for (const response of [new Response('', {status:429}), new Response('', {status:401}), Response.json({error:'secret-provider-details'}), Response.json({transcript:[]}), Response.json({transcript:[{snippet:' '}]}), Response.json({transcript:[{text:'wrong schema'}]}), new Response('not json')]) {
 let calls=0;
 await assert.rejects(retrieveTranscript({ id, primary:fail, apiKey:'test', fetcher:async () => {calls++; return response;} }), {code:'all_providers_failed'});
 assert.equal(calls,1);
 }
});
test('network and timeout errors fail safely', async () => {
 await assert.rejects(retrieveTranscript({id,primary:fail,apiKey:'test',fetcher:async () => {throw new DOMException('timeout','TimeoutError');}}), {code:'all_providers_failed'});
});

test('demo flag applies only in development and requires exact true', () => {
 assert.equal(forceYoutubeFallback('development','true'),true);
 for (const environment of ['production','test',undefined]) assert.equal(forceYoutubeFallback(environment,'true'),false);
 for (const flag of ['false','TRUE','1','',undefined]) assert.equal(forceYoutubeFallback('development',flag),false);
});
test('simulated primary failure recovers through a real provider-shaped response', async () => {
 let primaryCalls=0;
 const forced=forceYoutubeFallback('development','true');
 const result=await retrieveTranscript({id,apiKey:'test',primary:async () => {
   if(forced) throw new Error('demo simulated failure');
   primaryCalls++; return 'direct';
 },fetcher:async () => Response.json({transcript:[{snippet:'backup captions'}]})});
 assert.equal(primaryCalls,0); assert.equal(result.fallbackUsed,true); assert.equal(result.text,'backup captions');
});

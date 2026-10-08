import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeId } from '../src/lib/youtube.ts';
const id = 'dQw4w9WgXcQ';
test('supported YouTube URL formats', () => {
  for (const url of [`https://youtu.be/${id}`, `https://www.youtube.com/watch?v=${id}&t=5`, `https://m.youtube.com/shorts/${id}`, `https://youtube.com/embed/${id}`]) assert.equal(youtubeId(url), id);
});
test('rejects unrelated hosts, credentials, protocols and invalid IDs', () => {
  for (const url of ['https://youtube.com.evil.test/watch?v='+id, 'https://example.com/'+id, 'http://youtu.be/'+id, 'https://user@youtu.be/'+id, 'https://youtu.be/short', 'not a url']) assert.throws(() => youtubeId(url));
});

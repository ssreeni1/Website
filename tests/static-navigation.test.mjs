import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { staticRscRoot } from '../build/static-rsc.ts';

test('static client navigation requests the exported Home payload, preserving queries and other routes', () => {
  const url = new URL('../node_modules/vinext/dist/server/app-rsc-cache-busting.js', import.meta.url);
  const source = readFileSync(url, 'utf8');
  const plugin = staticRscRoot();
  const transformed = plugin.transform.call({ environment: { name: 'client' } }, source, url.pathname);
  assert.ok(transformed, 'the current Vinext module must receive the compatibility fix');
  const start = transformed.code.indexOf('function toRscRequestPath(');
  const end = transformed.code.indexOf('async function createRscRequestUrl(', start);
  const requestPath = new Function(`${transformed.code.slice(start, end)}; return toRscRequestPath;`)();
  assert.equal(requestPath('/'), '/index.rsc');
  assert.equal(requestPath('/?qa=1#scene'), '/index.rsc?qa=1');
  assert.equal(requestPath('/about/'), '/about.rsc');
  assert.equal(requestPath('/collections/five-lines/#code'), '/collections/five-lines.rsc');
  assert.equal(plugin.transform.call({ environment: { name: 'rsc' } }, source, url.pathname), undefined);
  assert.equal(plugin.apply, 'build', 'do not change the live development endpoint');
});

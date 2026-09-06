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

test('Pages binary MIME is accepted only for same-origin RSC files', () => {
  const url = new URL('../node_modules/vinext/dist/server/app-browser-entry.js', import.meta.url);
  const source = readFileSync(url, 'utf8');
  const result = staticRscRoot().transform.call({ environment: { name: 'client' } }, source, url.pathname);
  const helper = result.code.slice(0, result.code.indexOf('\nimport '));
  const accepts = new Function('window', `${helper}; return __saneelRscType;`)({location:{href:'https://saneel.xyz/about/',origin:'https://saneel.xyz'}});
  assert.equal(accepts('text/x-component; charset=utf-8','https://saneel.xyz/about.rsc'),true);
  assert.equal(accepts('application/octet-stream','https://saneel.xyz/index.rsc?_rsc=1'),true);
  assert.equal(accepts('application/octet-stream','https://elsewhere.example/about.rsc'),false);
  assert.equal(accepts('application/octet-stream','https://saneel.xyz/file.bin'),false);
  assert.equal(accepts('text/html','https://saneel.xyz/about.rsc'),false);
});

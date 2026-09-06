import sharp from 'sharp';
import { ifPoem } from '../app/truth/if-poem.ts';

const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const poem = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="1600" viewBox="0 0 1280 1600">
<rect width="1280" height="1600" fill="#eee7d7"/>
<text x="146" y="144" font-family="Georgia" font-size="60" fill="#292721">If—</text>
<text x="148" y="196" font-family="Georgia" font-size="24" fill="#696255">Rudyard Kipling</text>
${ifPoem.flatMap((stanza, s) => stanza.map((line, l) => `<text x="${146 + (l % 2 ? 32 : 0)}" y="${286 + s * 310 + l * 34}" font-family="Georgia" font-size="29" fill="#292721">${escape(line)}</text>`)).join('')}
</svg>`;
for (const size of [640, 1280]) {
  await sharp(Buffer.from(poem)).resize(size).webp({quality:90}).toFile(`public/truth/if-${size}.webp`);
}
for (const [asset, path] of [
  ['judo', '/var/folders/pm/p3vmxldj5fx83fz2rf3nxs2c0000gn/T/codex-clipboard-dc9e22d4-fb06-4fc2-a87c-1c6990fe66c6.png'],
  ['figure-sun', '/var/folders/pm/p3vmxldj5fx83fz2rf3nxs2c0000gn/T/codex-clipboard-a9d5e6a9-977d-4345-ba21-b0e61a05a457.png'],
]) {
  for (const size of [640, 1280]) await sharp(path).resize({width:size,withoutEnlargement:true}).webp({quality:82}).toFile(`public/truth/${asset}-${size}.webp`);
}
for (const [asset, id] of [['good-life','0CWVgu2Odjg'],['unravel','sEQf5lcnj_o'],['momentum','6pmdglykhjE']]) {
  const response = await fetch(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);
  if (!response.ok) throw new Error(`Thumbnail ${id}: ${response.status}`);
  const image = Buffer.from(await response.arrayBuffer());
  for (const size of [640,1280]) await sharp(image).resize({width:size,withoutEnlargement:true}).webp({quality:82}).toFile(`public/truth/${asset}-${size}.webp`);
}

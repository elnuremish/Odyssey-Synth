// ИИ: Codex написал автономную сборку без зависимостей. README, запись №7.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const modules = ['config', 'characters', 'audio', 'score', 'traveler', 'view', 'app'];
const sources = await Promise.all(modules.map(name => read(`src/${name}.js`)));
// Only our flat, named-export modules are accepted; no runtime bundler is required.
const script = sources.map(source => source.replace(/^import .+;\n/gm, '').replace(/^export /gm, '')).join('\n');
let css = await read('src/styles.css');
const atlas = await readFile(new URL('assets/characters.png', root));
css = css.replace("url('../assets/characters.png')", `url('data:image/png;base64,${atlas.toString('base64')}')`);
let html = await read('index.html');
html = html.replace('<link rel="stylesheet" href="src/styles.css">', `<style>\n${css}\n</style>`);
html = html.replace('<script type="module" src="src/app.js"></script>', `<script>\n(() => {\n'use strict';\n${script}\n})();\n</script>`);
await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/Odyssey.html', root), html);
console.log(`Built ${fileURLToPath(new URL('dist/Odyssey.html', root))} (${Buffer.byteLength(html)} bytes)`);

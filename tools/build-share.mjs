// Собирает статические страницы share/*.html (превью ссылок в WhatsApp/Telegram и индексация в Google)
// и sitemap.xml. Запускается GitHub Actions каждый час и при каждом пуше: node tools/build-share.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SITE = 'https://zhoomart1999.github.io/avtobazar/';
const SUPABASE_URL = 'https://dbfbnywgvzdzjmcefrsh.supabase.co';
const KEY = 'sb_publishable_scfpiRlIpzy_y6hgSMKyGw_UhkhorNj';
const RATE = 87.4;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = n => Number(n).toLocaleString('ru-RU').replace(/ /g, ' ');
const abs = src => !src ? SITE + 'img/icons/icon-512.png' : /^https?:/.test(src) ? src : SITE + src;

async function rest(table, query) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`${table}: ${r.status}`);
  return r.json();
}

// демо-каталог генерируется теми же файлами, что и на сайте
const ctx = {};
vm.createContext(ctx);
vm.runInContext(['data.js', 'photos.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join(';\n') + ';this.R={generateListings,PHOTOS};', ctx);
const { generateListings, PHOTOS } = ctx.R;

function page({ title, desc, image, hash, h1, price, rows, text }) {
  const url = SITE + 'share/' + hash + '.html';
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Автобазар</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Автобазар">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary_large_image">
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:20px;color:#14161c}img{width:100%;border-radius:14px}a.btn{display:inline-block;background:#e11d2e;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700}dt{color:#8a90a0}dd{margin:0 0 6px;font-weight:600}</style>
<script>location.replace(${JSON.stringify('../#' + hash)});</script>
</head>
<body>
<h1>${esc(h1)}</h1>
<p style="font-size:26px;font-weight:800">${esc(price)}</p>
<img src="${esc(image)}" alt="${esc(h1)}">
<dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
<p>${esc(text)}</p>
<p><a class="btn" href="../#${esc(hash)}">Открыть на Автобазаре</a></p>
</body>
</html>
`;
}

const carPage = c => page({
  title: `${c.brand} ${c.model}, ${c.year} — $${fmt(c.price)}`,
  desc: `${c.city} · ${fmt(c.mileage)} км · ${c.gear} · ${c.fuel}. ${c.desc || ''}`.slice(0, 200),
  image: abs(c.img), hash: 'car-' + c.id, h1: `${c.brand} ${c.model}, ${c.year}`,
  price: `$${fmt(c.price)} ≈ ${fmt(Math.round(c.price * RATE / 1000) * 1000)} сом`,
  rows: [['Город', c.city], ['Пробег', fmt(c.mileage) + ' км'], ['Кузов', c.body], ['Коробка', c.gear], ['Топливо', c.fuel], ['Руль', c.wheel]],
  text: c.desc || ''
});

const out = path.join(ROOT, 'share');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
const urls = [];
const write = (name, html) => { fs.writeFileSync(path.join(out, name), html); urls.push(SITE + 'share/' + name); };

// демо-авто
for (const c of generateListings(420)) {
  const list = PHOTOS[`${c.brand}|${c.model}`] || [];
  write(`car-${c.id}.html`, carPage({ ...c, img: list.length ? list[c.id % list.length].src : '' }));
}
// настоящие объявления из базы
try {
  const [cars, parts, masters] = await Promise.all([
    rest('ab_cars', 'select=*&status=eq.active&order=created_at.desc&limit=2000'),
    rest('ab_parts', 'select=*&status=eq.active&order=created_at.desc&limit=2000'),
    rest('ab_masters', 'select=*&order=created_at.desc&limit=1000')
  ]);
  for (const r of cars) write(`car-${2e6 + r.id}.html`, carPage({ ...r, id: 2e6 + r.id, desc: r.descr, gear: r.gear || '', fuel: r.fuel || '', body: r.body || '', wheel: r.wheel || '', img: r.photos[0] }));
  for (const r of parts) write(`part-${3e6 + r.id}.html`, page({
    title: `${r.title} — ${fmt(r.price)} сом`, desc: `${r.cond} · ${r.city}. ${r.descr || ''}`.slice(0, 200), image: abs(r.photo),
    hash: 'part-' + (3e6 + r.id), h1: r.title, price: `${fmt(r.price)} сом`,
    rows: [['Состояние', r.cond], ['Город', r.city], ['Совместимость', r.brand ? `${r.brand} ${r.model}` : 'универсальная']], text: r.descr || ''
  }));
  for (const r of masters) write(`master-${4e6 + r.id}.html`, page({
    title: `${r.name} — ${r.city}`, desc: `${r.services.slice(0, 4).map(s => s.name).join(', ')}. ${r.addr}`.slice(0, 200), image: abs(r.photo),
    hash: 'master-' + (4e6 + r.id), h1: r.name, price: r.services.length ? `от ${fmt(Math.min(...r.services.map(s => s.price || 0)))} сом` : '',
    rows: [['Город', r.city], ['Адрес', r.addr], ['Часы работы', r.hours], ['Опыт', r.years + ' лет']], text: r.services.map(s => `${s.name}${s.price ? ' — ' + fmt(s.price) + ' сом' : ''}`).join('; ')
  }));
} catch (e) { console.error('База недоступна, собраны только демо-страницы:', e.message); }

const today = new Date().toISOString().slice(0, 10);
const all = [SITE, SITE + 'terms.html', SITE + 'privacy.html', SITE + 'rules.html', ...urls];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map(u => `  <url><loc>${esc(u)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`);
console.log(`share pages: ${urls.length}`);

(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const PAGE = 12;
  const CITY_IN = {
    'Бишкек': 'Бишкеке', 'Ош': 'Оше', 'Жалал-Абад': 'Жалал-Абаде', 'Каракол': 'Караколе', 'Токмок': 'Токмоке',
    'Нарын': 'Нарыне', 'Талас': 'Таласе', 'Баткен': 'Баткене', 'Кара-Балта': 'Кара-Балте', 'Чолпон-Ата': 'Чолпон-Ате'
  };

  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }
  };

  const ALL = SHOW_DEMO ? generateListings(420) : [];
  const favs = new Set(store.get('unaa_favs', []));

  const state = { f: {}, city: store.get('unaa_city', ''), sort: 'date', view: 'grid', page: 1, favOnly: false, showAllBrands: false };

  // ---------- helpers ----------
  const fmt = n => n.toLocaleString('ru-RU').replace(/,/g, ' ');
  const usd = n => '$' + fmt(n);
  const som = n => fmt(Math.round(n * RATE / 1000) * 1000) + ' сом';
  const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
  const ago = t => {
    const m = Math.floor((Date.now() - t) / 60000);
    if (m < 60) return `${Math.max(1, m)} мин назад`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ${plural(h, 'час', 'часа', 'часов')} назад`;
    const d = Math.floor(h / 24);
    return d === 1 ? 'вчера' : `${d} ${plural(d, 'день', 'дня', 'дней')} назад`;
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    const f = v => Math.max(0, Math.min(255, Math.round(v + amt * (amt > 0 ? 255 - v : v))));
    return '#' + [f(n >> 16), f(n >> 8 & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
  };
  const toast = msg => {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400);
  };
  const fillSelect = (sel, items, first) => {
    sel.innerHTML = (first != null ? `<option value="">${first}</option>` : '') + items.map(v => `<option>${esc(v)}</option>`).join('');
  };

  // ---------- car illustration ----------
  const SHAPES = {
    'Седан':       { body: 'M42 206 Q38 176 62 170 L120 164 L355 166 Q372 170 368 206 Z', cab: 'M118 166 L160 126 Q168 120 182 120 L256 120 Q270 120 280 130 L316 166 Z', w: [112, 292], r: 27 },
    'Хэтчбек':     { body: 'M70 206 Q64 176 86 170 L130 164 L330 164 Q344 168 342 206 Z', cab: 'M118 166 L156 122 Q164 116 178 116 L288 116 Q302 116 306 130 L320 166 Z', w: [128, 286], r: 27 },
    'Универсал':   { body: 'M42 206 Q38 176 62 170 L120 164 L355 164 Q370 168 368 206 Z', cab: 'M118 166 L158 124 Q166 118 180 118 L330 118 Q344 118 346 132 L352 166 Z', w: [112, 296], r: 27 },
    'Кроссовер':   { body: 'M48 212 Q42 172 66 166 L112 160 L352 160 Q368 164 366 212 Z', cab: 'M108 162 L146 112 Q152 104 166 104 L314 104 Q328 104 334 116 L348 162 Z', w: [114, 296], r: 31 },
    'Внедорожник': { body: 'M44 214 Q40 170 62 164 L104 158 L356 158 Q370 160 368 214 Z', cab: 'M100 160 L134 102 Q140 94 154 94 L330 94 Q346 94 350 108 L356 160 Z', w: [112, 298], r: 33 },
    'Минивэн':     { body: 'M50 212 Q44 172 66 166 L92 160 L352 160 Q368 164 366 212 Z', cab: 'M84 164 L124 98 Q130 88 146 88 L334 88 Q350 88 352 104 L356 164 Z', w: [116, 300], r: 29 },
    'Пикап':       { body: 'M40 214 Q36 172 60 166 L100 160 L364 160 L366 214 Z', cab: 'M98 162 L130 106 Q136 98 150 98 L226 98 Q236 98 238 110 L240 162 Z', w: [110, 304], r: 33 },
    'Микроавтобус': { body: 'M44 214 L44 170 L360 170 Q370 172 368 214 Z', cab: 'M44 172 L50 98 Q54 82 74 82 L334 82 Q356 82 360 104 L366 172 Z', w: [108, 300], r: 29 }
  };
  const SCENES = [
    ['#dfe9f5', '#f6f8fb', '#c9d6e6', '#aebfd4'],
    ['#ffe3cf', '#fff4ea', '#e9c4b0', '#d4a690'],
    ['#e3efe6', '#f5faf6', '#c6dccb', '#a9c7b1'],
    ['#ece6f6', '#f8f6fc', '#d4cbe6', '#b9acd6'],
    ['#2a2f3d', '#3c4255', '#363b4d', '#2a2e3d']
  ];
  let uid = 0;
  function carSVG(car, v = 0) {
    const s = SHAPES[car.body] || SHAPES['Седан'];
    const col = COLORS[car.color] || '#888';
    const sc = v === 4 ? SCENES[4] : SCENES[(car.id + v) % 4];
    const id = 'g' + (++uid);
    const flip = v % 2 === 1;
    const zoom = v === 2;
    const t = flip ? 'translate(400 0) scale(-1 1)' : '';
    const z = zoom ? 'translate(-150 -120) scale(1.6)' : '';
    const wheel = x => `<g transform="translate(${x} ${214 + (33 - s.r) * 0.2})">
        <circle r="${s.r}" fill="#1b1d22"/><circle r="${s.r * .62}" fill="url(#${id}r)"/>
        ${[0, 72, 144, 216, 288].map(a => `<rect x="-2.5" y="${-s.r * .58}" width="5" height="${s.r * .44}" rx="2" fill="#5b616e" transform="rotate(${a})"/>`).join('')}
        <circle r="${s.r * .16}" fill="#2a2d34"/></g>`;
    return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(car.brand + ' ' + car.model)}">
      <defs>
        <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sc[0]}"/><stop offset="1" stop-color="${sc[1]}"/></linearGradient>
        <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(col, .28)}"/><stop offset=".55" stop-color="${col}"/><stop offset="1" stop-color="${shade(col, -.35)}"/></linearGradient>
        <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fb4cc"/><stop offset=".5" stop-color="#2c3644"/><stop offset="1" stop-color="#1a2029"/></linearGradient>
        <clipPath id="${id}c"><path d="${s.cab}"/></clipPath>
        <radialGradient id="${id}r"><stop offset="0" stop-color="#d9dde4"/><stop offset="1" stop-color="#8d939e"/></radialGradient>
      </defs>
      <rect width="400" height="300" fill="url(#${id}s)"/>
      <path d="M0 190 L60 120 L100 150 L160 80 L215 140 L260 105 L330 160 L400 110 L400 230 L0 230Z" fill="${sc[2]}"/>
      <path d="M160 80 L145 98 L158 95 L168 104 L176 94 Z M260 105 L248 118 L262 114 L272 120 Z" fill="#fff" opacity=".7"/>
      <path d="M0 210 L80 170 L150 195 L240 160 L320 190 L400 165 L400 240 L0 240Z" fill="${sc[3]}"/>
      <rect y="232" width="400" height="68" fill="${v === 4 ? '#22252f' : '#d7dbe2'}"/>
      <rect y="232" width="400" height="3" fill="#000" opacity=".06"/>
      <g transform="${z}"><g transform="${t}">
        <ellipse cx="205" cy="246" rx="175" ry="12" fill="#000" opacity=".22"/>
        <path d="${s.cab}" fill="url(#${id}b)"/>
        <path d="${s.cab}" fill="url(#${id}g)" transform="translate(${centroid(s.cab).join(' ')}) scale(.86 .78) translate(${centroid(s.cab).map(n => -n).join(' ')}) translate(0 6)"/>
        <rect x="${centroid(s.cab)[0] - 4}" y="70" width="9" height="110" fill="url(#${id}b)" clip-path="url(#${id}c)"/>
        <path d="${s.body}" fill="url(#${id}b)"/>
        <path d="M60 186 L360 186" stroke="${shade(col, -.25)}" stroke-width="2" opacity=".6"/>
        <rect x="350" y="174" width="16" height="8" rx="3" fill="#fff7d6"/>
        <rect x="44" y="176" width="12" height="8" rx="3" fill="#e0262f"/>
        ${wheel(s.w[0])}${wheel(s.w[1])}
      </g></g>
    </svg>`;
  }
  // Реальные фото модели (Wikimedia Commons); у каждого объявления свой порядок, чтобы обложки различались
  function photosOf(car) {
    if (car.imgs && car.imgs.length) return car.imgs.map(src => ({ src }));
    const list = (typeof PHOTOS !== 'undefined' && PHOTOS[`${car.brand}|${car.model}`]) || [];
    const k = list.length ? car.id % list.length : 0;
    return [...list.slice(k), ...list.slice(0, k)];
  }
  function cover(car) {
    const p = photosOf(car)[0];
    return p ? `<img src="${p.src}" alt="${esc(car.brand + ' ' + car.model)}" loading="lazy" decoding="async">` : carSVG(car);
  }
  function gallery(car) {
    const ph = photosOf(car);
    const slides = ph.length ? ph.map(p => ({ html: `<img src="${p.src}" alt="${esc(car.brand + ' ' + car.model)}">`, credit: p }))
      : [0, 1, 2, 3, 4].map(v => ({ html: carSVG(car, v) }));
    const credit = p => p && p.page ? `<a href="${p.page}" target="_blank" rel="noopener">Фото: ${esc(p.author)} · ${esc(p.license)}</a>` : '';
    return {
      html: `<div class="detail__main" data-main>${slides[0].html}<div class="credit" data-credit>${credit(slides[0].credit)}</div></div>
        <div class="detail__thumbs">${slides.map((s, i) => `<button class="${i ? '' : 'active'}" data-v="${i}" aria-label="Фото ${i + 1}">${s.html}</button>`).join('')}</div>`,
      bind(root) {
        $('.detail__thumbs', root).addEventListener('click', e => {
          const b = e.target.closest('[data-v]'); if (!b) return;
          $$('.detail__thumbs button', root).forEach(x => x.classList.toggle('active', x === b));
          const s = slides[+b.dataset.v];
          $('[data-main]', root).innerHTML = s.html + `<div class="credit">${credit(s.credit)}</div>`;
        });
      }
    };
  }
  function centroid(d) {
    const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
    let x = 0, y = 0, k = 0;
    for (let i = 0; i + 1 < nums.length; i += 2) { x += nums[i]; y += nums[i + 1]; k++; }
    return [Math.round(x / k), Math.round(y / k)];
  }

  // ---------- filters ----------
  const form = $('#searchForm');
  const brandSel = $('#fBrand'), modelSel = $('#fModel');
  const brandNames = Object.keys(BRANDS).sort();
  fillSelect(brandSel, brandNames, 'Любая');
  fillSelect(form.body, BODIES, 'Любой');
  fillSelect(form.fuel, FUELS, 'Любое');
  fillSelect(form.gear, GEARS, 'Любая');

  const citySel = $('#citySelect');
  citySel.innerHTML = '<option value="">Все города</option>' + CITIES.map(c => `<option>${c}</option>`).join('');
  citySel.value = state.city;

  function syncModels() {
    const b = brandSel.value;
    modelSel.disabled = !b;
    fillSelect(modelSel, b ? BRANDS[b].m.map(m => m[0]) : [], 'Любая');
  }
  brandSel.addEventListener('change', syncModels);

  function readForm() {
    const d = new FormData(form);
    const f = {};
    for (const [k, v] of d) if (v !== '') f[k] = v;
    return f;
  }
  function writeForm(f) {
    form.reset();
    brandSel.value = f.brand || ''; syncModels(); modelSel.value = f.model || '';
    for (const k of ['yearFrom', 'yearTo', 'priceFrom', 'priceTo', 'body', 'fuel', 'gear']) form[k].value = f[k] || '';
    $$('input[name="wheel"]', form).forEach(r => r.checked = r.value === (f.wheel || ''));
    form.cleared.checked = !!f.cleared; form.photo.checked = !!f.photo; form.exchange.checked = !!f.exchange;
  }

  function matches(c, f, city) {
    if (city && c.city !== city) return false;
    if (f.brand && c.brand !== f.brand) return false;
    if (f.model && c.model !== f.model) return false;
    if (f.yearFrom && c.year < +f.yearFrom) return false;
    if (f.yearTo && c.year > +f.yearTo) return false;
    if (f.priceFrom && c.price < +f.priceFrom) return false;
    if (f.priceTo && c.price > +f.priceTo) return false;
    if (f.body && c.body !== f.body) return false;
    if (f.fuel && c.fuel !== f.fuel) return false;
    if (f.gear && c.gear !== f.gear) return false;
    if (f.wheel && c.wheel !== f.wheel) return false;
    if (f.cleared && !c.cleared) return false;
    if (f.exchange && !c.exchange) return false;
    return true;
  }
  const SORTS = {
    date: (a, b) => (b.top - a.top) || b.created - a.created,
    priceAsc: (a, b) => a.price - b.price,
    priceDesc: (a, b) => b.price - a.price,
    yearDesc: (a, b) => b.year - a.year || a.price - b.price,
    mileAsc: (a, b) => a.mileage - b.mileage
  };
  const results = () => ALL.filter(c => (!state.favOnly || favs.has(c.id)) && matches(c, state.f, state.city)).sort(SORTS[state.sort]);

  // live count on the button
  function updateCount() {
    const n = ALL.filter(c => matches(c, readForm(), state.city)).length;
    $('#showBtn').textContent = n ? `Показать ${fmt(n)} ${plural(n, 'объявление', 'объявления', 'объявлений')}` : 'Ничего не найдено';
  }
  form.addEventListener('input', updateCount);
  form.addEventListener('change', updateCount);

  form.addEventListener('submit', e => {
    e.preventDefault();
    state.f = readForm(); state.page = 1; state.favOnly = false;
    DB.log('search', [state.f.brand, state.f.model, state.f.body, state.f.priceTo && 'до $' + state.f.priceTo].filter(Boolean).join(' ') || 'все');
    render(); $('#listings').scrollIntoView({ behavior: 'smooth' });
  });
  $('#toggleExtra').addEventListener('click', e => {
    form.classList.toggle('expanded');
    e.target.textContent = form.classList.contains('expanded') ? 'Скрыть параметры' : 'Расширенный поиск';
  });
  const resetAll = () => { state.f = {}; state.favOnly = false; state.page = 1; writeForm({ photo: 'on' }); render(); };
  $('#resetForm').addEventListener('click', resetAll);
  $('#emptyReset').addEventListener('click', resetAll);

  citySel.addEventListener('change', () => { state.city = citySel.value; store.set('unaa_city', state.city); state.page = 1; render(); });
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; state.page = 1; render(); });
  $$('.view-switch .icon-btn').forEach(b => b.addEventListener('click', () => {
    state.view = b.dataset.view;
    $$('.view-switch .icon-btn').forEach(x => x.classList.toggle('active', x === b));
    render();
  }));
  $('#loadMore').addEventListener('click', () => { state.page++; render(true); });

  // ---------- render ----------
  const CHIP_LABEL = {
    brand: v => v, model: v => v, yearFrom: v => `год от ${v}`, yearTo: v => `год до ${v}`,
    priceFrom: v => `от $${fmt(+v)}`, priceTo: v => `до $${fmt(+v)}`, body: v => v, fuel: v => v, gear: v => v,
    wheel: v => `${v} руль`, cleared: () => 'Растаможен', exchange: () => 'Обмен'
  };

  function card(c) {
    const fav = favs.has(c.id);
    const fresh = Date.now() - c.created < 864e5;
    const mark = c.market < .12 ? '<span class="price-mark great">Отличная цена</span>' : c.market < .3 ? '<span class="price-mark good">Хорошая цена</span>' : '';
    const engine = c.fuel === 'Электро' ? (c.hp ? `${c.hp} л.с.` : 'электро') : `${c.engine.toFixed(1)} л${c.hp ? `, ${c.hp} л.с.` : ''}`;
    return `<article class="card" data-id="${c.id}">
      <div class="card__media">${cover(c)}
        <div class="card__tags">${lotByCar(c.id) ? '<span class="tag tag--auc">🔨 Аукцион</span>' : ''}${c.top ? '<span class="tag tag--top">ТОП</span>' : ''}${fresh ? '<span class="tag tag--new">Новое</span>' : ''}${c.wheel === 'Правый' ? '<span class="tag">Правый руль</span>' : ''}</div>
        <button class="card__fav ${fav ? 'on' : ''}" data-fav="${c.id}" aria-label="В избранное"><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.5-9-9.5C1.7 7 4 4 7 4c2 0 3.5 1.2 5 3 1.5-1.8 3-3 5-3 3 0 5.3 3 4 6.5-2 5-9 9.5-9 9.5z"/></svg></button>
        <span class="card__photos">📷 ${photosOf(c).length || c.photos}</span>
      </div>
      <div class="card__body">
        <div class="card__title">${esc(c.brand)} ${esc(c.model)}<span>, ${c.year}</span></div>
        <div><span class="card__price">${usd(c.price)}</span><span class="card__som">${som(c.price)}</span>${mark}</div>
        <div class="card__specs">${engine}, ${c.gear.toLowerCase()}, ${c.fuel.toLowerCase()}, ${fmt(c.mileage)} км</div>
        <div class="card__desc">${esc(c.desc)}</div>
        <div class="card__foot"><span>${c.city}${c.cleared ? '' : ' · не растаможен'}</span><span>${ago(c.created)}</span></div>
      </div>
    </article>`;
  }

  function render(append = false) {
    const list = results();
    const shown = list.slice(0, state.page * PAGE);
    const cards = $('#cards');
    cards.classList.toggle('list', state.view === 'list');
    if (append) {
      cards.insertAdjacentHTML('beforeend', shown.slice((state.page - 1) * PAGE).map(card).join(''));
    } else {
      cards.innerHTML = shown.map(card).join('');
    }
    $('#empty').hidden = list.length > 0;
    const left = list.length - shown.length;
    $('#loadMore').hidden = left <= 0;
    $('#loadMore').textContent = `Показать ещё ${Math.min(PAGE, left)} из ${fmt(left)}`;

    const f = state.f;
    const name = f.brand ? `${f.brand}${f.model ? ' ' + f.model : ''}` : '';
    $('#listTitle').textContent = state.favOnly ? `Избранное · ${list.length}`
      : name ? `${name} · ${fmt(list.length)}` : Object.keys(f).some(k => k !== 'photo') ? `Найдено ${fmt(list.length)}` : 'Свежие объявления';

    $('#chips').innerHTML = (state.favOnly ? `<span class="chip">❤ Избранное<button data-chip="fav" aria-label="Убрать"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></span>` : '') +
      Object.entries(f).filter(([k]) => CHIP_LABEL[k]).map(([k, v]) =>
        `<span class="chip">${esc(CHIP_LABEL[k](v))}<button data-chip="${k}" aria-label="Убрать"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></span>`).join('');

    const inCity = ALL.filter(c => !state.city || c.city === state.city).length;
    $('#totalCount').textContent = fmt(inCity);
    $('#heroCity').textContent = state.city ? CITY_IN[state.city] : 'Кыргызстане';
    renderBrands();
    updateCount();
    maybeRemoteCars();
  }

  $('#chips').addEventListener('click', e => {
    const b = e.target.closest('[data-chip]'); if (!b) return;
    const k = b.dataset.chip;
    if (k === 'fav') state.favOnly = false;
    else { delete state.f[k]; if (k === 'brand') delete state.f.model; }
    writeForm(state.f); state.page = 1; render();
  });

  // ---------- brands ----------
  function renderBrands() {
    const counts = {};
    ALL.forEach(c => { if (!state.city || c.city === state.city) counts[c.brand] = (counts[c.brand] || 0) + 1; });
    const sorted = Object.keys(BRANDS).sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
    const list = state.showAllBrands ? sorted : sorted.slice(0, 8);
    const grid = $('#brandGrid');
    grid.classList.toggle('all', state.showAllBrands);
    grid.innerHTML = list.map(b => `<button class="brand ${state.f.brand === b ? 'active' : ''}" data-brand="${esc(b)}">
      <span class="brand__logo" style="background:${BRANDS[b].c}">${esc(b.replace(/[^A-Za-zА-я]/g, '').slice(0, 2).toUpperCase())}</span>
      <span class="brand__name">${esc(b)}</span><span class="brand__count">${fmt(counts[b] || 0)}</span></button>`).join('');
    $('#allBrands').textContent = state.showAllBrands ? 'Свернуть' : `Все марки (${Object.keys(BRANDS).length})`;
  }
  $('#brandGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-brand]'); if (!b) return;
    const brand = b.dataset.brand;
    state.f = state.f.brand === brand ? {} : { brand };
    state.page = 1; state.favOnly = false; writeForm(state.f); render();
    $('#listings').scrollIntoView({ behavior: 'smooth' });
  });
  $('#allBrands').addEventListener('click', () => { state.showAllBrands = !state.showAllBrands; renderBrands(); });

  // nav shortcuts
  $$('.nav__link').forEach(a => a.addEventListener('click', () => {
    $$('.nav__link').forEach(x => x.classList.toggle('active', x === a));
    $('#nav').classList.remove('open');
    if (a.dataset.body || a.dataset.fuel) {
      state.f = a.dataset.body ? { body: a.dataset.body } : { fuel: a.dataset.fuel };
      state.page = 1; writeForm(state.f); render();
    }
  }));
  $('#burger').addEventListener('click', () => $('#nav').classList.toggle('open'));

  // ---------- favorites ----------
  function toggleFav(id) {
    favs.has(id) ? favs.delete(id) : favs.add(id);
    store.set('unaa_favs', [...favs]);
    if (DB.user) (favs.has(id) ? DB.sb.from('ab_favs').upsert({ user_id: DB.user.id, item_id: id }) : DB.sb.from('ab_favs').delete().eq('user_id', DB.user.id).eq('item_id', id)).then(() => { });
    $$(`[data-fav="${id}"]`).forEach(b => b.classList.toggle('on', favs.has(id)));
    updateFavCount();
    toast(favs.has(id) ? 'Добавлено в избранное' : 'Удалено из избранного');
    if (state.favOnly) render();
  }
  function updateFavCount() { const b = $('#favCount'); b.textContent = favs.size; b.dataset.n = favs.size; }
  const showFavs = () => {
    if (!favs.size) return toast('В избранном пока пусто — нажмите ♡ на объявлении');
    state.favOnly = true; state.page = 1; render(); $('#listings').scrollIntoView({ behavior: 'smooth' });
  };
  $('#favToggle').addEventListener('click', showFavs);
  $('#navFav').addEventListener('click', e => { e.preventDefault(); showFavs(); });

  $('#cards').addEventListener('click', e => {
    const f = e.target.closest('[data-fav]');
    if (f) { e.stopPropagation(); return toggleFav(+f.dataset.fav); }
    const c = e.target.closest('.card');
    if (!c) return;
    const lot = lotByCar(+c.dataset.id);
    location.hash = lot ? 'lot-' + lot.id : 'car-' + c.dataset.id;
  });

  // ---------- modals ----------
  function openModal(m) { m.hidden = false; document.body.classList.add('lock'); }
  function closeModal(m) {
    m.hidden = true;
    if ($$('.modal, .drawer').every(x => x.hidden)) document.body.classList.remove('lock');
    if (/^#(car|lot|part|master)-/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
    if (m.id === 'lotModal') openLotId = null;
    if (m.id === 'masterModal') openMasterId = null;
    if (['postModal', 'partPostModal', 'becomeModal'].includes(m.id)) stopEdit();
    if (m.id === 'chatModal') openChat = null;
  }
  $$('.modal, .drawer').forEach(m => m.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(m); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.modal:not([hidden]), .drawer:not([hidden])').forEach(closeModal); });

  function showCar(id) {
    const c = ALL.find(x => x.id === id);
    if (!c) return;
    DB.log('car', `${c.brand} ${c.model} ${c.year} #${c.id}`);
    const engine = c.fuel === 'Электро' ? 'электро' : `${c.engine.toFixed(1)} л`;
    const specs = [
      ['Год выпуска', c.year], ['Пробег', `${fmt(c.mileage)} км`], ['Кузов', c.body], ['Двигатель', `${engine}${c.hp ? `, ${c.hp} л.с.` : ''}`],
      ['Топливо', c.fuel], ['Коробка', c.gear], ['Привод', c.drive], ['Руль', c.wheel], ['Цвет', c.color],
      ['Растаможка', c.cleared ? 'Растаможен в КР' : 'Не растаможен'], ['Обмен', c.exchange ? 'Возможен' : 'Не интересует'], ['Город', c.city]
    ];
    const fav = favs.has(c.id);
    const gal = gallery(c);
    $('#carDetail').innerHTML = `<div class="detail">
      <div class="detail__gallery">${gal.html}</div>
      <div class="detail__info">
        <h2 class="detail__title">${esc(c.brand)} ${esc(c.model)}, ${c.year}</h2>
        <div class="detail__price">${usd(c.price)}<small>≈ ${som(c.price)}</small></div>
        <dl class="specs">${specs.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        <p class="detail__desc">${esc(c.desc)}</p>
        ${partsFor(c.brand, c.model) ? `<button class="parts-link" data-parts-for="${esc(c.brand)}|${esc(c.model)}">🔧 Запчасти для ${esc(c.brand)} ${esc(c.model)} <b>${partsFor(c.brand, c.model)}</b><span>→</span></button>` : ''}
        <div class="seller">
          <div class="seller__ava" style="background:${BRANDS[c.brand].c}">${esc(c.seller.replace(/Автосалон «/, '')[0])}</div>
          <div><div class="seller__name">${esc(c.seller)}</div><div class="seller__meta">${c.dealer ? 'Автосалон · проверенный продавец' : 'Частное лицо'} · ${ago(c.created)} · 👁 ${fmt(c.views)}</div></div>
        </div>
        <div class="detail__actions">
          <button class="btn btn--primary btn--lg" id="phoneBtn">Показать телефон</button>
          <button class="btn btn--ghost btn--lg" id="dFav" aria-label="В избранное">${fav ? '❤️' : '🤍'}</button>
          <a class="btn btn--wa btn--lg" target="_blank" rel="noopener" href="https://wa.me/${c.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Здравствуйте! Интересует ${c.brand} ${c.model} ${c.year} за ${usd(c.price)} (Автобазар)`)}">WhatsApp</a>
          <button class="btn btn--ghost btn--lg" id="shareBtn" aria-label="Поделиться">↗</button>
        </div>
        ${extraActions('car', c)}
      </div>
    </div>`;
    const m = $('#carModal');
    gal.bind(m);
    $('#phoneBtn').addEventListener('click', e => {
      const b = e.currentTarget;
      if (b.tagName === 'BUTTON' && !b.dataset.shown) { b.dataset.shown = 1; b.textContent = c.phone; }
      else location.href = 'tel:' + c.phone.replace(/\s/g, '');
    });
    $('#dFav').addEventListener('click', e => { toggleFav(c.id); e.currentTarget.textContent = favs.has(c.id) ? '❤️' : '🤍'; });
    $('#shareBtn').addEventListener('click', async () => {
      const url = shareUrl('car', c.id);
      try {
        if (navigator.share) await navigator.share({ title: `${c.brand} ${c.model}`, url });
        else { await navigator.clipboard.writeText(url); toast('Ссылка скопирована'); }
      } catch { }
    });
    openModal(m);
    $('.modal__box', m).scrollTop = 0;
  }
  function route() {
    const m = location.hash.match(/^#car-(\d+)$/);
    const l = location.hash.match(/^#lot-(\d+)$/);
    const pm = location.hash.match(/^#part-(\d+)$/);
    const mm = location.hash.match(/^#master-(\d+)$/);
    if (mm) showMaster(+mm[1]);
    else if (!$('#masterModal').hidden) closeModal($('#masterModal'));
    if (pm) showPart(+pm[1]);
    else if (!$('#partModal').hidden) closeModal($('#partModal'));
    if (m) showCar(+m[1]);
    else if (!$('#carModal').hidden) closeModal($('#carModal'));
    if (l) showLot(+l[1]);
    else if (!$('#lotModal').hidden) closeModal($('#lotModal'));
  }
  window.addEventListener('hashchange', route);

  // ---------- post ad ----------
  const pf = $('#postForm');
  fillSelect($('#pBrand'), brandNames);
  const syncPModels = () => fillSelect($('#pModel'), BRANDS[$('#pBrand').value].m.map(m => m[0]));
  $('#pBrand').addEventListener('change', syncPModels); syncPModels();
  fillSelect($('#pBody'), BODIES); fillSelect($('#pFuel'), FUELS); fillSelect($('#pGear'), GEARS); fillSelect($('#pCity'), CITIES);
  $('#pColors').innerHTML = Object.entries(COLORS).map(([n, h], i) =>
    `<label title="${n}"><input type="radio" name="color" value="${n}" ${i ? '' : 'checked'}><span style="background:${h}"></span></label>`).join('');
  $('#pModel').addEventListener('change', () => {
    const m = BRANDS[$('#pBrand').value].m.find(x => x[0] === $('#pModel').value);
    if (m) { pf.body.value = m[1]; if (m[6]) pf.fuel.value = m[6]; }
  });

  $$('[data-open-post], #openPost').forEach(b => b.addEventListener('click', e => { e.preventDefault(); openModal($('#chooseModal')); }));
  const carPhotos = [];
  function renderCarThumbs() {
    $('#pThumbs').innerHTML = carPhotos.map((src, i) => `<button type="button" data-rm="${i}" style="background-image:url(${src})" aria-label="Убрать фото">×</button>`).join('');
  }
  $('#pPhotos').addEventListener('change', async e => {
    for (const f of [...e.target.files].slice(0, 5 - carPhotos.length)) { try { carPhotos.push(await readImage(f, 1100)); } catch { } }
    e.target.value = ''; renderCarThumbs();
  });
  $('#pThumbs').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { carPhotos.splice(+b.dataset.rm, 1); renderCarThumbs(); } });
  const carFromRow = r => ({
    id: 2e6 + r.id, dbId: r.id, uid: r.user_id, brand: r.brand, model: r.model, body: r.body || 'Седан', year: r.year, price: r.price, mileage: r.mileage,
    fuel: r.fuel || 'Бензин', wheel: r.wheel || 'Левый', gear: r.gear || 'Автомат', drive: '—', color: r.color || 'Белый', engine: +r.engine || 0, hp: 0,
    city: r.city, cleared: r.cleared, exchange: false, photos: r.photos.length, imgs: r.photos, top: false, views: 0, created: Date.parse(r.created_at),
    desc: r.descr || 'Без описания', seller: 'Частный продавец', dealer: false, phone: r.phone, market: 1
  });
  pf.addEventListener('submit', e => { e.preventDefault(); requireAuth(publishCar); });
  async function publishCar() {
    const ed = editing?.kind === 'car' ? editing : null;
    const d = Object.fromEntries(new FormData(pf));
    const btn = $('.btn--primary', pf);
    busy(btn, true);
    try {
      const photos = [];
      for (const src of carPhotos) photos.push(await DB.upload(src));
      const fields = {
        brand: d.brand, model: d.model, body: d.body, fuel: d.fuel, gear: d.gear, wheel: d.wheel, color: d.color, year: +d.year, price: +d.price,
        mileage: +d.mileage, engine: +d.engine || null, city: d.city, cleared: !!d.cleared, descr: d.desc || '', phone: d.phone, photos
      };
      const row = ed ? await DB.update('ab_cars', ed.dbId, fields) : await DB.insert('ab_cars', fields);
      const ad = carFromRow(row);
      const old = ALL.findIndex(x => x.id === ad.id);
      if (old >= 0) ALL.splice(old, 1);
      ALL.unshift(ad);
      closeModal($('#postModal')); pf.reset(); syncPModels(); carPhotos.length = 0; renderCarThumbs();
      state.f = {}; state.favOnly = false; state.sort = 'date'; $('#sort').value = 'date'; state.page = 1; writeForm({ photo: 'on' }); render();
      toast(ed ? 'Изменения сохранены' : 'Объявление опубликовано!');
      location.hash = 'car-' + ad.id;
    } catch (err) { toast(err.message); } finally { busy(btn, false); }
  }

  $('#vinForm').addEventListener('submit', e => { e.preventDefault(); toast('Проверка по VIN скоро появится — сейчас подключаем источники данных'); });

  // ---------- auction (Supabase: ab_lots, ab_bids; ставка только через функцию ab_place_bid) ----------
  const MIN = 60000;
  let openLotId = null;
  let lots = [];
  let lotsLoaded = false;
  const remind = new Set(store.get('unaa_remind', []));
  const bidFromRow = r => ({ id: r.id, who: r.bidder, amount: r.amount, t: Date.parse(r.created_at), uid: r.user_id });
  const lotFromRow = (r, bids = []) => ({
    id: r.id, carId: r.id, car: r.car, step: r.step, start: r.start_price, buyNow: r.buy_now,
    startsAt: Date.parse(r.starts_at), endsAt: Date.parse(r.ends_at), bids, notified: Date.parse(r.ends_at) < Date.now()
  });
  const isMe = b => !!b && !!DB.user && b.uid === DB.user.id;
  async function loadLots() {
    try {
      await DB.rpc('ab_roll_lots').catch(() => { });
      const [rows, bids] = await Promise.all([DB.select('ab_lots'), DB.select('ab_bids', q => q.order('amount'))]);
      lots = rows.map(r => lotFromRow(r, bids.filter(b => b.lot_id === r.id).map(bidFromRow)));
    } catch (e) { lots = []; toast('Аукцион недоступен: ' + e.message); }
    lotsLoaded = true;
    lastStatus = statusKey();
    refreshAuction(); render();
  }
  async function reloadBids(l) {
    l.bids = (await DB.select('ab_bids', q => q.eq('lot_id', l.id).order('amount'))).map(bidFromRow);
  }

  function lotByCar(id) { return lots.find(l => l.carId === id && lotStatus(l) !== 'done'); }
  function lotStatus(l, now = Date.now()) { return now < l.startsAt ? 'soon' : now < l.endsAt ? 'live' : 'done'; }
  const lotPrice = l => l.bids.length ? l.bids[l.bids.length - 1].amount : l.start;
  const lotMin = l => l.bids.length ? lotPrice(l) + l.step : l.start;
  const lotLeader = l => l.bids[l.bids.length - 1];
  const carOf = l => ALL.find(c => c.id === l.carId) || { id: l.id, exchange: false, photos: 0, desc: '', ...l.car };
  const pad = n => String(n).padStart(2, '0');
  function timeLeft(ms) {
    if (ms <= 0) return '00:00:00';
    const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    return d ? `${d} д ${pad(h)} ч ${pad(m)} мин` : `${pad(h)}:${pad(m)}:${pad(s % 60)}`;
  }
  function timerText(l, now = Date.now()) {
    const st = lotStatus(l, now);
    return st === 'soon' ? 'Старт через ' + timeLeft(l.startsAt - now) : st === 'live' ? timeLeft(l.endsAt - now) : 'Торги завершены';
  }
  const urgent = (l, now = Date.now()) => lotStatus(l, now) === 'live' && l.endsAt - now < 5 * MIN;

  const aucState = { tab: 'live', all: false };
  function lotCard(l) {
    const c = carOf(l), st = lotStatus(l), lead = lotLeader(l);
    const mine = l.bids.some(isMe);
    const flag = st === 'live' && mine ? (isMe(lead) ? '<span class="lot__flag ok">Вы лидируете</span>' : '<span class="lot__flag bad">Ставку перебили</span>')
      : st === 'done' && isMe(lead) ? '<span class="lot__flag ok">Вы выиграли</span>' : '';
    const badge = st === 'live' ? '<span class="lot__badge live"><i></i>LIVE</span>' : st === 'soon' ? '<span class="lot__badge soon">Скоро</span>' : '<span class="lot__badge done">Завершён</span>';
    const btn = st === 'live' ? `<button class="btn btn--primary">Сделать ставку</button>`
      : st === 'soon' ? `<button class="btn btn--ghost" data-remind="${l.id}">${remind.has(l.id) ? '🔔 Напомню' : 'Напомнить о старте'}</button>`
        : `<button class="btn btn--ghost" disabled>${l.bids.length ? 'Продан за ' + usd(lotPrice(l)) : 'Не состоялся'}</button>`;
    return `<article class="lot ${st}" data-lot="${l.id}">
      <div class="lot__media">${cover(c)}${badge}<span class="lot__timer ${urgent(l) ? 'urgent' : ''}" data-timer="${l.id}">⏱ ${timerText(l)}</span></div>
      <div class="lot__body">
        <div class="card__title">${esc(c.brand)} ${esc(c.model)}<span>, ${c.year}</span></div>
        <div class="card__specs">${fmt(c.mileage)} км · ${c.gear.toLowerCase()} · ${c.city}</div>
        <div class="lot__row"><div><div class="lot__label">${st === 'done' ? 'Итоговая цена' : st === 'soon' || !l.bids.length ? 'Стартовая цена' : 'Текущая ставка'}</div>
          <div class="lot__price">${usd(lotPrice(l))}</div></div>
          <div class="lot__meta">${l.bids.length} ${plural(l.bids.length, 'ставка', 'ставки', 'ставок')}<br>шаг ${usd(l.step)}</div></div>
        ${flag}${btn}
      </div></article>`;
  }
  function renderLots() {
    const by = { live: [], soon: [], done: [] };
    lots.forEach(l => by[lotStatus(l)].push(l));
    by.live.sort((a, b) => a.endsAt - b.endsAt); by.soon.sort((a, b) => a.startsAt - b.startsAt); by.done.sort((a, b) => b.endsAt - a.endsAt);
    $$('#aucTabs [data-tab]').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === aucState.tab);
      $('b', b).textContent = by[b.dataset.tab].length;
    });
    const list = by[aucState.tab];
    const limit = innerWidth <= 640 ? 4 : 8;
    $('#lots').innerHTML = !lotsLoaded ? '<p class="lots__empty"><span class="spinner"></span> Загружаем лоты…</p>'
      : list.length ? list.slice(0, aucState.all ? 99 : limit).map(lotCard).join('') : '<p class="lots__empty">Здесь пока пусто</p>';
    $('#lotsMore').hidden = list.length <= limit;
    $('#lotsMore').textContent = aucState.all ? 'Свернуть' : `Все лоты (${list.length})`;
    $('#aucLiveCount').textContent = by.live.length;
  }
  $('#aucTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    aucState.tab = b.dataset.tab; aucState.all = false; renderLots();
  });
  $('#lotsMore').addEventListener('click', () => { aucState.all = !aucState.all; renderLots(); });
  function toggleRemind(id) {
    remind.has(id) ? remind.delete(id) : remind.add(id);
    store.set('unaa_remind', [...remind]);
    toast(remind.has(id) ? 'Напомним, когда начнутся торги (пока открыт сайт)' : 'Напоминание отключено');
    refreshAuction();
  }
  $('#lots').addEventListener('click', e => {
    const r = e.target.closest('[data-remind]');
    if (r) return toggleRemind(+r.dataset.remind);
    const card = e.target.closest('[data-lot]');
    if (card) location.hash = 'lot-' + card.dataset.lot;
  });

  async function placeBid(l, amount) {
    if (!DB.user) return requireAuth(() => showLot(l.id));
    try {
      const row = await DB.rpc('ab_place_bid', { p_lot: l.id, p_amount: amount });
      l.endsAt = Date.parse(row.ends_at);
      await reloadBids(l);
      toast(`Ставка ${usd(amount)} принята!`);
    } catch (err) { toast(err.message); }
    refreshAuction();
  }

  function showLot(id) {
    const l = lots.find(x => x.id === id);
    if (!l) return;
    if (openLotId !== id) DB.log('lot', `${carOf(l).brand} ${carOf(l).model} #${l.id}`);
    openLotId = id;
    const c = carOf(l);
    const gal = gallery(c);
    $('#lotDetail').innerHTML = `<div class="detail">
      <div class="detail__gallery">${gal.html}
        <div class="auc-rules"><b>Как проходят торги</b><ul>
          <li>Шаг ставки — ${usd(l.step)}. Ставка обязывает выкупить авто.</li>
          <li>Ставка за 2 минуты до конца продлевает торги ещё на 2 минуты.</li>
          <li>Ставки принимает сервер — все участники видят их сразу.</li></ul></div>
      </div>
      <div class="detail__info" id="lotInfo"></div></div>`;
    gal.bind($('#lotModal'));
    renderLotInfo(l);
    openModal($('#lotModal'));
    $('#lotModal .modal__box').scrollTop = 0;
  }
  function renderLotInfo(l) {
    const box = $('#lotInfo'); if (!box) return;
    const c = carOf(l), st = lotStatus(l), lead = lotLeader(l), min = lotMin(l);
    const typed = $('#bidInput')?.value;
    box.innerHTML = `
      <h2 class="detail__title">${esc(c.brand)} ${esc(c.model)}, ${c.year}</h2>
      <div class="lot-status ${st}">
        <span class="lot__badge ${st}">${st === 'live' ? '<i></i>Идут торги' : st === 'soon' ? 'Скоро старт' : 'Торги завершены'}</span>
        <span class="lot-status__timer ${urgent(l) ? 'urgent' : ''}" data-timer="${l.id}">${timerText(l)}</span>
      </div>
      <div class="bidbox">
        <div class="bidbox__row">
          <div><div class="lot__label">${st === 'done' ? 'Итоговая цена' : st === 'soon' || !l.bids.length ? 'Стартовая цена' : 'Текущая ставка'}</div><div class="detail__price">${usd(lotPrice(l))}<small>≈ ${som(lotPrice(l))}</small></div></div>
          <div class="lot__meta">${l.bids.length} ${plural(l.bids.length, 'ставка', 'ставки', 'ставок')}<br>старт ${usd(l.start)}</div>
        </div>
        ${lead && st !== 'soon' ? `<div class="bidbox__lead ${isMe(lead) ? 'me' : ''}">${st === 'done' ? 'Победитель' : 'Лидирует'}: <b>${isMe(lead) ? 'вы' : esc(lead.who)}</b></div>` : ''}
        ${st === 'live' ? `
          <div class="quick">${[1, 2, 5].map(k => `<button class="btn btn--ghost" data-quick="${min + l.step * (k - 1)}">${usd(min + l.step * (k - 1))}</button>`).join('')}</div>
          <form class="bidform" id="bidForm">
            <input id="bidInput" type="number" inputmode="numeric" min="${min}" step="${l.step}" value="${typed && +typed >= min ? typed : min}" aria-label="Ваша ставка, $">
            <button class="btn btn--primary btn--lg">${DB.user ? 'Сделать ставку' : 'Войти и сделать ставку'}</button>
          </form>
          <div class="bidbox__hint">Минимальная ставка ${usd(min)}</div>
          ${l.buyNow && lotPrice(l) < l.buyNow ? `<button class="btn btn--dark btn--lg" id="buyNow">Купить сейчас за ${usd(l.buyNow)}</button>` : ''}`
        : st === 'soon' ? `<button class="btn btn--primary btn--lg" id="lotRemind">${remind.has(l.id) ? '🔔 Напоминание включено' : 'Напомнить о старте'}</button>`
          : isMe(lead) ? '<div class="win">🎉 Поздравляем! Вы выиграли этот лот. Менеджер свяжется с вами.</div>' : ''}
      </div>
      <dl class="specs">${[['Пробег', `${fmt(c.mileage)} км`], ['Двигатель', c.fuel === 'Электро' ? `электро${c.hp ? `, ${c.hp} л.с.` : ''}` : `${(+c.engine).toFixed(1)} л${c.hp ? `, ${c.hp} л.с.` : ''}`], ['Коробка', c.gear], ['Привод', c.drive], ['Руль', c.wheel], ['Город', c.city]].map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <div><div class="lot__label">История ставок</div>
        <ol class="history">${l.bids.length ? l.bids.slice(-8).reverse().map((b, i) => `<li class="${isMe(b) ? 'me' : ''} ${i ? '' : 'top'}"><span>${isMe(b) ? 'Вы' : esc(b.who)}</span><b>${usd(b.amount)}</b><time>${ago(b.t)}</time></li>`).join('') : '<li class="muted">Ставок пока нет — будьте первым</li>'}</ol>
      </div>`;
    $('#bidForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const v = Math.round(+$('#bidInput').value);
      if (!(v >= lotMin(l))) return toast(`Минимальная ставка ${usd(lotMin(l))}`);
      if (isMe(lotLeader(l))) return toast('Ваша ставка уже лидирует');
      placeBid(l, v);
    });
    $$('[data-quick]', box).forEach(b => b.addEventListener('click', () => { $('#bidInput').value = b.dataset.quick; $('#bidForm').requestSubmit(); }));
    $('#buyNow')?.addEventListener('click', () => requireAuth(async () => {
      if (!confirm(`Купить ${c.brand} ${c.model} за ${usd(l.buyNow)}?`)) return;
      try {
        const row = await DB.rpc('ab_buy_now', { p_lot: l.id });
        l.endsAt = Date.parse(row.ends_at); l.notified = true;
        await reloadBids(l);
        toast('🎉 Поздравляем! Авто ваше — менеджер свяжется с вами');
      } catch (err) { toast(err.message); }
      refreshAuction();
    }));
    $('#lotRemind')?.addEventListener('click', () => toggleRemind(l.id));
  }
  function refreshAuction() {
    renderLots();
    const l = lots.find(x => x.id === openLotId);
    if (l && !$('#lotModal').hidden) renderLotInfo(l);
  }
  // ставки и продления других участников приходят в реальном времени
  function onBid({ eventType, new: r }) {
    if (eventType !== 'INSERT') return;
    const l = lots.find(x => x.id === r.lot_id);
    if (!l || l.bids.some(b => b.id === r.id)) return;
    const prev = lotLeader(l);
    l.bids.push(bidFromRow(r)); l.bids.sort((a, b) => a.amount - b.amount);
    if (isMe(prev) && !isMe(lotLeader(l))) toast(`Вашу ставку на ${carOf(l).brand} ${carOf(l).model} перебили: ${usd(r.amount)}`);
    refreshAuction();
  }
  function onLot({ eventType, new: r }) {
    if (eventType !== 'UPDATE') return;
    const l = lots.find(x => x.id === r.id);
    if (!l) return;
    const restarted = Date.parse(r.starts_at) !== l.startsAt;
    Object.assign(l, { startsAt: Date.parse(r.starts_at), endsAt: Date.parse(r.ends_at) });
    if (restarted) { l.bids = []; l.notified = false; }
    refreshAuction();
  }

  // Каждую секунду: таймеры и смена статусов лотов
  const statusKey = () => lots.map(l => lotStatus(l)).join();
  let lastStatus = '';
  setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const l of lots) {
      if (lotStatus(l, now) === 'done' && !l.notified) {
        l.notified = true; changed = true;
        if (isMe(lotLeader(l))) toast(`🎉 Вы выиграли ${carOf(l).brand} ${carOf(l).model}!`);
      }
      if (lotStatus(l, now) === 'live' && remind.has(l.id)) {
        remind.delete(l.id); store.set('unaa_remind', [...remind]); changed = true;
        toast(`Начались торги: ${carOf(l).brand} ${carOf(l).model}`);
      }
    }
    const key = statusKey();
    if (changed || key !== lastStatus) {
      const statusChanged = key !== lastStatus;
      lastStatus = key; refreshAuction();
      if (statusChanged) render();
      return;
    }
    $$('[data-timer]').forEach(el => {
      const l = lots.find(x => x.id === +el.dataset.timer);
      if (!l) return;
      el.textContent = (el.classList.contains('lot__timer') ? '⏱ ' : '') + timerText(l, now);
      el.classList.toggle('urgent', urgent(l, now));
    });
  }, 1000);

  // ---------- parts ----------
  const PARTS = SHOW_DEMO ? generateParts(2600) : [];
  const partFromRow = r => ({
    id: 3e6 + r.id, dbId: r.id, uid: r.user_id, cat: r.cat, name: r.title, title: r.title, brand: r.brand, model: r.model,
    compat: r.brand ? `${r.brand} ${r.model}` : 'Универсальная', used: r.cond === 'Б/у', cond: r.cond, orig: 'Частное объявление', maker: '—',
    price: r.price, oldPrice: 0, sku: 'PR-' + r.id, shop: 'Частный продавец', city: r.city, addr: r.city, phone: r.phone, stock: 1,
    rating: 0, reviews: 0, delivery: false, created: Date.parse(r.created_at), photo: 0, img: r.photo || '', desc: r.descr
  });
  const PARTS_PAGE = 15;
  const kgs = n => fmt(Math.round(n)) + ' сом';
  const ps = { cat: '', q: '', brand: '', model: '', cond: '', orig: false, sort: 'pop', page: 1 };

  function partPhoto(p) {
    const list = (typeof PART_PHOTOS !== 'undefined' && PART_PHOTOS[p.cat]) || [];
    return list.length ? list[p.photo % list.length] : null;
  }
  function partImg(p) {
    if (p.img) return `<img src="${p.img}" alt="${esc(p.title)}">`;
    const ph = partPhoto(p);
    const cat = PART_CATS.find(c => c.id === p.cat);
    return ph ? `<img src="${ph.src}" alt="${esc(p.title)}" loading="lazy" decoding="async">` : `<div class="part__ph">${cat.icon}</div>`;
  }
  function partsFor(brand, model) { return PARTS.filter(p => p.brand === brand && p.model === model).length; }

  const norm = s => s.toLowerCase().replace(/ё/g, 'е');
  function partMatches(p, f, skipCat) {
    if (!skipCat && f.cat && p.cat !== f.cat) return false;
    if (f.brand && p.brand && p.brand !== f.brand) return false;
    if (f.model && p.model && p.model !== f.model) return false;
    if (f.cond && p.cond !== f.cond) return false;
    if (f.orig && !/Оригинал/.test(p.orig)) return false;
    if (f.q) {
      const hay = norm(`${p.title} ${p.maker} ${p.sku} ${PART_CATS.find(c => c.id === p.cat).name}`);
      if (!norm(f.q).split(/\s+/).filter(Boolean).every(w => hay.includes(w.length > 4 ? w.slice(0, -1) : w))) return false;
    }
    return true;
  }
  const PART_SORTS = {
    pop: (a, b) => b.reviews * b.rating - a.reviews * a.rating,
    priceAsc: (a, b) => a.price - b.price,
    priceDesc: (a, b) => b.price - a.price,
    rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
    new: (a, b) => b.created - a.created
  };

  function partCard(p) {
    const qty = cart[p.id] || 0;
    const sale = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    return `<article class="part" data-part="${p.id}">
      <div class="part__media">${partImg(p)}
        <div class="card__tags">${sale ? `<span class="tag tag--sale">−${sale}%</span>` : ''}<span class="tag ${p.used ? '' : 'tag--new'}">${p.cond}</span></div>
      </div>
      <div class="part__body">
        <div class="part__title">${esc(p.title)}</div>
        <div class="part__compat ${p.brand ? '' : 'uni'}">${p.brand ? 'Для ' + esc(p.compat) : '✓ Подходит для всех авто'}</div>
        <div class="part__rating">${p.reviews ? `★ ${p.rating} <span>(${p.reviews})</span> · ` : ''}${esc(p.orig)}</div>
        <div class="part__price">${kgs(p.price)}${p.oldPrice ? `<s>${kgs(p.oldPrice)}</s>` : ''}</div>
        <div class="part__shop">${esc(p.shop)} · ${p.city}</div>
        ${qty ? stepper(p.id, qty) : `<button class="btn btn--primary part__buy" data-add="${p.id}">В корзину</button>`}
      </div>
    </article>`;
  }
  const stepper = (id, qty) => `<div class="stepper"><button data-dec="${id}" aria-label="Меньше">−</button><span>${qty} в корзине</span><button data-inc="${id}" aria-label="Больше">+</button></div>`;

  function renderParts(append = false) {
    const list = PARTS.filter(p => partMatches(p, ps)).sort(PART_SORTS[ps.sort]);
    const shown = list.slice(0, ps.page * PARTS_PAGE);
    const grid = $('#partsGrid');
    if (append) grid.insertAdjacentHTML('beforeend', shown.slice((ps.page - 1) * PARTS_PAGE).map(partCard).join(''));
    else grid.innerHTML = shown.map(partCard).join('');
    $('#partsEmpty').hidden = list.length > 0;
    const left = list.length - shown.length;
    $('#partsMore').hidden = left <= 0;
    $('#partsMore').textContent = `Показать ещё ${Math.min(PARTS_PAGE, left)} из ${fmt(left)}`;
    $('#partsTotal').textContent = fmt(PARTS.length);
    maybeRemoteParts();
    const counts = {};
    PARTS.forEach(p => { if (partMatches(p, ps, true)) counts[p.cat] = (counts[p.cat] || 0) + 1; });
    const all = Object.values(counts).reduce((a, b) => a + b, 0);
    $('#partCats').innerHTML = `<button class="cat ${ps.cat ? '' : 'active'}" data-cat=""><span>🧰</span>Все<b>${all}</b></button>` +
      PART_CATS.map(c => `<button class="cat ${ps.cat === c.id ? 'active' : ''}" data-cat="${c.id}"><span>${c.icon}</span>${c.name}<b>${counts[c.id] || 0}</b></button>`).join('');
  }

  const pfBrand = $('#pfBrand'), pfModel = $('#pfModel');
  fillSelect(pfBrand, brandNames, 'Для любой марки');
  function syncPartModels() {
    pfModel.disabled = !pfBrand.value;
    fillSelect(pfModel, pfBrand.value ? BRANDS[pfBrand.value].m.map(m => m[0]) : [], 'Любая модель');
  }
  pfBrand.addEventListener('change', () => { syncPartModels(); ps.brand = pfBrand.value; ps.model = ''; ps.page = 1; renderParts(); });
  pfModel.addEventListener('change', () => { ps.model = pfModel.value; ps.page = 1; renderParts(); });
  $$('input[name="pfCond"]').forEach(r => r.addEventListener('change', () => { ps.cond = r.value; ps.page = 1; renderParts(); }));
  $('#pfOrig').addEventListener('change', e => { ps.orig = e.target.checked; ps.page = 1; renderParts(); });
  $('#pfSort').addEventListener('change', e => { ps.sort = e.target.value; ps.page = 1; renderParts(); });
  $('#partsSearch').addEventListener('submit', e => { e.preventDefault(); ps.q = $('#partsQuery').value.trim(); ps.page = 1; if (ps.q) DB.log('parts_search', ps.q.toLowerCase()); renderParts(); });
  $('#partsQuery').addEventListener('search', () => { ps.q = $('#partsQuery').value.trim(); ps.page = 1; renderParts(); });
  $('#partCats').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    ps.cat = b.dataset.cat; ps.page = 1; renderParts();
  });
  $('#partsMore').addEventListener('click', () => { ps.page++; renderParts(true); });
  function setPartFilters(f) {
    Object.assign(ps, { cat: '', q: '', brand: '', model: '', cond: '', orig: false, page: 1 }, f);
    $('#partsQuery').value = ps.q; pfBrand.value = ps.brand; syncPartModels(); pfModel.value = ps.model;
    $$('input[name="pfCond"]').forEach(r => r.checked = r.value === ps.cond); $('#pfOrig').checked = ps.orig;
    renderParts();
  }
  $('#partsReset').addEventListener('click', () => setPartFilters({}));
  $('#carDetail').addEventListener('click', e => {
    const b = e.target.closest('[data-parts-for]'); if (!b) return;
    const [brand, model] = b.dataset.partsFor.split('|');
    closeModal($('#carModal'));
    setPartFilters({ brand, model });
    $('#parts').scrollIntoView({ behavior: 'smooth' });
  });

  // клики по карточкам запчастей: в корзину, +/−, открыть
  function onPartClick(e) {
    const add = e.target.closest('[data-add]'), inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]');
    if (add) { cartAdd(+add.dataset.add); return; }
    if (inc) { cartAdd(+inc.dataset.inc); return; }
    if (dec) { cartSet(+dec.dataset.dec, (cart[+dec.dataset.dec] || 0) - 1); return; }
    const card = e.target.closest('[data-part]');
    if (card && !e.target.closest('button')) location.hash = 'part-' + card.dataset.part;
  }
  $('#partsGrid').addEventListener('click', onPartClick);

  function showPart(id) {
    const p = PARTS.find(x => x.id === id);
    if (!p) return;
    DB.log('part', `${p.title} #${p.id}`);
    const ph = partPhoto(p);
    const cat = PART_CATS.find(c => c.id === p.cat);
    const specs = [['Артикул', p.sku], ['Категория', cat.name], ['Производитель', p.maker], ['Тип', p.orig], ['Состояние', p.cond],
      ['Совместимость', p.compat], ['Наличие', p.stock > 1 ? `${p.stock} шт.` : 'последний экземпляр'], ['Доставка', p.delivery ? 'по городу и по Кыргызстану' : 'только самовывоз']];
    const similar = PARTS.filter(x => x.id !== p.id && x.cat === p.cat && (!p.brand || x.brand === p.brand || !x.brand)).sort((a, b) => a.price - b.price).slice(0, 4);
    $('#partDetail').innerHTML = `<div class="detail">
      <div class="detail__gallery">
        <div class="detail__main detail__main--part">${partImg(p)}<div class="credit">${ph ? `<a href="${ph.page}" target="_blank" rel="noopener">Фото: ${esc(ph.author)} · ${esc(ph.license)}</a>` : ''}</div></div>
        ${similar.length ? `<div class="similar"><div class="lot__label">Похожие предложения</div>${similar.map(s => `<a href="#part-${s.id}" class="similar__item"><span>${esc(s.shop)} · ${s.cond}</span><b>${kgs(s.price)}</b></a>`).join('')}</div>` : ''}
      </div>
      <div class="detail__info">
        <div class="part__rating">${cat.icon} ${cat.name}${p.reviews ? ` · ★ ${p.rating} (${p.reviews} отзывов)` : ''}</div>
        <h2 class="detail__title">${esc(p.title)}</h2>
        <div class="detail__price">${kgs(p.price)}${p.oldPrice ? `<s class="old">${kgs(p.oldPrice)}</s>` : ''}<small>≈ ${usd(Math.round(p.price / RATE))}</small></div>
        <dl class="specs">${specs.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        ${p.desc ? `<p class="detail__desc">${esc(p.desc)}</p>` : ''}
        <div class="seller">
          <div class="seller__ava" style="background:#1f2937">${esc(p.shop.replace(/[^A-Za-zА-я]/g, '')[0])}</div>
          <div><div class="seller__name">${esc(p.shop)}</div><div class="seller__meta">${p.city}, ${esc(p.addr)} · магазин проверен</div></div>
        </div>
        <div class="part-buy" id="partBuy"></div>
        <a class="btn btn--wa btn--lg" target="_blank" rel="noopener" href="https://wa.me/${p.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Здравствуйте! Есть в наличии «${p.title}» (арт. ${p.sku}) за ${kgs(p.price)}? (Автобазар)`)}">Спросить продавца в WhatsApp</a>
        ${extraActions('part', p)}
      </div></div>`;
    renderPartBuy(p);
    $('#partBuy').addEventListener('click', e => {
      if (e.target.closest('[data-one-click]')) { if (!cart[p.id]) cartAdd(p.id, true); closeModal($('#partModal')); openCart(); return; }
      onPartClick(e);
    });
    openModal($('#partModal'));
    $('#partModal .modal__box').scrollTop = 0;
  }
  function renderPartBuy(p) {
    const box = $('#partBuy'); if (!box) return;
    const qty = cart[p.id] || 0;
    box.innerHTML = (qty ? stepper(p.id, qty) : `<button class="btn btn--primary btn--lg" data-add="${p.id}">Добавить в корзину</button>`) +
      `<button class="btn btn--dark btn--lg" data-one-click>${qty ? 'Перейти к оформлению' : 'Купить в 1 клик'}</button>`;
    box.dataset.part = p.id;
  }

  // ---------- cart ----------
  const cart = store.get('unaa_cart', {});
  const DELIVERY = [
    { id: 'pickup', name: 'Самовывоз из магазина', price: 0, hint: 'сегодня' },
    { id: 'courier', name: 'Курьер по городу', price: 200, hint: '1–2 часа' },
    { id: 'post', name: 'Доставка по Кыргызстану', price: 350, hint: '1–3 дня' }
  ];
  const PAY = ['Наличными при получении', 'MBank', 'Элсом', 'O!Деньги', 'Банковской картой'];
  const FREE_FROM = 10000;
  const co = { delivery: 'courier', pay: PAY[0], done: null };

  const cartItems = () => Object.entries(cart).map(([id, q]) => ({ p: PARTS.find(x => x.id === +id), q })).filter(x => x.p);
  function cartSet(id, q) {
    const p = PARTS.find(x => x.id === id);
    q = Math.max(0, Math.min(q, p ? p.stock : 0));
    if (q) cart[id] = q; else delete cart[id];
    store.set('unaa_cart', cart);
    saveCartRemote();
    syncCartUI(id);
  }
  function cartAdd(id, silent) {
    const p = PARTS.find(x => x.id === id);
    if ((cart[id] || 0) >= p.stock) return toast(`В наличии только ${p.stock} шт.`);
    cartSet(id, (cart[id] || 0) + 1);
    if (!silent && cart[id] === 1) toast('Добавлено в корзину');
  }
  function syncCartUI(id) {
    const n = Object.values(cart).reduce((a, b) => a + b, 0);
    $$('[data-cart-count]').forEach(b => { b.textContent = n; b.dataset.n = n; });
    if (id != null) {
      const card = $(`#partsGrid [data-part="${id}"]`);
      if (card) card.outerHTML = partCard(PARTS.find(x => x.id === id));
      const buy = $('#partBuy');
      if (buy && +buy.dataset.part === id) renderPartBuy(PARTS.find(x => x.id === id));
    }
    if (!$('#cart').hidden) renderCart();
  }

  function renderCart() {
    const body = $('#cartBody');
    if (co.done) {
      body.innerHTML = `<div class="cart-done"><div class="cart-done__icon">✅</div><h3>Заказ ${co.done.no} оформлен!</h3>
        <p>Продавец позвонит на номер ${esc(co.done.phone)} в течение 15 минут, чтобы подтвердить наличие и время доставки.</p>
        <p class="muted">Сумма: <b>${kgs(co.done.total)}</b> · ${esc(co.done.pay)}</p>
        <button class="btn btn--primary btn--lg" data-close>Продолжить покупки</button></div>`;
      return;
    }
    const items = cartItems();
    if (!items.length) {
      body.innerHTML = `<div class="cart-done"><div class="cart-done__icon">🛒</div><h3>Корзина пуста</h3><p>Добавьте запчасти из каталога — масла, фильтры, колодки и всё остальное.</p>
        <a href="#parts" class="btn btn--primary btn--lg" data-close>Перейти в запчасти</a></div>`;
      return;
    }
    const sum = items.reduce((a, { p, q }) => a + p.price * q, 0);
    const d = DELIVERY.find(x => x.id === co.delivery);
    const dPrice = sum >= FREE_FROM ? 0 : d.price;
    const typed = Object.fromEntries(['coName', 'coPhone', 'coAddr', 'coNote'].map(k => [k, $('#' + k)?.value || '']));
    body.innerHTML = `
      <ul class="cart-list">${items.map(({ p, q }) => `<li class="cart-item">
        <a href="#part-${p.id}" class="cart-item__img" data-close>${partImg(p)}</a>
        <div class="cart-item__info"><div class="cart-item__title">${esc(p.title)}</div>
          <div class="cart-item__meta">${esc(p.shop)} · ${p.cond}</div>
          <div class="cart-item__row"><div class="qty"><button data-dec="${p.id}" aria-label="Меньше">−</button><span>${q}</span><button data-inc="${p.id}" aria-label="Больше">+</button></div>
          <b>${kgs(p.price * q)}</b></div></div>
        <button class="cart-item__del" data-del="${p.id}" aria-label="Удалить">×</button></li>`).join('')}</ul>
      ${sum < FREE_FROM ? `<div class="free-bar"><div style="width:${Math.min(100, sum / FREE_FROM * 100)}%"></div><span>До бесплатной доставки ещё ${kgs(FREE_FROM - sum)}</span></div>` : '<div class="free-bar ok"><span>🎉 Доставка бесплатно</span></div>'}
      <form class="checkout" id="checkout">
        <div class="lot__label">Получение</div>
        <div class="opts">${DELIVERY.map(x => `<label class="opt"><input type="radio" name="delivery" value="${x.id}" ${x.id === co.delivery ? 'checked' : ''}><span><b>${x.name}</b><small>${x.hint} · ${sum >= FREE_FROM || !x.price ? 'бесплатно' : kgs(x.price)}</small></span></label>`).join('')}</div>
        <div class="lot__label">Оплата</div>
        <div class="pay">${PAY.map(x => `<label><input type="radio" name="pay" value="${x}" ${x === co.pay ? 'checked' : ''}><span>${x}</span></label>`).join('')}</div>
        <div class="lot__label">Контакты</div>
        <input class="inp" id="coName" placeholder="Ваше имя" required value="${esc(typed.coName)}">
        <input class="inp" id="coPhone" type="tel" placeholder="+996 700 123 456" required value="${esc(typed.coPhone)}">
        ${co.delivery === 'pickup' ? '' : `<input class="inp" id="coAddr" placeholder="${co.delivery === 'post' ? 'Город, адрес или отделение почты' : 'Улица, дом, квартира'}" required value="${esc(typed.coAddr)}">`}
        <textarea class="inp" id="coNote" rows="2" placeholder="Комментарий: VIN, год выпуска авто…">${esc(typed.coNote)}</textarea>
        <div class="total">
          <div><span>Товары (${items.reduce((a, x) => a + x.q, 0)})</span><span>${kgs(sum)}</span></div>
          <div><span>Доставка</span><span>${dPrice ? kgs(dPrice) : 'бесплатно'}</span></div>
          <div class="total__sum"><span>Итого</span><span>${kgs(sum + dPrice)}</span></div>
        </div>
        <button class="btn btn--primary btn--lg">Оформить заказ</button>
        <p class="muted small">Оплата после проверки товара. Возврат в течение 14 дней.</p>
      </form>`;
    $('#checkout').addEventListener('change', e => {
      if (e.target.name === 'delivery') { co.delivery = e.target.value; renderCart(); }
      if (e.target.name === 'pay') co.pay = e.target.value;
    });
    $('#checkout').addEventListener('submit', e => {
      e.preventDefault();
      const phone = $('#coPhone').value.trim();
      if (phone.replace(/\D/g, '').length < 9) return toast('Проверьте номер телефона');
      requireAuth(async () => {
        const btn = $('#checkout .btn--primary');
        busy(btn, true);
        try {
          const row = await DB.insert('ab_orders', {
            items: items.map(({ p, q }) => ({ id: p.id, ...(p.dbId ? { db_id: p.dbId } : {}), title: p.title, shop: p.shop, price: p.price, q })),
            total: sum + dPrice, delivery: d.name, pay: co.pay, name: $('#coName').value.trim(), phone,
            addr: $('#coAddr')?.value.trim() || '', note: $('#coNote').value.trim()
          });
          Object.keys(cart).forEach(k => delete cart[k]); store.set('unaa_cart', cart); saveCartRemote();
          co.done = { no: '№ AB-' + row.id, phone, total: row.total, pay: row.pay };
          syncCartUI(); renderParts(); renderCart();
        } catch (err) { toast(err.message); busy(btn, false); }
      });
    });
  }
  $('#cartBody').addEventListener('click', e => {
    const del = e.target.closest('[data-del]');
    if (del) return cartSet(+del.dataset.del, 0);
    const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]');
    if (inc) cartAdd(+inc.dataset.inc);
    if (dec) cartSet(+dec.dataset.dec, (cart[+dec.dataset.dec] || 0) - 1);
  });
  function openCart() { co.done = null; renderCart(); openModal($('#cart')); }
  $('#cartToggle').addEventListener('click', openCart);
  $('#tabCart').addEventListener('click', openCart);

  // ---------- uploads (фото уменьшаются в браузере перед сохранением) ----------
  function readImage(file, max = 720) {
    return new Promise((ok, fail) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(img.src);
        ok(cv.toDataURL('image/jpeg', .75));
      };
      img.onerror = fail;
      img.src = URL.createObjectURL(file);
    });
  }
  document.addEventListener('change', async e => {
    const inp = e.target;
    if (!inp.matches('input[type="file"][data-preview]') || !inp.files[0]) return;
    try {
      inp._data = await readImage(inp.files[0]);
      const pv = document.getElementById(inp.dataset.preview);
      pv.src = inp._data; pv.hidden = false;
    } catch { toast('Не удалось открыть фото'); }
  });

  // ---------- post chooser & sell part ----------
  $('#chooseModal').addEventListener('click', e => {
    const b = e.target.closest('[data-choose]'); if (!b) return;
    closeModal($('#chooseModal'));
    openModal($({ car: '#postModal', part: '#partPostModal', master: '#becomeModal' }[b.dataset.choose]));
  });
  const ppf = $('#partPostForm');
  fillSelect($('#ppCat'), []); $('#ppCat').innerHTML = PART_CATS.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  fillSelect($('#ppBrand'), brandNames, 'Универсальная (любая марка)');
  fillSelect($('#ppCity'), CITIES);
  const syncPPModels = () => {
    const b = $('#ppBrand').value;
    $('#ppModel').disabled = !b;
    fillSelect($('#ppModel'), b ? BRANDS[b].m.map(m => m[0]) : [], b ? null : '—');
  };
  $('#ppBrand').addEventListener('change', syncPPModels); syncPPModels();
  ppf.addEventListener('submit', e => { e.preventDefault(); requireAuth(publishPart); });
  async function publishPart() {
    const ed = editing?.kind === 'part' ? editing : null;
    const d = Object.fromEntries(new FormData(ppf));
    const btn = $('.btn--primary', ppf);
    busy(btn, true);
    try {
      const photo = await DB.upload(ppf.photo._data);
      const fields = {
        cat: d.cat, title: d.title, brand: d.brand || '', model: d.brand ? d.model : '', cond: d.cond, price: +d.price,
        city: d.city, descr: d.desc || '', phone: d.phone, photo
      };
      const row = ed ? await DB.update('ab_parts', ed.dbId, fields) : await DB.insert('ab_parts', fields);
      const p = partFromRow(row);
      const old = PARTS.findIndex(x => x.id === p.id);
      if (old >= 0) PARTS.splice(old, 1);
      PARTS.unshift(p);
      closeModal($('#partPostModal')); ppf.reset(); ppf.photo._data = ''; $('#ppPreview').hidden = true; syncPPModels();
      setPartFilters({ sort: 'new' }); $('#pfSort').value = 'new';
      toast(ed ? 'Изменения сохранены' : 'Запчасть опубликована!');
      location.hash = 'part-' + p.id;
    } catch (err) { toast(err.message); } finally { busy(btn, false); }
  }

  // ---------- masters ----------
  const MASTERS = SHOW_DEMO ? generateMasters(96) : [];
  const masterFromRow = r => ({
    id: 4e6 + r.id, dbId: r.id, real: true, uid: r.user_id, cat: r.cats[0], cats: r.cats, name: r.name, master: r.master || '—', years: r.years,
    rating: 0, reviews: 0, city: r.city, addr: r.addr, hours: r.hours, allDay: r.hours === 'круглосуточно', mobile: r.mobile, warranty: r.warranty,
    spec: 'все марки', verified: r.verified, freeToday: true, phone: r.phone, reply: 15, reviewsList: [], photo: 0, img: r.photo || '',
    services: r.services.length ? r.services : [{ name: 'Осмотр и консультация', price: 0, time: '30 минут' }]
  });
  const ratingHTML = m => m.reviews ? `<b>★ ${m.rating.toFixed(1)}</b> · ${m.reviews} ${plural(m.reviews, 'отзыв', 'отзыва', 'отзывов')}` : '<b class="ok">🆕 Новый на Автобазаре</b>';
  const MPAGE = 9;
  const ms = { cat: '', q: '', mobile: false, today: false, warranty: false, sort: 'rating', page: 1 };
  const scat = id => SERVICE_CATS.find(c => c.id === id);
  const svcPrice = s => s.price ? 'от ' + kgs(s.price) : 'бесплатно';
  const minPrice = m => Math.min(...m.services.map(s => s.price));
  const myBookings = store.get('unaa_bookings', []);
  const myRequests = [];   // заявки из базы (после входа)
  let dbBookings = [];      // записи к мастерам из базы

  function masterPhotos(m) {
    if (m.img) return [{ src: m.img }];
    const list = (typeof MASTER_PHOTOS !== 'undefined' && MASTER_PHOTOS[m.cat]) || [];
    const k = list.length ? m.photo % list.length : 0;
    return [...list.slice(k), ...list.slice(0, k)];
  }
  function masterImg(m, i = 0) {
    const ph = masterPhotos(m)[i];
    return ph ? `<img src="${ph.src}" alt="${esc(m.name)}" loading="lazy" decoding="async">` : `<div class="part__ph">${scat(m.cat).icon}</div>`;
  }
  const words = q => norm(q).split(/\s+/).filter(Boolean).map(w => w.length > 4 ? w.slice(0, -1) : w);
  function svcHits(m, q) {
    if (!q) return m.services;
    const ws = words(q);
    const hit = s => ws.every(w => norm(s.name).includes(w));
    return [...m.services.filter(hit), ...m.services.filter(s => !hit(s))];
  }
  function masterMatches(m) {
    if (state.city && m.city !== state.city) return false;
    if (ms.cat && !m.cats.includes(ms.cat)) return false;
    if (ms.mobile && !m.mobile) return false;
    if (ms.today && !m.freeToday) return false;
    if (ms.warranty && !m.warranty) return false;
    if (ms.q) {
      const hay = norm(`${m.name} ${m.services.map(s => s.name).join(' ')} ${m.cats.map(c => scat(c).name).join(' ')} ${m.spec}`);
      if (!words(ms.q).every(w => hay.includes(w))) return false;
    }
    return true;
  }
  const M_SORTS = {
    rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
    reviews: (a, b) => b.reviews - a.reviews,
    price: (a, b) => minPrice(a) - minPrice(b)
  };

  function masterCard(m) {
    const svc = svcHits(m, ms.q).slice(0, 3);
    return `<article class="master" data-master="${m.id}">
      <div class="master__media">${masterImg(m)}
        <div class="card__tags">${m.verified ? '<span class="tag tag--ok">✓ Проверен</span>' : ''}${m.freeToday ? '<span class="tag tag--new">Свободно сегодня</span>' : ''}${m.mobile ? '<span class="tag">🚐 Выезд</span>' : ''}</div>
      </div>
      <div class="master__body">
        <div class="master__cat">${m.cats.map(c => scat(c).icon + ' ' + scat(c).name).join(' · ')}</div>
        <h3 class="master__name">${esc(m.name)}</h3>
        <div class="master__rating">${ratingHTML(m)} · опыт ${m.years} ${plural(m.years, 'год', 'года', 'лет')}</div>
        <div class="master__addr">📍 ${m.city}, ${esc(m.addr)} · 🕘 ${esc(m.hours)}</div>
        <ul class="master__svc">${svc.map(s => `<li><span>${esc(s.name)}</span><b>${svcPrice(s)}</b></li>`).join('')}</ul>
        <div class="master__actions">
          <button class="btn btn--primary" data-book="${m.id}">Записаться</button>
          <a class="btn btn--ghost" href="tel:${m.phone.replace(/\s/g, '')}" aria-label="Позвонить">📞</a>
        </div>
      </div></article>`;
  }

  function renderMasters(append = false) {
    const list = MASTERS.filter(masterMatches).sort(M_SORTS[ms.sort]);
    const shown = list.slice(0, ms.page * MPAGE);
    const grid = $('#mastersGrid');
    if (append) grid.insertAdjacentHTML('beforeend', shown.slice((ms.page - 1) * MPAGE).map(masterCard).join(''));
    else grid.innerHTML = shown.map(masterCard).join('');
    $('#mastersEmpty').hidden = list.length > 0;
    const left = list.length - shown.length;
    $('#mastersMore').hidden = left <= 0;
    $('#mastersMore').textContent = `Показать ещё ${Math.min(MPAGE, left)} из ${left}`;
    $('#mastersTotal').textContent = MASTERS.filter(m => !state.city || m.city === state.city).length;
    const counts = {};
    MASTERS.forEach(m => { if (!state.city || m.city === state.city) m.cats.forEach(c => counts[c] = (counts[c] || 0) + 1); });
    $('#serviceCats').innerHTML = `<button class="cat ${ms.cat ? '' : 'active'}" data-scat=""><span>🧰</span>Все услуги</button>` +
      SERVICE_CATS.map(c => `<button class="cat ${ms.cat === c.id ? 'active' : ''}" data-scat="${c.id}"><span>${c.icon}</span>${c.name}<b>${counts[c.id] || 0}</b></button>`).join('');
    $('#popularServices').innerHTML = POPULAR_SERVICES.map(p => `<button class="${norm(ms.q) === norm(p) ? 'active' : ''}" data-q="${p}">${p}</button>`).join('');
  }
  $('#serviceCats').addEventListener('click', e => {
    const b = e.target.closest('[data-scat]'); if (!b) return;
    ms.cat = b.dataset.scat; ms.page = 1; renderMasters();
  });
  $('#popularServices').addEventListener('click', e => {
    const b = e.target.closest('[data-q]'); if (!b) return;
    ms.q = norm(ms.q) === norm(b.dataset.q) ? '' : b.dataset.q; ms.cat = ''; ms.page = 1;
    $('#mastersQuery').value = ms.q; renderMasters();
  });
  $('#mastersSearch').addEventListener('submit', e => { e.preventDefault(); ms.q = $('#mastersQuery').value.trim(); ms.page = 1; if (ms.q) DB.log('masters_search', ms.q.toLowerCase()); renderMasters(); });
  $('#mastersQuery').addEventListener('input', e => { if (!e.target.value) { ms.q = ''; ms.page = 1; renderMasters(); } });
  [['#mfMobile', 'mobile'], ['#mfToday', 'today'], ['#mfWarranty', 'warranty']].forEach(([sel, k]) =>
    $(sel).addEventListener('change', e => { ms[k] = e.target.checked; ms.page = 1; renderMasters(); }));
  $('#mfSort').addEventListener('change', e => { ms.sort = e.target.value; ms.page = 1; renderMasters(); });
  $('#mastersMore').addEventListener('click', () => { ms.page++; renderMasters(true); });
  citySel.addEventListener('change', () => { ms.page = 1; renderMasters(); });
  $('#mastersGrid').addEventListener('click', e => {
    const book = e.target.closest('[data-book]');
    if (book) { const m = MASTERS.find(x => x.id === +book.dataset.book); location.hash = 'master-' + m.id; showMaster(m.id, svcHits(m, ms.q)[0].name); return; }
    if (e.target.closest('a')) return;
    const c = e.target.closest('[data-master]');
    if (c) location.hash = 'master-' + c.dataset.master;
  });

  // карточка мастера и запись
  const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const dayLabel = (d, i) => i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : DAYS[d.getDay()];
  const book = { day: 0, time: '', svc: '' };
  const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function slotBusy(m, dayIdx, h) {
    if (m.real) {
      const d = new Date(); d.setDate(d.getDate() + dayIdx);
      return (dayIdx === 0 && h <= new Date().getHours()) || !!m.busy?.has(`${isoDay(d)}|${pad(h)}:00`);
    }
    const x = Math.sin(m.id * 31 + dayIdx * 7 + h * 13) * 10000;
    const r = x - Math.floor(x);
    if (dayIdx === 0 && (!m.freeToday && r < .85 || h <= new Date().getHours())) return true;
    return r < .35;
  }

  let openMasterId = null;
  function showMaster(id, svcName) {
    const m = MASTERS.find(x => x.id === id);
    if (!m) return;
    if (!svcName && openMasterId === id && !$('#masterModal').hidden) return; // уже открыт (например, на шаге записи)
    if (openMasterId !== id) DB.log('master', `${m.name} #${m.id}`);
    openMasterId = id;
    if (svcName) { Object.assign(book, { day: 0, time: '', svc: svcName }); renderBooking(m); }
    else renderMasterInfo(m);
    if ($('#masterModal').hidden) openModal($('#masterModal'));
    $('#masterModal .modal__box').scrollTop = 0;
  }
  function renderMasterInfo(m) {
    const photos = masterPhotos(m);
    const ph = photos[0];
    $('#masterDetail').innerHTML = `<div class="detail">
      <div class="detail__gallery">
        <div class="detail__main" data-main>${masterImg(m)}<div class="credit">${ph && ph.page ? `<a href="${ph.page}" target="_blank" rel="noopener">Фото: ${esc(ph.author)} · ${esc(ph.license)}</a>` : ''}</div></div>
        ${photos.length > 1 ? `<div class="detail__thumbs">${photos.slice(0, 5).map((p, i) => `<button class="${i ? '' : 'active'}" data-mv="${i}" aria-label="Фото ${i + 1}"><img src="${p.src}" alt=""></button>`).join('')}</div>` : ''}
        <div class="reviews"><div class="lot__label">Отзывы клиентов</div>
          ${m.reviewsList.length ? m.reviewsList.map(r => `<div class="review"><div><b>${esc(r.who)}</b> <span class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</span></div><p>${esc(r.text)}</p><time>${r.days} ${plural(r.days, 'день', 'дня', 'дней')} назад</time></div>`).join('') : '<p class="muted">Пока нет отзывов</p>'}
        </div>
      </div>
      <div class="detail__info">
        <div class="master__cat">${m.cats.map(c => scat(c).icon + ' ' + scat(c).name).join(' · ')}</div>
        <h2 class="detail__title">${esc(m.name)}</h2>
        <div class="master__rating">${ratingHTML(m)}${m.verified ? ' · <span class="ok">✓ проверенный сервис</span>' : ''}</div>
        <div class="m-facts">
          <div>📍<span>${m.city}, ${esc(m.addr)}</span></div>
          <div>🕘<span>${esc(m.hours)}${m.freeToday ? ' · <b class="ok">есть окна сегодня</b>' : ''}</span></div>
          <div>🧑‍🔧<span>Мастер ${esc(m.master)}, опыт ${m.years} ${plural(m.years, 'год', 'года', 'лет')} · ${esc(m.spec)}</span></div>
          ${m.warranty ? `<div>🛡️<span>Гарантия на работу ${m.warranty} мес.</span></div>` : ''}
          ${m.mobile ? '<div>🚐<span>Выезжает к клиенту</span></div>' : ''}
          <div>💬<span>Отвечает примерно за ${m.reply} мин</span></div>
        </div>
        <div><div class="lot__label">Услуги и цены</div>
          <ul class="svc-list">${m.services.map(s => `<li><div><b>${esc(s.name)}</b><small>${esc(s.time)}</small></div><span>${svcPrice(s)}</span><button class="btn btn--ghost" data-svc="${esc(s.name)}">Записаться</button></li>`).join('')}</ul>
        </div>
        <div class="detail__actions">
          <button class="btn btn--primary btn--lg" data-svc="${esc(m.services[0].name)}">Записаться онлайн</button>
          <a class="btn btn--ghost btn--lg" href="tel:${m.phone.replace(/\s/g, '')}">📞</a>
          <a class="btn btn--wa btn--lg" target="_blank" rel="noopener" href="https://wa.me/${m.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Здравствуйте! Пишу с сайта Автобазар насчёт ремонта.`)}">WhatsApp</a>
        </div>
        ${extraActions('master', m)}
      </div></div>`;
    const box = $('#masterDetail');
    box.onclick = e => {
      const s = e.target.closest('[data-svc]');
      if (s) { Object.assign(book, { day: 0, time: '', svc: s.dataset.svc }); renderBooking(m); $('#masterModal .modal__box').scrollTop = 0; return; }
      const t = e.target.closest('[data-mv]');
      if (t) {
        $$('[data-mv]', box).forEach(x => x.classList.toggle('active', x === t));
        const p = photos[+t.dataset.mv];
        $('[data-main]', box).innerHTML = `<img src="${p.src}" alt=""><div class="credit">${p.page ? `<a href="${p.page}" target="_blank" rel="noopener">Фото: ${esc(p.author)} · ${esc(p.license)}</a>` : ''}</div>`;
      }
    };
  }

  function renderBooking(m) {
    if (m.real && !m.busy) {
      m.busy = new Set();
      DB.rpc('ab_busy_slots', { p_master: m.dbId }).then(rows => {
        m.busy = new Set(rows.map(r => `${r.slot_date}|${r.slot_time}`));
        if (openMasterId === m.id && $('#bookForm')) renderBooking(m);
      }).catch(() => { });
    }
    const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
    const hours = [];
    const [h1, h2] = m.allDay || m.hours === 'круглосуточно' ? [8, 22] : m.hours.split('–').map(t => parseInt(t, 10));
    for (let h = h1; h < h2; h++) hours.push(h);
    const svc = m.services.find(s => s.name === book.svc) || m.services[0];
    const typed = Object.fromEntries(['bkName', 'bkPhone', 'bkCar', 'bkNote', 'bkAddr'].map(k => [k, $('#' + k)?.value || '']));
    $('#masterDetail').innerHTML = `<div class="booking">
      <button class="link-btn" data-back>← ${esc(m.name)}</button>
      <h2 class="detail__title">Запись на ремонт</h2>
      <div class="booking__grid">
        <div>
          <div class="lot__label">Услуга</div>
          <div class="opts">${m.services.map(s => `<label class="opt"><input type="radio" name="bkSvc" value="${esc(s.name)}" ${s === svc ? 'checked' : ''}><span><b>${esc(s.name)}</b><small>${svcPrice(s)} · ${esc(s.time)}</small></span></label>`).join('')}</div>
        </div>
        <form id="bookForm">
          <div class="lot__label">Дата</div>
          <div class="days">${days.map((d, i) => `<button type="button" class="${i === book.day ? 'active' : ''}" data-day="${i}"><small>${dayLabel(d, i)}</small><b>${d.getDate()}</b><small>${MONTHS[d.getMonth()]}</small></button>`).join('')}</div>
          <div class="lot__label">Время</div>
          <div class="slots">${hours.map(h => { const t = pad(h) + ':00', busy = slotBusy(m, book.day, h); return `<button type="button" ${busy ? 'disabled' : ''} class="${book.time === t ? 'active' : ''}" data-time="${t}">${t}</button>`; }).join('')}</div>
          <div class="lot__label">Ваши данные</div>
          <div class="bk-fields">
            <input class="inp" id="bkName" placeholder="Имя" required value="${esc(typed.bkName)}">
            <input class="inp" id="bkPhone" type="tel" placeholder="+996 700 123 456" required value="${esc(typed.bkPhone)}">
            <input class="inp bk-wide" id="bkCar" placeholder="Автомобиль: Toyota Camry 2018" value="${esc(typed.bkCar)}">
            ${m.mobile ? `<input class="inp bk-wide" id="bkAddr" placeholder="Адрес, если нужен выезд мастера" value="${esc(typed.bkAddr)}">` : ''}
            <textarea class="inp bk-wide" id="bkNote" rows="2" placeholder="Опишите проблему: трещина на бампере справа, 15 см…">${esc(typed.bkNote)}</textarea>
            <label class="upload bk-wide"><input type="file" accept="image/*" id="bkPhoto" data-preview="bkPreview"><span>📷 Прикрепить фото повреждения</span><img id="bkPreview" alt="" hidden></label>
          </div>
          <div class="total">
            <div><span>${esc(svc.name)}</span><span>${svcPrice(svc)}</span></div>
            <div class="total__sum"><span>${book.time ? `${dayLabel(days[book.day], book.day)}, ${days[book.day].getDate()} ${MONTHS[days[book.day].getMonth()]} в ${book.time}` : 'Выберите время'}</span></div>
          </div>
          <button class="btn btn--primary btn--lg">Записаться</button>
          <p class="muted small">Оплата мастеру после работы. Отменить запись можно в «Мои записи».</p>
        </form>
      </div></div>`;
    const box = $('#masterDetail');
    box.onclick = e => {
      if (e.target.closest('[data-back]')) return renderMasterInfo(m);
      const d = e.target.closest('[data-day]');
      if (d) { book.day = +d.dataset.day; book.time = ''; return renderBooking(m); }
      const t = e.target.closest('[data-time]');
      if (t) { book.time = t.dataset.time; return renderBooking(m); }
    };
    box.onchange = e => { if (e.target.name === 'bkSvc') { book.svc = e.target.value; renderBooking(m); } };
    $('#bookForm').addEventListener('submit', e => {
      e.preventDefault();
      if (!book.time) return toast('Выберите удобное время');
      const phone = $('#bkPhone').value.trim();
      if (phone.replace(/\D/g, '').length < 9) return toast('Проверьте номер телефона');
      const day = days[book.day];
      if (m.real) return requireAuth(() => bookReal(m, svc, day, phone));
      const b = {
        id: Date.now(), masterId: m.id, master: m.name, addr: `${m.city}, ${m.addr}`, phone: m.phone, service: svc.name, price: svc.price,
        when: `${dayLabel(day, book.day)}, ${day.getDate()} ${MONTHS[day.getMonth()]} в ${book.time}`, car: $('#bkCar').value, note: $('#bkNote').value
      };
      myBookings.unshift(b); store.set('unaa_bookings', myBookings); updateBookingsCount();
      $('#masterDetail').innerHTML = `<div class="cart-done"><div class="cart-done__icon">✅</div><h3>Вы записаны!</h3>
        <p><b>${esc(m.name)}</b><br>${esc(b.service)}<br>${b.when}</p>
        <p class="muted">📍 ${esc(b.addr)}<br>Мастер подтвердит запись в WhatsApp на номер ${esc(phone)}.</p>
        <div class="row-btns"><button class="btn btn--primary btn--lg" data-close>Готово</button><button class="btn btn--ghost btn--lg" data-open-mine>Мои записи</button></div></div>`;
      $('[data-open-mine]', $('#masterDetail')).onclick = () => { closeModal($('#masterModal')); openMine(); };
    });
  }

  async function bookReal(m, svc, day, phone) {
    const btn = $('#bookForm .btn--primary');
    busy(btn, true);
    try {
      const photo = await DB.upload($('#bkPhoto')._data);
      const row = await DB.insert('ab_bookings', {
        master_id: m.dbId, service: svc.name, price: svc.price, slot_date: isoDay(day), slot_time: book.time,
        client_name: $('#bkName').value.trim(), client_phone: phone, car: $('#bkCar').value.trim(),
        note: [$('#bkAddr')?.value.trim() && 'Адрес выезда: ' + $('#bkAddr').value.trim(), $('#bkNote').value.trim()].filter(Boolean).join('\n'), photo
      });
      m.busy?.add(`${row.slot_date}|${row.slot_time}`);
      dbBookings.unshift(bookingFromRow(row)); updateBookingsCount();
      $('#masterDetail').innerHTML = `<div class="cart-done"><div class="cart-done__icon">✅</div><h3>Заявка на запись отправлена!</h3>
        <p><b>${esc(m.name)}</b><br>${esc(svc.name)}<br>${dayLabel(day, book.day)}, ${day.getDate()} ${MONTHS[day.getMonth()]} в ${book.time}</p>
        <p class="muted">📍 ${esc(m.city)}, ${esc(m.addr)}<br>Мастер подтвердит запись — статус появится в кабинете.</p>
        <div class="row-btns"><button class="btn btn--primary btn--lg" data-close>Готово</button><button class="btn btn--ghost btn--lg" data-open-mine>Мои записи</button></div></div>`;
      $('[data-open-mine]', $('#masterDetail')).onclick = () => { closeModal($('#masterModal')); openMine(); };
    } catch (err) {
      toast(err.message);
      if (/заняли/.test(err.message)) { m.busy = null; book.time = ''; renderBooking(m); } else busy(btn, false);
    }
  }
  const BOOKING_STATUS = { new: 'ждёт подтверждения', confirmed: 'подтверждена', done: 'выполнена', cancelled: 'отменена' };
  function bookingFromRow(r) {
    const m = MASTERS.find(x => x.dbId === r.master_id);
    const d = new Date(r.slot_date + 'T00:00');
    return {
      id: 'db' + r.id, dbId: r.id, master: m ? m.name : 'Мастер', addr: m ? `${m.city}, ${m.addr}` : '', service: r.service, status: r.status,
      when: `${d.getDate()} ${MONTHS[d.getMonth()]} в ${r.slot_time}`, car: r.car, masterDbId: r.master_id
    };
  }

  // заявка на ремонт: мастера присылают предложения
  const OFFER_NOTES = ['Могу принять сегодня после 15:00', 'Цена окончательная, материалы включены', 'По фото — пайка и покраска, 1 день', 'Даю гарантию 6 месяцев', 'Могу приехать к вам и посмотреть', 'Точную цену скажу на осмотре, он бесплатный', 'Есть оригинальные запчасти в наличии', 'Сделаю за 2–3 часа, пока подождёте'];
  const req = { cat: 'body' };
  function updateBookingsCount() { $('#bookingsCount').textContent = myBookings.length + dbBookings.length + myRequests.length; }
  function openRequest(cat) {
    if (cat) req.cat = cat;
    requireAuth(() => { renderRequestForm(); openModal($('#requestModal')); });
  }
  const requestFromRow = (r, offers = []) => ({ id: r.id, dbId: r.id, cat: r.cat, car: r.car, desc: r.descr, city: r.city, mobile: r.mobile, photo: r.photo || '', created: Date.parse(r.created_at), offers });
  const offerFromRow = o => ({ id: o.id, masterId: 4e6 + o.master_id, price: o.price, svc: '', time: o.time, note: o.note, real: true });
  function renderRequestForm() {
    $('#requestBody').innerHTML = `<h2 class="modal__title">Заявка на ремонт</h2>
      <p class="modal__sub">Её увидят мастера вашего города и пришлют цены. Бесплатно и без звонков.</p>
      <form class="post-form" id="requestForm">
        <div class="field field--full"><label>Что нужно сделать</label><div class="req-cats">${SERVICE_CATS.map(c => `<label><input type="radio" name="cat" value="${c.id}" ${c.id === req.cat ? 'checked' : ''}><span>${c.icon} ${c.name}</span></label>`).join('')}</div></div>
        <div class="field"><label>Марка</label><select name="brand" id="rqBrand">${brandNames.map(b => `<option>${esc(b)}</option>`).join('')}</select></div>
        <div class="field"><label>Модель</label><select name="model" id="rqModel"></select></div>
        <div class="field field--full"><label>Описание</label><textarea name="desc" rows="3" required placeholder="Например: трещина на переднем бампере справа, ~15 см, нужно запаять и покрасить"></textarea></div>
        <div class="field"><label>Город</label><select name="city">${CITIES.map(c => `<option ${c === (state.city || 'Бишкек') ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="field"><label>Телефон</label><input name="phone" type="tel" required placeholder="+996 700 123 456"></div>
        <div class="field field--full"><label>Фото поломки</label><label class="upload"><input type="file" accept="image/*" name="photo" data-preview="rqPreview"><span>📷 Добавить фото — так цена будет точнее</span><img id="rqPreview" alt="" hidden></label></div>
        <label class="check field--full"><input type="checkbox" name="mobile"><span>Нужен выезд мастера или эвакуатор</span></label>
        <button class="btn btn--primary btn--lg field--full">Отправить мастерам</button>
      </form>`;
    const sync = () => fillSelect($('#rqModel'), BRANDS[$('#rqBrand').value].m.map(m => m[0]));
    $('#rqBrand').addEventListener('change', sync); sync();
    $('#requestForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target, d = Object.fromEntries(new FormData(f));
      const btn = $('.btn--primary', f);
      busy(btn, true);
      try {
        const photo = await DB.upload(f.photo._data);
        const row = await DB.insert('ab_requests', { cat: d.cat, car: `${d.brand} ${d.model}`, descr: d.desc, city: d.city, mobile: !!d.mobile, photo });
        const r = requestFromRow(row);
        myRequests.unshift(r); updateBookingsCount();
        if (SHOW_DEMO) scheduleOffers(r);
        renderRequestView(r);
      } catch (err) { toast(err.message); busy(btn, false); }
    });
  }
  function scheduleOffers(r) {
    // демо: отвечают сгенерированные мастера (только при SHOW_DEMO, в базу не пишется)
    const demo = MASTERS.filter(m => !m.real);
    const pool = demo.filter(m => m.cats.includes(r.cat) && m.city === r.city && (!r.mobile || m.mobile));
    const pool2 = pool.length >= 3 ? pool : demo.filter(m => m.cats.includes(r.cat));
    const rest = [...pool2].sort((a, b) => b.rating - a.rating).filter(m => !r.offers.some(o => o.masterId === m.id)).slice(0, 4 - r.offers.length);
    rest.forEach((m, i) => setTimeout(() => {
      const base = m.services.find(s => scat(r.cat).s.some(x => x[0] === s.name)) || m.services[0];
      const price = Math.max(300, Math.round(base.price * (0.9 + Math.random() * .5) / 100) * 100);
      r.offers.push({ masterId: m.id, price, svc: base.name, time: base.time, note: OFFER_NOTES[Math.floor(Math.random() * OFFER_NOTES.length)] });
      toast(`Новое предложение: ${m.name} — ${kgs(price)}`);
      if (!$('#requestModal').hidden && $('#requestBody').dataset.req == r.id) renderRequestView(r);
    }, 1800 + i * 2300 + Math.random() * 1200));
  }
  function offerHTML(o) {
    const m = MASTERS.find(x => x.id === o.masterId);
    if (!m) return '';
    o.svc = o.svc || m.services[0].name;
    return `<div class="offer">
      <div class="offer__top"><div class="offer__img">${masterImg(m)}</div>
        <div><b>${esc(m.name)}</b><div class="master__rating">★ ${m.rating.toFixed(1)} · ${m.reviews} отзывов · ${m.city}</div></div>
        <div class="offer__price">${kgs(o.price)}<small>${esc(o.time)}</small></div></div>
      <p>«${esc(o.note)}»</p>
      <div class="row-btns"><button class="btn btn--primary" data-pick="${m.id}" data-svc="${esc(o.svc)}">Выбрать и записаться</button>
        <a class="btn btn--ghost" href="#master-${m.id}" data-close>Профиль</a></div></div>`;
  }
  function renderRequestView(r) {
    const c = scat(r.cat);
    const body = $('#requestBody');
    body.dataset.req = r.id;
    body.innerHTML = `<h2 class="modal__title">${c.icon} ${c.name}</h2>
      <div class="req-sum">${r.photo ? `<img src="${r.photo}" alt="">` : ''}<div><b>${esc(r.car)}</b> · ${r.city}<p>${esc(r.desc)}</p></div></div>
      ${r.offers.length ? `<div class="waiting done">✓ Получено предложений: ${r.offers.length}. Новые придут сюда и в уведомления</div>` : '<div class="waiting"><span class="spinner"></span>Заявка отправлена мастерам вашего города. Ждём предложения…</div>'}
      <div class="offers">${[...r.offers].sort((a, b) => a.price - b.price).map(offerHTML).join('')}</div>`;
    body.onclick = e => {
      const p = e.target.closest('[data-pick]');
      if (p) { closeModal($('#requestModal')); location.hash = 'master-' + p.dataset.pick; showMaster(+p.dataset.pick, p.dataset.svc); }
    };
  }

  // мои записи и заявки
  function openMine() {
    const body = $('#requestBody');
    body.dataset.req = '';
    body.innerHTML = `<h2 class="modal__title">Мои записи и заявки</h2>
      <div class="lot__label">Записи к мастерам</div>
      ${[...dbBookings, ...myBookings].length ? [...dbBookings, ...myBookings].map(b => `<div class="mine"><div><b>${esc(b.service)}</b><p>${esc(b.master)} · ${esc(b.addr)}</p><small>🗓 ${esc(b.when)}${b.car ? ' · ' + esc(b.car) : ''}${b.status ? ` · <b class="st st--${b.status}">${BOOKING_STATUS[b.status]}</b>` : ''}</small></div>${b.status === 'cancelled' || b.status === 'done' ? '' : `<button class="link-btn muted" data-cancel="${b.id}">Отменить</button>`}</div>`).join('') : '<p class="muted">Записей пока нет</p>'}
      <div class="lot__label" style="margin-top:16px">Заявки на ремонт</div>
      ${myRequests.length ? myRequests.map(r => `<button class="mine mine--btn" data-req="${r.id}"><div><b>${scat(r.cat).icon} ${scat(r.cat).name}</b><p>${esc(r.car)} · ${esc(r.desc).slice(0, 60)}</p><small>${r.offers.length} ${plural(r.offers.length, 'предложение', 'предложения', 'предложений')}${r.offers.length ? ' · от ' + kgs(Math.min(...r.offers.map(o => o.price))) : ''}</small></div><span>→</span></button>`).join('') : '<p class="muted">Заявок пока нет</p>'}
      <button class="btn btn--primary btn--lg wide" data-new-req>Новая заявка на ремонт</button>`;
    body.onclick = e => {
      const c = e.target.closest('[data-cancel]');
      if (c) {
        const id = c.dataset.cancel;
        const db = dbBookings.find(b => b.id === id);
        if (db) {
          DB.update('ab_bookings', db.dbId, { status: 'cancelled' }).then(() => { db.status = 'cancelled'; toast('Запись отменена'); openMine(); }).catch(err => toast(err.message));
          return;
        }
        myBookings.splice(myBookings.findIndex(b => b.id === +id), 1);
        store.set('unaa_bookings', myBookings); updateBookingsCount(); toast('Запись отменена'); return openMine();
      }
      const r = e.target.closest('[data-req]');
      if (r) return renderRequestView(myRequests.find(x => x.id === +r.dataset.req));
      if (e.target.closest('[data-new-req]')) requireAuth(renderRequestForm);
    };
    if ($('#requestModal').hidden) openModal($('#requestModal'));
  }
  $('#openRequest').addEventListener('click', () => openRequest(ms.cat || 'body'));
  $$('[data-open-request]').forEach(b => b.addEventListener('click', () => openRequest(ms.cat || 'body')));
  $('#myBookings').addEventListener('click', openMine);

  // стать мастером
  $('#bCity').innerHTML = CITIES.map(c => `<option>${c}</option>`).join('');
  $('#bCats').innerHTML = SERVICE_CATS.map((c, i) => `<label class="check"><input type="checkbox" name="cats" value="${c.id}" ${i ? '' : 'checked'}><span>${c.icon} ${c.name}</span></label>`).join('');
  $('#openBecome').addEventListener('click', () => openModal($('#becomeModal')));
  $('#becomeForm').addEventListener('submit', e => { e.preventDefault(); requireAuth(() => publishMaster(e.target)); });
  async function publishMaster(f) {
    const ed = editing?.kind === 'master' ? editing : null;
    const d = new FormData(f);
    const cats = d.getAll('cats');
    if (!cats.length) return toast('Выберите хотя бы одно направление');
    const services = d.get('services').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 40).map(l => {
      const m = l.match(/^(.*?)[\s—–:-]+(\d[\d\s]*)\s*(сом)?$/);
      return m ? { name: m[1].trim(), price: +m[2].replace(/\s/g, ''), time: 'по договорённости' } : { name: l, price: 0, time: 'по договорённости' };
    });
    const btn = $('.btn--primary', f);
    busy(btn, true);
    try {
      const photo = await DB.upload(f.photo._data);
      const fields = {
        name: d.get('name'), master: d.get('master'), years: +d.get('years') || 1, city: d.get('city'), addr: d.get('addr'), cats, services,
        hours: d.get('hours') || '09:00–19:00', phone: d.get('phone'), mobile: !!d.get('mobile'), warranty: d.get('warranty') ? 3 : 0, photo
      };
      const row = ed ? await DB.update('ab_masters', ed.dbId, fields) : await DB.insert('ab_masters', fields);
      const m = masterFromRow(row);
      const old = MASTERS.findIndex(x => x.id === m.id);
      if (old >= 0) MASTERS.splice(old, 1);
      MASTERS.unshift(m);
      applyReviews();
      closeModal($('#becomeModal')); f.reset(); f.photo._data = ''; $('#bPreview').hidden = true;
      ms.cat = ''; ms.q = ''; renderMasters();
      toast(ed ? 'Изменения сохранены' : 'Профиль опубликован! Заявки и записи — в «Кабинете мастера»');
      location.hash = 'master-' + m.id;
    } catch (err) { toast(err.message); } finally { busy(btn, false); }
  }

  // ---------- аккаунт: вход, регистрация ----------
  function busy(btn, on) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.disabled = true; btn.innerHTML = '<span class="spinner spinner--light"></span>'; }
    else { btn.disabled = false; if (btn.dataset.label) btn.textContent = btn.dataset.label; }
  }
  let afterAuth = null;
  function requireAuth(fn) {
    if (DB.user) return fn();
    afterAuth = fn;
    renderAuth('login', 'Войдите или зарегистрируйтесь — это займёт минуту.');
    openModal($('#authModal'));
  }
  function renderAuth(mode, note = '') {
    if (mode === 'forgot' || mode === 'newpass') return renderAuthExtra(mode, note);
    const login = mode === 'login';
    $('#authBody').innerHTML = `<h2 class="modal__title">${login ? 'Вход' : 'Регистрация'}</h2>
      <div class="seg auth-seg"><label><input type="radio" name="authMode" value="login" ${login ? 'checked' : ''}><span>Вход</span></label><label><input type="radio" name="authMode" value="signup" ${login ? '' : 'checked'}><span>Регистрация</span></label></div>
      ${note ? `<div class="auth-note">${note}</div>` : ''}
      <form class="auth-form" id="authForm">
        ${login ? '' : `<input class="inp" name="name" placeholder="Ваше имя" required maxlength="80" autocomplete="name">
        <input class="inp" name="phone" type="tel" placeholder="+996 700 123 456" required autocomplete="tel">`}
        <input class="inp" name="email" type="email" placeholder="Email" required autocomplete="email">
        <input class="inp" name="password" type="password" placeholder="Пароль (не короче 6 символов)" minlength="6" required autocomplete="${login ? 'current-password' : 'new-password'}">
        ${login ? '' : '<label class="check consent"><input type="checkbox" required><span>Принимаю <a href="terms.html" target="_blank">пользовательское соглашение</a> и <a href="privacy.html" target="_blank">политику конфиденциальности</a></span></label>'}
        <button class="btn btn--primary btn--lg">${login ? 'Войти' : 'Создать аккаунт'}</button>
      </form>
      ${login ? '<button class="link-btn" data-forgot>Забыли пароль?</button>' : ''}
      <p class="muted small">Аккаунт нужен, чтобы размещать объявления, делать ставки, записываться к мастерам и оформлять заказы.</p>`;
    $('[data-forgot]', $('#authBody'))?.addEventListener('click', () => renderAuth('forgot'));
    $$('input[name="authMode"]', $('#authBody')).forEach(r => r.addEventListener('change', () => renderAuth(r.value)));
    $('#authForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target, btn = $('.btn--primary', f);
      busy(btn, true);
      try {
        if (login) {
          await DB.signIn(f.email.value.trim(), f.password.value);
          toast('Вы вошли');
        } else {
          const phone = f.phone.value.trim();
          if (phone.replace(/\D/g, '').length < 9) throw new Error('Проверьте номер телефона');
          const { needsConfirm } = await DB.signUp(f.email.value.trim(), f.password.value, f.name.value.trim(), phone);
          if (needsConfirm) return renderAuth('login', `📩 Мы отправили письмо на <b>${esc(f.email.value.trim())}</b>. Откройте ссылку из письма, чтобы подтвердить email, затем войдите здесь.`);
          toast('Аккаунт создан');
        }
      } catch (err) { toast(err.message); busy(btn, false); }
    });
  }
  function updateAccBtn() {
    const b = $('#accBtn');
    const badge = $('.badge', b);
    badge.textContent = unread; badge.dataset.n = DB.user ? unread : 0;
    b.setAttribute('aria-label', DB.user ? 'Личный кабинет' : 'Войти');
    b.classList.toggle('on', !!DB.user);
    $('.acc-btn__dot', b).hidden = !DB.user;
  }
  $('#accBtn').addEventListener('click', () => DB.user ? openCabinet() : (renderAuth('login'), openModal($('#authModal'))));

  // мои записи, заявки и предложения мастеров (после входа)
  async function loadMine() {
    myRequests.length = 0; dbBookings = [];
    if (DB.user) {
      try {
        const uid = DB.user.id;
        const [bk, rq, of] = await Promise.all([
          DB.select('ab_bookings', q => q.eq('user_id', uid).order('created_at', { ascending: false })),
          DB.select('ab_requests', q => q.eq('user_id', uid).order('created_at', { ascending: false })),
          DB.select('ab_offers', q => q.order('price'))
        ]);
        dbBookings = bk.map(bookingFromRow);
        myRequests.push(...rq.map(r => requestFromRow(r, of.filter(o => o.request_id === r.id).map(offerFromRow))));
      } catch (e) { toast(e.message); }
    }
    updateBookingsCount();
  }

  // ---------- личный кабинет ----------
  const cab = { tab: 'ads' };
  const ORDER_STATUS = { new: 'принят', confirmed: 'подтверждён', shipped: 'в пути', done: 'выполнен', cancelled: 'отменён' };
  const AD_STATUS = { active: 'опубликовано', sold: 'продано', hidden: 'снято с публикации' };
  const myMasterProfiles = () => MASTERS.filter(m => m.real && m.uid === DB.user?.id);
  function openCabinet(tab) {
    if (tab) cab.tab = tab;
    openModal($('#cabModal'));
    renderCab();
  }
  async function renderCab() {
    if (!DB.user) return closeModal($('#cabModal'));
    const pr = DB.profile || {};
    const tabs = [['ads', 'Объявления'], ['chats', `Сообщения${unread ? ` (${unread})` : ''}`], ['orders', 'Заказы'], ['sales', 'Продажи'], ['bookings', 'Записи и заявки'], ['auction', 'Аукцион'], ['master', 'Кабинет мастера'], ['profile', 'Профиль'], ...(isAdmin ? [['admin', '⚙️ Админ']] : [])];
    $('#cabBody').innerHTML = `<div class="cab-head"><div class="seller__ava" style="background:var(--red)">${esc((pr.name || DB.user.email)[0].toUpperCase())}</div>
        <div><b>${esc(pr.name || 'Без имени')}</b><small>${esc(DB.user.email)}${pr.phone ? ' · ' + esc(pr.phone) : ''}</small></div>
        <button class="link-btn muted" data-logout>Выйти</button></div>
      <div class="cab-tabs">${tabs.map(([k, v]) => `<button class="${cab.tab === k ? 'active' : ''}" data-tab="${k}">${v}</button>`).join('')}</div>
      <div id="cabPane"><div class="waiting"><span class="spinner"></span>Загружаем…</div></div>`;
    try { $('#cabPane').innerHTML = await CAB[cab.tab](); }
    catch (e) { $('#cabPane').innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
  }
  const emptyNote = (t, btn = '') => `<div class="cab-empty"><p>${t}</p>${btn}</div>`;
  const CAB = {
    async profile() {
      const pr = DB.profile || {};
      const tgLink = TELEGRAM_BOT && pr.tg_code ? `https://t.me/${TELEGRAM_BOT}?start=${pr.tg_code}` : '';
      return `<form class="cab-form" data-form="profile">
        <label>Имя<input class="inp" name="name" value="${esc(pr.name || '')}" maxlength="80" required></label>
        <label>Телефон<input class="inp" name="phone" type="tel" value="${esc(pr.phone || '')}" required></label>
        <div class="lot__label" style="margin-top:6px">Уведомления о записях, заказах, сообщениях и ставках</div>
        <div class="opts">
          <label class="opt"><input type="radio" name="notify" value="none" ${pr.notify === 'none' || !pr.notify ? 'checked' : ''}><span><b>Только на сайте</b><small>когда сайт открыт</small></span></label>
          <label class="opt"><input type="radio" name="notify" value="telegram" ${pr.notify === 'telegram' ? 'checked' : ''}><span><b>Telegram</b><small>${pr.tg_chat_id ? '✓ подключён' : 'нужно подключить бота'}</small></span></label>
          <label class="opt"><input type="radio" name="notify" value="whatsapp" ${pr.notify === 'whatsapp' ? 'checked' : ''}><span><b>WhatsApp</b><small>на номер ниже</small></span></label>
          <label class="opt"><input type="radio" name="notify" value="email" ${pr.notify === 'email' ? 'checked' : ''}><span><b>Email</b><small>${esc(DB.user.email)}</small></span></label>
        </div>
        ${tgLink ? `<a class="btn btn--ghost" href="${tgLink}" target="_blank" rel="noopener">${pr.tg_chat_id ? '🔄 Переподключить Telegram' : '📲 Подключить Telegram'}</a>`
          : '<p class="muted small" style="text-align:left">Telegram-бот ещё не настроен администратором.</p>'}
        <label>Номер WhatsApp<input class="inp" name="wa_phone" type="tel" value="${esc(pr.wa_phone || '')}" placeholder="+996 700 123 456"></label>
        <button class="btn btn--primary">Сохранить</button></form>
        <p class="muted small" style="text-align:left">Имя показывается в аукционе и чатах (например, «${esc((pr.name || 'Азамат').split(' ')[0])} #${DB.user.id.slice(0, 3).toUpperCase()}»).</p>
        <div class="lot__label" style="margin-top:18px">Push-уведомления на этом устройстве</div>
        <div class="row-btns row-btns--left"><button class="btn btn--ghost" data-push>${(await pushSubscription()) ? '🔕 Отключить push' : '🔔 Включить push'}</button><button class="btn btn--ghost" data-test-notify>Проверить уведомления</button></div>
        <p class="muted small" style="text-align:left">Push приходят, даже когда сайт закрыт. На iPhone — если сайт добавлен на экран «Домой».</p>
        <div class="lot__label" style="margin-top:18px">Удаление аккаунта</div>
        <button class="btn btn--ghost danger" data-delete-me>Удалить аккаунт и все мои данные</button>`;
    },
    async ads() {
      const uid = DB.user.id;
      const [cars, parts] = await Promise.all([
        DB.select('ab_cars', q => q.eq('user_id', uid).order('created_at', { ascending: false })),
        DB.select('ab_parts', q => q.eq('user_id', uid).order('created_at', { ascending: false }))
      ]);
      const row = (t, r, title, price, img) => `<div class="cab-item">
        <div class="cab-item__img">${img ? `<img src="${img}" alt="">` : '🚗'}</div>
        <div class="cab-item__info"><b>${esc(title)}</b><small>${price} · <span class="st st--${r.status}">${AD_STATUS[r.status]}</span> · ${ago(Date.parse(r.created_at))}</small></div>
        <div class="cab-item__act">
          ${r.status === 'active' ? `<button class="btn btn--ghost" data-ad="${t}|${r.id}|sold">Продано</button><button class="btn btn--ghost" data-ad="${t}|${r.id}|hidden">Снять</button>` : `<button class="btn btn--ghost" data-ad="${t}|${r.id}|active">Вернуть</button>`}
          <button class="btn btn--ghost" data-edit="${t === 'ab_cars' ? 'car' : 'part'}|${r.id}" aria-label="Изменить">✏️</button>
          <button class="btn btn--ghost danger" data-ad="${t}|${r.id}|delete" aria-label="Удалить">🗑</button></div></div>`;
      return `<div class="lot__label">Автомобили</div>${cars.length ? cars.map(r => row('ab_cars', r, `${r.brand} ${r.model}, ${r.year}`, usd(r.price), r.photos[0])).join('') : emptyNote('Вы ещё не продаёте авто', '<button class="btn btn--primary" data-go="car">Продать авто</button>')}
        <div class="lot__label" style="margin-top:16px">Запчасти</div>${parts.length ? parts.map(r => row('ab_parts', r, r.title, kgs(r.price), r.photo)).join('') : emptyNote('Запчастей пока нет', '<button class="btn btn--primary" data-go="part">Продать запчасть</button>')}`;
    },
    async orders() {
      const list = await DB.select('ab_orders', q => q.eq('user_id', DB.user.id).order('created_at', { ascending: false }));
      return list.length ? list.map(o => `<div class="cab-card"><div class="cab-card__top"><b>Заказ № AB-${o.id}</b><span class="st st--${o.status}">${ORDER_STATUS[o.status]}</span></div>
        <ul>${o.items.map(i => `<li><span>${esc(i.title)} × ${i.q}</span><b>${kgs(i.price * i.q)}</b></li>`).join('')}</ul>
        <small>${esc(o.delivery)} · ${esc(o.pay)} · ${ago(Date.parse(o.created_at))}</small><div class="cab-card__sum">Итого: ${kgs(o.total)}</div>
        ${o.status === 'new' ? `<div class="row-btns row-btns--left"><button class="btn btn--ghost" data-ord="${o.id}|cancelled">Отменить заказ</button></div>` : ''}</div>`).join('')
        : emptyNote('Заказов пока нет', '<a href="#parts" class="btn btn--primary" data-close>Перейти в запчасти</a>');
    },
    async bookings() {
      await loadMine();
      const b = dbBookings, r = myRequests;
      return `<div class="lot__label">Записи к мастерам</div>
        ${b.length ? b.map(x => `<div class="mine mine--col"><div><b>${esc(x.service)}</b><p>${esc(x.master)} · ${esc(x.addr)}</p><small>🗓 ${esc(x.when)} · <b class="st st--${x.status}">${BOOKING_STATUS[x.status]}</b></small></div>${x.status === 'done' ? reviewForm(x.masterDbId) : ''}</div>`).join('') : emptyNote('Записей пока нет', '<a href="#masters" class="btn btn--primary" data-close>Найти мастера</a>')}
        <div class="lot__label" style="margin-top:16px">Заявки на ремонт</div>
        ${r.length ? r.map(x => `<button class="mine mine--btn" data-open-req="${x.id}"><div><b>${scat(x.cat).icon} ${scat(x.cat).name}</b><p>${esc(x.car)} · ${esc(x.desc).slice(0, 60)}</p><small>${x.offers.length} ${plural(x.offers.length, 'предложение', 'предложения', 'предложений')}</small></div><span>→</span></button>`).join('') : emptyNote('Заявок пока нет', '<button class="btn btn--primary" data-go="request">Оставить заявку</button>')}`;
    },
    async auction() {
      const uid = DB.user.id;
      const mine = lots.filter(l => l.bids.some(isMe));
      const wins = await DB.select('ab_wins', q => q.eq('user_id', uid).order('ended_at', { ascending: false }));
      return `<div class="lot__label">Лоты с моими ставками</div>
        ${mine.length ? mine.map(l => { const c = carOf(l), st = lotStatus(l), lead = isMe(lotLeader(l)); const myMax = Math.max(...l.bids.filter(isMe).map(b => b.amount));
          return `<button class="mine mine--btn" data-open-lot="${l.id}"><div><b>${esc(c.brand)} ${esc(c.model)}, ${c.year}</b><p>Моя ставка ${usd(myMax)} · текущая ${usd(lotPrice(l))}</p>
          <small class="${lead ? 'ok' : ''}">${st === 'live' ? (lead ? 'вы лидируете' : 'ставку перебили') + ' · ' + timerText(l) : st === 'done' ? (lead ? '🎉 вы выиграли' : 'торги завершены') : 'скоро'}</small></div><span>→</span></button>`; }).join('')
          : emptyNote('Вы ещё не делали ставок', '<a href="#auction" class="btn btn--primary" data-close>Перейти к торгам</a>')}
        ${wins.length ? `<div class="lot__label" style="margin-top:16px">Выигранные лоты</div>${wins.map(w => `<div class="mine"><div><b>${esc(w.car.brand)} ${esc(w.car.model)}, ${w.car.year}</b><p>${usd(w.amount)}</p><small>${ago(Date.parse(w.ended_at))}</small></div></div>`).join('')}` : ''}`;
    },
    async master() {
      const my = myMasterProfiles();
      if (!my.length) return emptyNote('Добавьте свой автосервис — клиенты смогут записываться онлайн, а вы будете получать заявки на ремонт.', '<button class="btn btn--primary" data-go="master">Добавить сервис</button>');
      const ids = my.map(m => m.dbId), uid = DB.user.id;
      const cats = [...new Set(my.flatMap(m => m.cats))], cities = [...new Set(my.map(m => m.city))];
      const [bk, rq, of] = await Promise.all([
        DB.select('ab_bookings', q => q.in('master_id', ids).neq('status', 'cancelled').order('slot_date').order('slot_time')),
        DB.select('ab_requests', q => q.eq('status', 'open').neq('user_id', uid).in('cat', cats).in('city', cities).order('created_at', { ascending: false }).limit(30)),
        DB.select('ab_offers', q => q.eq('user_id', uid))
      ]);
      const mName = id => (my.find(m => m.dbId === id) || {}).name || '';
      return `<div class="cab-profiles">${my.map(m => `<span class="chip"><a href="#master-${m.id}" data-close>${esc(m.name)}${m.verified ? ' ✓' : ''}</a><button data-edit="master|${m.dbId}" aria-label="Изменить">✏️</button></span>`).join('')}</div>
        <div class="lot__label">Записи клиентов</div>
        ${bk.length ? bk.map(b => `<div class="cab-card"><div class="cab-card__top"><b>${esc(b.service)}</b><span class="st st--${b.status}">${BOOKING_STATUS[b.status]}</span></div>
          <p>🗓 ${new Date(b.slot_date + 'T00:00').getDate()} ${MONTHS[new Date(b.slot_date + 'T00:00').getMonth()]} в ${b.slot_time} · ${esc(mName(b.master_id))}</p>
          <p>👤 ${esc(b.client_name)} · <a href="tel:${esc(b.client_phone.replace(/\s/g, ''))}">${esc(b.client_phone)}</a>${b.car ? ' · ' + esc(b.car) : ''}</p>
          ${b.note ? `<p class="muted">${esc(b.note)}</p>` : ''}${b.photo ? `<a href="${b.photo}" target="_blank" rel="noopener"><img class="cab-photo" src="${b.photo}" alt="Фото поломки"></a>` : ''}
          <div class="row-btns row-btns--left">${b.status === 'new' ? `<button class="btn btn--primary" data-bk="${b.id}|confirmed">Подтвердить</button>` : ''}${b.status === 'confirmed' ? `<button class="btn btn--primary" data-bk="${b.id}|done">Выполнено</button>` : ''}${b.status !== 'done' ? `<button class="btn btn--ghost" data-bk="${b.id}|cancelled">Отменить</button>` : ''}</div></div>`).join('') : emptyNote('Новых записей нет — они появятся здесь сразу после записи клиента')}
        <div class="lot__label" style="margin-top:16px">Заявки на ремонт в вашем городе</div>
        ${rq.length ? rq.map(r => { const sent = of.find(o => o.request_id === r.id);
          return `<div class="cab-card"><div class="cab-card__top"><b>${scat(r.cat).icon} ${scat(r.cat).name}</b><small>${r.city} · ${ago(Date.parse(r.created_at))}</small></div>
          <p><b>${esc(r.car)}</b> — ${esc(r.descr)}${r.mobile ? ' · <b>нужен выезд</b>' : ''}</p>${r.photo ? `<a href="${r.photo}" target="_blank" rel="noopener"><img class="cab-photo" src="${r.photo}" alt="Фото"></a>` : ''}
          ${sent ? `<div class="waiting done">✓ Вы предложили ${kgs(sent.price)}${sent.time ? ', ' + esc(sent.time) : ''}</div>`
            : `<form class="offer-form" data-offer="${r.id}">
              ${my.length > 1 ? `<select class="inp" name="master">${my.filter(m => m.cats.includes(r.cat)).map(m => `<option value="${m.dbId}">${esc(m.name)}</option>`).join('')}</select>` : `<input type="hidden" name="master" value="${my[0].dbId}">`}
              <input class="inp" name="price" type="number" min="0" required placeholder="Цена, сом">
              <input class="inp" name="time" placeholder="Срок: 1 день">
              <input class="inp offer-form__wide" name="note" maxlength="500" placeholder="Комментарий: что сделаете, гарантия, когда можете принять">
              <button class="btn btn--primary offer-form__wide">Отправить предложение</button></form>`}</div>`; }).join('')
          : emptyNote('Открытых заявок по вашим направлениям пока нет. Новые придут уведомлением.')}`;
    }
  };
  $('#cabBody').addEventListener('click', async e => {
    const t = e.target.closest('[data-tab]');
    if (t) { cab.tab = t.dataset.tab; return renderCab(); }
    if (e.target.closest('[data-logout]')) { await DB.signOut(); closeModal($('#cabModal')); return toast('Вы вышли из аккаунта'); }
    const go = e.target.closest('[data-go]');
    if (go) {
      closeModal($('#cabModal'));
      const w = go.dataset.go;
      if (w === 'request') return openRequest(ms.cat || 'body');
      return openModal($({ car: '#postModal', part: '#partPostModal', master: '#becomeModal' }[w]));
    }
    const ad = e.target.closest('[data-ad]');
    if (ad) {
      const [table, id, action] = ad.dataset.ad.split('|');
      if (action === 'delete' && !confirm('Удалить объявление навсегда?')) return;
      if (isAdmin && cab.tab === 'admin') adminLog('ad_' + action, ad.dataset.ad);
      try {
        if (action === 'delete') await DB.remove(table, +id);
        else await DB.update(table, +id, { status: action });
        const arr = table === 'ab_cars' ? ALL : PARTS, base = table === 'ab_cars' ? 2e6 : 3e6;
        const i = arr.findIndex(x => x.id === base + +id);
        if (i >= 0 && action !== 'active') arr.splice(i, 1);
        if (action === 'active') await loadRemote();
        render(); renderParts();
        toast(action === 'delete' ? 'Удалено' : action === 'sold' ? 'Отмечено как продано' : action === 'hidden' ? 'Снято с публикации' : 'Снова опубликовано');
        renderCab();
      } catch (err) { toast(err.message); }
      return;
    }
    const bk = e.target.closest('[data-bk]');
    if (bk) {
      const [id, status] = bk.dataset.bk.split('|');
      try { await DB.update('ab_bookings', +id, { status }); toast('Статус записи: ' + BOOKING_STATUS[status]); renderCab(); }
      catch (err) { toast(err.message); }
      return;
    }
    const ord = e.target.closest('[data-ord]');
    if (ord) {
      const [id, status] = ord.dataset.ord.split('|');
      if (status === 'cancelled' && !confirm('Отменить заказ?')) return;
      try { await DB.update('ab_orders', +id, { status }); toast('Заказ: ' + ORDER_STATUS[status]); renderCab(); } catch (err) { toast(err.message); }
      return;
    }
    if (await adminClick(e)) return;
    const oc = e.target.closest('[data-open-chat]');
    if (oc) return showChat(+oc.dataset.openChat);
    const rq = e.target.closest('[data-open-req]');
    if (rq) { closeModal($('#cabModal')); renderRequestView(myRequests.find(x => x.id === +rq.dataset.openReq)); return openModal($('#requestModal')); }
    const lt = e.target.closest('[data-open-lot]');
    if (lt) { closeModal($('#cabModal')); location.hash = 'lot-' + lt.dataset.openLot; }
  });
  $('#cabBody').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, btn = $('.btn--primary', f);
    busy(btn, true);
    try {
      if (f.dataset.form === 'profile') {
        const phone = f.phone.value.trim();
        if (phone.replace(/\D/g, '').length < 9) throw new Error('Проверьте номер телефона');
        const notify = f.notify.value, wa = f.wa_phone.value.trim();
        if (notify === 'whatsapp' && wa.replace(/\D/g, '').length < 9) throw new Error('Укажите номер WhatsApp');
        if (notify === 'telegram' && !DB.profile?.tg_chat_id) toast('Нажмите «Подключить Telegram» и отправьте боту /start');
        await DB.saveProfile({ name: f.name.value.trim(), phone, notify, wa_phone: wa });
        toast('Профиль сохранён'); return renderCab();
      }
      if (f.dataset.form === 'review') {
        await DB.insert('ab_reviews', { master_id: +f.dataset.master, rating: +f.rating.value, text: f.text.value.trim() });
        await loadReviews(); toast('Спасибо за отзыв!'); return renderCab();
      }
      if (f.dataset.form === 'lot') { await createLot(f); return renderCab(); }
      if (f.dataset.offer) {
        await DB.insert('ab_offers', { request_id: +f.dataset.offer, master_id: +f.master.value, price: +f.price.value, time: f.time.value.trim(), note: f.note.value.trim() });
        toast('Предложение отправлено клиенту'); return renderCab();
      }
    } catch (err) { toast(err.message); busy(btn, false); }
  });

  // ---------- данные из базы и обновления в реальном времени ----------
  async function loadRemote() {
    try {
      const [cars, parts, masters] = await Promise.all([
        DB.select('ab_cars', q => q.eq('status', 'active').order('created_at', { ascending: false }).limit(500)),
        DB.select('ab_parts', q => q.eq('status', 'active').order('created_at', { ascending: false }).limit(1000)),
        DB.select('ab_masters', q => q.order('created_at', { ascending: false }))
      ]);
      const drop = (arr, test) => { for (let i = arr.length - 1; i >= 0; i--) if (test(arr[i])) arr.splice(i, 1); };
      drop(ALL, c => c.dbId); drop(PARTS, p => p.dbId); drop(MASTERS, m => m.real);
      ALL.unshift(...cars.map(carFromRow)); PARTS.unshift(...parts.map(partFromRow)); MASTERS.unshift(...masters.map(masterFromRow));
      await loadReviews();
      render(); renderParts(); renderMasters();
    } catch (e) { toast('Не удалось загрузить объявления: ' + e.message); }
  }
  function startBackend() {
    renderLots();
    DB.init().then(async () => {
      updateAccBtn();
      await loadRemote();
      await Promise.all([loadLots(), loadMine(), afterLogin(), loadRate()]);
      route();
      DB.log('visit', document.referrer ? new URL(document.referrer).hostname : '');
    }).catch(e => toast(DB.humanError(e)));
    DB.onAuth(async u => {
      updateAccBtn();
      await Promise.all([loadMine(), afterLogin()]);
      refreshAuction(); renderMasters();
      if (!u) return;
      if (afterAuth) { const fn = afterAuth; afterAuth = null; closeModal($('#authModal')); fn(); }
      else if (!$('#authModal').hidden) closeModal($('#authModal'));
    });
    DB.onRecovery(() => { renderAuth('newpass'); openModal($('#authModal')); });
    DB.listen('ab_bids', onBid);
    DB.listen('ab_messages', onMessage);
    DB.listen('ab_orders', ({ eventType, new: o }) => {
      if (!DB.user || !o) return;
      if (eventType === 'INSERT' && (o.seller_ids || []).includes(DB.user.id)) toast(`🛒 Новый заказ № AB-${o.id} на ваши запчасти`);
      if (eventType === 'UPDATE' && o.user_id === DB.user.id) toast(`Заказ № AB-${o.id}: ${ORDER_STATUS[o.status]}`);
      if (!$('#cabModal').hidden && ['orders', 'sales'].includes(cab.tab)) renderCab();
    });
    DB.listen('ab_lots', onLot);
    DB.listen('ab_offers', ({ eventType, new: o }) => {
      if (eventType !== 'INSERT') return;
      const r = myRequests.find(x => x.id === o.request_id);
      if (!r || r.offers.some(x => x.id === o.id)) return;
      r.offers.push(offerFromRow(o));
      const m = MASTERS.find(x => x.dbId === o.master_id);
      toast(`Новое предложение: ${m ? m.name : 'мастер'} — ${kgs(o.price)}`);
      if (!$('#requestModal').hidden && $('#requestBody').dataset.req == r.id) renderRequestView(r);
    });
    DB.listen('ab_bookings', ({ eventType, new: b }) => {
      if (!DB.user || !b) return;
      const mine = myMasterProfiles().some(m => m.dbId === b.master_id);
      if (eventType === 'INSERT' && mine && b.user_id !== DB.user.id) toast(`🔔 Новая запись: ${b.service}, ${b.slot_time}`);
      if (eventType === 'UPDATE' && b.user_id === DB.user.id) {
        const x = dbBookings.find(y => y.dbId === b.id);
        if (x && x.status !== b.status) { x.status = b.status; toast(`Запись «${b.service}»: ${BOOKING_STATUS[b.status]}`); }
      }
      if (!$('#cabModal').hidden && (cab.tab === 'master' || cab.tab === 'bookings')) renderCab();
    });
    DB.listen('ab_requests', ({ eventType, new: r }) => {
      if (eventType !== 'INSERT' || !DB.user || r.user_id === DB.user.id) return;
      const my = myMasterProfiles();
      if (my.some(m => m.cats.includes(r.cat) && m.city === r.city)) {
        toast(`🔔 Новая заявка: ${scat(r.cat).name}, ${r.car}`);
        if (!$('#cabModal').hidden && cab.tab === 'master') renderCab();
      }
    });
  }

  // ---------- действия в карточке: написать, изменить, пожаловаться ----------
  function extraActions(kind, x) {
    const own = !!x.uid && x.uid === DB.user?.id;
    const title = kind === 'car' ? `${x.brand} ${x.model}, ${x.year}` : kind === 'part' ? x.title : x.name;
    const t = encodeURIComponent(title);
    return `<div class="extra-acts">
      ${x.uid && !own ? `<button class="btn btn--ghost" data-chat="${x.uid}|${kind}:${x.dbId}|${t}">💬 ${kind === 'master' ? 'Написать мастеру' : 'Написать продавцу'}</button>` : ''}
      ${own ? `<button class="btn btn--ghost" data-edit="${kind}|${x.dbId}">✏️ Редактировать</button><span class="muted small">Это ваше ${kind === 'master' ? 'профиль' : 'объявление'}</span>` : ''}
      ${kind === 'car' ? '' : `<button class="btn btn--ghost" data-share="${kind}|${x.id}|${t}">↗ Поделиться</button>`}
      ${own ? '' : `<button class="link-btn muted" data-report="${kind}|${x.id}|${t}">⚑ Пожаловаться</button>`}
    </div>`;
  }
  // ссылка на страницу превью (share/*.html) — с фото и ценой в WhatsApp/Telegram
  const shareUrl = (kind, id) => location.origin + location.pathname.replace(/[^/]*$/, '') + `share/${kind}-${id}.html`;
  async function shareLink(kind, id, title) {
    const url = shareUrl(kind, id);
    try {
      if (navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); toast('Ссылка скопирована'); }
    } catch { }
  }
  document.addEventListener('click', e => {
    const sh = e.target.closest('[data-share]');
    if (sh) { const [kind, id, t] = sh.dataset.share.split('|'); return shareLink(kind, +id, decodeURIComponent(t)); }
    const ch = e.target.closest('[data-chat]');
    if (ch) { const [uid, ref, t] = ch.dataset.chat.split('|'); return requireAuth(() => startChat(uid, ref, decodeURIComponent(t))); }
    const rp = e.target.closest('[data-report]');
    if (rp) { const [kind, id, t] = rp.dataset.report.split('|'); return requireAuth(() => sendReport(kind, +id, decodeURIComponent(t))); }
    const ed = e.target.closest('[data-edit]');
    if (ed) { const [kind, id] = ed.dataset.edit.split('|'); return requireAuth(() => startEdit(kind, +id)); }
  });
  async function sendReport(kind, id, title) {
    const reason = prompt(`Что не так с «${title}»?\nНапример: мошенничество, неверная цена, уже продано, оскорбления.`);
    if (!reason || reason.trim().length < 3) return;
    try { await DB.insert('ab_reports', { kind, item_id: id, title, reason: reason.trim().slice(0, 500) }); toast('Жалоба отправлена — модератор проверит'); }
    catch (err) { toast(err.message); }
  }

  // ---------- редактирование своих объявлений и профиля мастера ----------
  let editing = null;
  const EDIT_TITLES = { postModal: ['Новое объявление', 'Редактировать объявление'], partPostModal: ['Продать запчасть', 'Редактировать запчасть'], becomeModal: ['Добавить автосервис', 'Редактировать профиль сервиса'] };
  const setTitle = (id, edit) => { const h = $(`#${id} .modal__title`); if (h) h.textContent = EDIT_TITLES[id][edit ? 1 : 0]; };
  function stopEdit() {
    if (!editing) return;
    editing = null;
    Object.keys(EDIT_TITLES).forEach(id => setTitle(id, false));
    pf.reset(); syncPModels(); carPhotos.length = 0; renderCarThumbs();
    ppf.reset(); ppf.photo._data = ''; $('#ppPreview').hidden = true; syncPPModels();
    const bf = $('#becomeForm'); bf.reset(); bf.photo._data = ''; $('#bPreview').hidden = true;
  }
  async function startEdit(kind, dbId) {
    const table = { car: 'ab_cars', part: 'ab_parts', master: 'ab_masters' }[kind];
    let row;
    try { [row] = await DB.select(table, q => q.eq('id', dbId)); } catch (err) { return toast(err.message); }
    if (!row) return toast('Не найдено');
    $$('.modal:not([hidden]), .drawer:not([hidden])').forEach(closeModal);
    editing = { kind, dbId };
    const set = (f, name, v) => { if (f[name] != null && v != null) f[name].value = v; };
    if (kind === 'car') {
      set(pf, 'brand', row.brand); syncPModels(); set(pf, 'model', row.model);
      ['body', 'fuel', 'gear', 'wheel', 'city', 'year', 'price', 'mileage', 'phone'].forEach(k => set(pf, k, row[k]));
      set(pf, 'engine', row.engine); set(pf, 'desc', row.descr); pf.cleared.checked = row.cleared;
      $$('input[name="color"]', pf).forEach(r => r.checked = r.value === row.color);
      carPhotos.length = 0; carPhotos.push(...row.photos); renderCarThumbs();
      setTitle('postModal', true); openModal($('#postModal'));
    } else if (kind === 'part') {
      set(ppf, 'title', row.title); set(ppf, 'cat', row.cat); set(ppf, 'cond', row.cond);
      set(ppf, 'brand', row.brand); syncPPModels(); if (row.brand) set(ppf, 'model', row.model);
      ['price', 'city', 'phone'].forEach(k => set(ppf, k, row[k])); set(ppf, 'desc', row.descr);
      ppf.photo._data = row.photo || ''; if (row.photo) { $('#ppPreview').src = row.photo; $('#ppPreview').hidden = false; }
      setTitle('partPostModal', true); openModal($('#partPostModal'));
    } else {
      const f = $('#becomeForm');
      ['name', 'master', 'years', 'city', 'addr', 'hours', 'phone'].forEach(k => set(f, k, row[k]));
      $$('input[name="cats"]', f).forEach(c => c.checked = row.cats.includes(c.value));
      f.services.value = row.services.map(x => x.price ? `${x.name} — ${x.price}` : x.name).join('\n');
      f.mobile.checked = row.mobile; f.warranty.checked = row.warranty > 0;
      f.photo._data = row.photo || ''; if (row.photo) { $('#bPreview').src = row.photo; $('#bPreview').hidden = false; }
      setTitle('becomeModal', true); openModal($('#becomeModal'));
    }
  }

  // ---------- отзывы о мастерах ----------
  let reviewsAll = [];
  async function loadReviews() {
    try { reviewsAll = await DB.select('ab_reviews', q => q.order('created_at', { ascending: false })); } catch { reviewsAll = []; }
    applyReviews();
  }
  function applyReviews() {
    MASTERS.filter(m => m.real).forEach(m => {
      const list = reviewsAll.filter(r => r.master_id === m.dbId);
      m.reviews = list.length;
      m.rating = list.length ? list.reduce((a, r) => a + r.rating, 0) / list.length : 0;
      m.reviewsList = list.slice(0, 10).map(r => ({ who: r.author, text: r.text || '—', stars: r.rating, days: Math.max(1, Math.round((Date.now() - Date.parse(r.created_at)) / 864e5)) }));
    });
  }
  function reviewForm(masterDbId) {
    if (reviewsAll.some(r => r.master_id === masterDbId && r.user_id === DB.user?.id)) return '<small class="ok">✓ Ваш отзыв опубликован</small>';
    return `<form class="review-form" data-form="review" data-master="${masterDbId}">
      <div class="stars-input">${[5, 4, 3, 2, 1].map(n => `<input type="radio" name="rating" id="rv${masterDbId}-${n}" value="${n}" ${n === 5 ? 'checked' : ''}><label for="rv${masterDbId}-${n}" title="${n}">★</label>`).join('')}</div>
      <input class="inp" name="text" maxlength="1000" placeholder="Как всё прошло? Ваш отзыв поможет другим">
      <button class="btn btn--primary">Оставить отзыв</button></form>`;
  }

  // ---------- чат между покупателем и продавцом / клиентом и мастером ----------
  let chats = [], openChat = null, unread = 0, unreadBy = {};
  async function loadChats() {
    if (!DB.user) { chats = []; unread = 0; unreadBy = {}; return updateAccBtn(); }
    try {
      chats = await DB.select('ab_chats', q => q.order('last_at', { ascending: false }));
      const un = await DB.select('ab_messages', q => q.is('read_at', null).neq('sender', DB.user.id));
      unreadBy = {}; un.forEach(m => unreadBy[m.chat_id] = (unreadBy[m.chat_id] || 0) + 1);
      unread = un.length;
    } catch { }
    updateAccBtn();
  }
  const otherName = c => c.a === DB.user.id ? c.b_name : c.a_name;
  async function startChat(uid, ref, topic) {
    try {
      const id = await DB.rpc('ab_start_chat', { p_owner: uid, p_ref: ref, p_topic: topic });
      await loadChats();
      $$('.modal:not([hidden])').forEach(closeModal);
      showChat(id);
    } catch (err) { toast(err.message); }
  }
  const bubble = m => `<div class="msg ${m.sender === DB.user.id ? 'me' : ''}"><p>${esc(m.body)}</p><time>${new Date(m.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></div>`;
  async function showChat(id) {
    const c = chats.find(x => x.id === id);
    if (!c) return toast('Чат не найден');
    openChat = c;
    const msgs = await DB.select('ab_messages', q => q.eq('chat_id', id).order('id'));
    $('#chatBody').innerHTML = `<div class="chat">
      <div class="chat__head"><button class="link-btn" data-chat-back>← Все сообщения</button><b>${esc(otherName(c))}</b><small>${esc(c.topic)}</small></div>
      <div class="chat__list" id="chatList">${msgs.length ? msgs.map(bubble).join('') : '<p class="muted small">Напишите первое сообщение — например, уточните наличие или время.</p>'}</div>
      <form class="chat__form" id="chatForm"><input class="inp" name="body" maxlength="2000" placeholder="Сообщение…" autocomplete="off" required><button class="btn btn--primary" aria-label="Отправить">➤</button></form>
    </div>`;
    if ($('#chatModal').hidden) openModal($('#chatModal'));
    const list = $('#chatList'); list.scrollTop = list.scrollHeight;
    $('#chatForm').addEventListener('submit', async e => {
      e.preventDefault();
      const inp = e.target.body, body = inp.value.trim();
      if (!body) return;
      inp.value = '';
      try {
        const m = await DB.insert('ab_messages', { chat_id: id, body });
        if (!$(`#chatList [data-m="${m.id}"]`)) appendMsg(m);
      } catch (err) { toast(err.message); inp.value = body; }
    });
    $('[data-chat-back]', $('#chatBody')).onclick = () => { closeModal($('#chatModal')); openCabinet('chats'); };
    if (unreadBy[id]) {
      await DB.sb.from('ab_messages').update({ read_at: new Date().toISOString() }).eq('chat_id', id).neq('sender', DB.user.id).is('read_at', null);
      unread -= unreadBy[id]; unreadBy[id] = 0; updateAccBtn();
    }
  }
  function appendMsg(m) {
    const list = $('#chatList');
    if (!list) return;
    if (!list.querySelector('.msg')) list.innerHTML = '';
    list.insertAdjacentHTML('beforeend', bubble(m).replace('<div class="msg', `<div data-m="${m.id}" class="msg`));
    list.scrollTop = list.scrollHeight;
  }
  async function onMessage({ eventType, new: m }) {
    if (eventType !== 'INSERT' || !DB.user) return;
    if (openChat && openChat.id === m.chat_id && !$('#chatModal').hidden) {
      if (!$(`#chatList [data-m="${m.id}"]`) && m.sender !== DB.user.id) appendMsg(m);
      if (m.sender !== DB.user.id) DB.sb.from('ab_messages').update({ read_at: new Date().toISOString() }).eq('id', m.id).then(() => { });
      return;
    }
    if (m.sender === DB.user.id) return;
    if (!chats.some(c => c.id === m.chat_id)) await loadChats();
    else { unread++; unreadBy[m.chat_id] = (unreadBy[m.chat_id] || 0) + 1; updateAccBtn(); }
    const c = chats.find(x => x.id === m.chat_id);
    toast(`✉️ ${c ? otherName(c) : 'Новое сообщение'}: ${m.body.slice(0, 60)}`);
    if (!$('#cabModal').hidden && cab.tab === 'chats') renderCab();
  }
  CAB.chats = async () => {
    await loadChats();
    return chats.length ? chats.map(c => `<button class="mine mine--btn" data-open-chat="${c.id}"><div><b>${esc(otherName(c))}</b>${unreadBy[c.id] ? ` <span class="st st--new">${unreadBy[c.id]} новых</span>` : ''}<p>${esc(c.topic)}</p><small>${ago(Date.parse(c.last_at))}</small></div><span>→</span></button>`).join('')
      : emptyNote('Сообщений пока нет. Кнопка «Написать продавцу» есть в объявлениях и у мастеров.');
  };

  // ---------- продажи: заказы на мои запчасти ----------
  CAB.sales = async () => {
    const uid = DB.user.id;
    const list = await DB.select('ab_orders', q => q.contains('seller_ids', [uid]).order('created_at', { ascending: false }));
    if (!list.length) return emptyNote('Заказов на ваши запчасти пока нет', '<button class="btn btn--primary" data-go="part">Продать запчасть</button>');
    const next = { new: ['confirmed', 'Подтвердить'], confirmed: ['shipped', 'Отправлен'], shipped: ['done', 'Выполнен'] };
    return list.map(o => {
      const mine = i => i.db_id && PARTS.find(p => p.dbId === i.db_id)?.uid === uid;
      const items = o.items.filter(mine);
      const sum = items.reduce((a, i) => a + i.price * i.q, 0);
      return `<div class="cab-card"><div class="cab-card__top"><b>Заказ № AB-${o.id}</b><span class="st st--${o.status}">${ORDER_STATUS[o.status]}</span></div>
        <ul>${items.map(i => `<li><span>${esc(i.title)} × ${i.q}</span><b>${kgs(i.price * i.q)}</b></li>`).join('')}</ul>
        <p>👤 ${esc(o.name)} · <a href="tel:${esc(o.phone.replace(/\s/g, ''))}">${esc(o.phone)}</a></p>
        <p>🚚 ${esc(o.delivery)}${o.addr ? ' · ' + esc(o.addr) : ''} · 💳 ${esc(o.pay)}</p>${o.note ? `<p class="muted">${esc(o.note)}</p>` : ''}
        <small>${ago(Date.parse(o.created_at))}</small><div class="cab-card__sum">Ваши товары: ${kgs(sum)}</div>
        <div class="row-btns row-btns--left">${next[o.status] ? `<button class="btn btn--primary" data-ord="${o.id}|${next[o.status][0]}">${next[o.status][1]}</button>` : ''}
          ${['new', 'confirmed'].includes(o.status) ? `<button class="btn btn--ghost" data-ord="${o.id}|cancelled">Отменить</button>` : ''}
          <a class="btn btn--wa" target="_blank" rel="noopener" href="https://wa.me/${o.phone.replace(/\D/g, '')}">WhatsApp</a></div></div>`;
    }).join('');
  };

  // ---------- админ-панель ----------
  let isAdmin = false;
  const KIND_BASE = { car: 2e6, part: 3e6, master: 4e6 };
  const KIND_TABLE = { car: 'ab_cars', part: 'ab_parts', master: 'ab_masters' };
  CAB.admin = async () => {
    const [st, reports, masters, cars, parts, lotRows] = await Promise.all([
      DB.rpc('ab_admin_stats'),
      DB.select('ab_reports', q => q.eq('status', 'open').order('created_at', { ascending: false })),
      DB.select('ab_masters', q => q.order('created_at', { ascending: false }).limit(50)),
      DB.select('ab_cars', q => q.order('created_at', { ascending: false }).limit(40)),
      DB.select('ab_parts', q => q.order('created_at', { ascending: false }).limit(40)),
      DB.select('ab_lots', q => q.order('ends_at', { ascending: false }))
    ]);
    const STATS = [['users', 'Пользователи'], ['cars', 'Авто'], ['parts', 'Запчасти'], ['masters', 'Мастера'], ['bookings', 'Записи'], ['orders', 'Заказы'], ['requests', 'Заявки'], ['reports', 'Жалобы'], ['bids_today', 'Ставок за сутки']];
    const now = new Date(Date.now() + 36e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    const adRow = (t, r, title, price) => `<div class="cab-item"><div class="cab-item__img">${(t === 'ab_cars' ? r.photos[0] : r.photo) ? `<img src="${t === 'ab_cars' ? r.photos[0] : r.photo}" alt="">` : '📄'}</div>
      <div class="cab-item__info"><b>${esc(title)}</b><small>${price} · ${esc(r.city)} · ${esc(r.phone)} · <span class="st st--${r.status}">${AD_STATUS[r.status]}</span></small></div>
      <div class="cab-item__act">${r.status === 'active' ? `<button class="btn btn--ghost" data-ad="${t}|${r.id}|hidden">Скрыть</button>` : `<button class="btn btn--ghost" data-ad="${t}|${r.id}|active">Вернуть</button>`}<button class="btn btn--ghost danger" data-ad="${t}|${r.id}|delete">🗑</button><button class="btn btn--ghost" data-adm-ban="${r.user_id}|${encodeURIComponent(title)}" title="Заблокировать автора">🚫</button></div></div>`;
    return `<div class="adm-stats">${STATS.map(([k, v]) => `<div><b>${st[k]}</b><small>${v}</small></div>`).join('')}</div>
      <div class="lot__label">Жалобы (${reports.length})</div>
      ${reports.length ? reports.map(r => `<div class="cab-card"><div class="cab-card__top"><b>${esc(r.title || r.kind)}</b><small>${ago(Date.parse(r.created_at))}</small></div><p>${esc(r.reason)}</p>
        <div class="row-btns row-btns--left"><a class="btn btn--ghost" href="#${r.kind}-${r.item_id}" data-close>Открыть</a>
        ${r.item_id >= KIND_BASE[r.kind] ? `<button class="btn btn--ghost" data-adm-hide="${r.kind}|${r.item_id - KIND_BASE[r.kind]}|${r.id}">${r.kind === 'master' ? 'Удалить профиль' : 'Скрыть объявление'}</button>` : '<span class="muted small">демо-объявление</span>'}
        <button class="btn btn--primary" data-adm-report="${r.id}">Решено</button></div></div>`).join('') : emptyNote('Открытых жалоб нет')}
      <div class="lot__label" style="margin-top:16px">Мастера и сервисы</div>
      ${masters.length ? masters.map(m => `<div class="cab-item"><div class="cab-item__img">${m.photo ? `<img src="${m.photo}" alt="">` : '🔧'}</div>
        <div class="cab-item__info"><b>${esc(m.name)} ${m.verified ? '<span class="st st--confirmed">✓ проверен</span>' : ''}</b><small>${esc(m.city)}, ${esc(m.addr)} · ${esc(m.phone)}</small></div>
        <div class="cab-item__act"><button class="btn btn--ghost" data-adm-verify="${m.id}|${!m.verified}">${m.verified ? 'Снять ✓' : 'Проверен ✓'}</button><button class="btn btn--ghost danger" data-adm-mdel="${m.id}">🗑</button><button class="btn btn--ghost" data-adm-ban="${m.user_id}|${encodeURIComponent(m.name)}" title="Заблокировать">🚫</button></div></div>`).join('') : emptyNote('Мастеров пока нет')}
      <div class="lot__label" style="margin-top:16px">Последние объявления: авто</div>
      ${cars.length ? cars.map(r => adRow('ab_cars', r, `${r.brand} ${r.model}, ${r.year}`, usd(r.price))).join('') : emptyNote('Пока нет')}
      <div class="lot__label" style="margin-top:16px">Последние объявления: запчасти</div>
      ${parts.length ? parts.map(r => adRow('ab_parts', r, r.title, kgs(r.price))).join('') : emptyNote('Пока нет')}
      <div class="lot__label" style="margin-top:16px">Аукцион: новый лот из объявления</div>
      ${cars.filter(c => c.status === 'active').length ? `<form class="lot-form" data-form="lot">
        <select class="inp lot-form__wide" name="car" required>${cars.filter(c => c.status === 'active').map(c => `<option value="${c.id}">${esc(c.brand)} ${esc(c.model)}, ${c.year} — ${usd(c.price)}</option>`).join('')}</select>
        <label>Старт, $<input class="inp" name="start" type="number" min="100" required></label>
        <label>Шаг, $<input class="inp" name="step" type="number" min="10" value="250" required></label>
        <label>Купить сейчас, $<input class="inp" name="buy" type="number" min="0" value="0"></label>
        <label>Начало<input class="inp" name="starts" type="datetime-local" value="${now}" required></label>
        <label>Длительность, часов<input class="inp" name="hours" type="number" min="1" max="336" value="48" required></label>
        <button class="btn btn--primary lot-form__wide">Создать лот</button></form>` : emptyNote('Чтобы создать лот, нужно хотя бы одно активное объявление авто от пользователя')}
      <div class="lot__label" style="margin-top:16px">Лоты (${lotRows.length})</div>
      ${lotRows.map(l => `<div class="cab-item"><div class="cab-item__img">🔨</div><div class="cab-item__info"><b>${esc(l.car.brand)} ${esc(l.car.model)}, ${l.car.year}</b>
        <small>старт ${usd(l.start_price)} · до ${new Date(l.ends_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${l.id < 2e6 ? ' · демо' : ''}</small></div>
        <div class="cab-item__act"><button class="btn btn--ghost danger" data-adm-lotdel="${l.id}">🗑</button></div></div>`).join('')}`;
  };
  async function adminClick(e) {
    const el = e.target.closest('[data-adm-report],[data-adm-hide],[data-adm-verify],[data-adm-mdel],[data-adm-lotdel]');
    if (!el) return false;
    adminLog(Object.keys(el.dataset)[0], Object.values(el.dataset)[0]);
    try {
      if (el.dataset.admReport) { await DB.update('ab_reports', +el.dataset.admReport, { status: 'done' }); toast('Жалоба закрыта'); }
      if (el.dataset.admHide) {
        const [kind, id, rep] = el.dataset.admHide.split('|');
        if (kind === 'master') { if (!confirm('Удалить профиль мастера?')) return true; await DB.remove('ab_masters', +id); }
        else await DB.update(KIND_TABLE[kind], +id, { status: 'hidden' });
        await DB.update('ab_reports', +rep, { status: 'done' });
        await loadRemote(); toast('Готово');
      }
      if (el.dataset.admVerify) {
        const [id, v] = el.dataset.admVerify.split('|');
        await DB.update('ab_masters', +id, { verified: v === 'true' }); await loadRemote(); toast(v === 'true' ? 'Отмечен как проверенный' : 'Отметка снята');
      }
      if (el.dataset.admMdel) { if (!confirm('Удалить профиль мастера вместе с записями?')) return true; await DB.remove('ab_masters', +el.dataset.admMdel); await loadRemote(); toast('Удалено'); }
      if (el.dataset.admLotdel) { if (!confirm('Удалить лот вместе со ставками?')) return true; await DB.remove('ab_lots', +el.dataset.admLotdel); await loadLots(); toast('Лот удалён'); }
    } catch (err) { toast(err.message); }
    renderCab();
    return true;
  }
  async function createLot(f) {
    const [car] = await DB.select('ab_cars', q => q.eq('id', +f.car.value));
    const start = Date.parse(f.starts.value);
    if (!car || !start) throw new Error('Проверьте поля');
    await DB.insert('ab_lots', {
      id: 2e6 + car.id, start_price: +f.start.value, step: +f.step.value, buy_now: +f.buy.value || 0,
      starts_at: new Date(start).toISOString(), ends_at: new Date(start + f.hours.value * 36e5).toISOString(),
      car: { brand: car.brand, model: car.model, year: car.year, mileage: car.mileage, gear: car.gear || 'Автомат', fuel: car.fuel || 'Бензин', city: car.city, engine: +car.engine || 0, hp: 0, drive: '—', wheel: car.wheel || 'Левый', body: car.body || 'Седан', color: car.color || 'Белый', price: car.price, imgs: car.photos }
    });
    await loadLots();
    toast('Лот создан');
  }

  // ---------- после входа: админ, чаты, избранное и корзина из аккаунта ----------
  let cartTimer = null;
  function saveCartRemote() {
    if (!DB.user) return;
    clearTimeout(cartTimer);
    cartTimer = setTimeout(() => DB.sb.from('ab_carts').upsert({ user_id: DB.user.id, items: cart, updated_at: new Date().toISOString() }).then(() => { }), 700);
  }
  async function afterLogin() {
    isAdmin = false;
    if (!DB.user) { await loadChats(); return; }
    try { isAdmin = !!(await DB.rpc('ab_is_admin')); } catch { }
    await loadChats();
    try {
      const uid = DB.user.id;
      const rows = await DB.select('ab_favs', q => q.eq('user_id', uid));
      const remote = new Set(rows.map(r => +r.item_id));
      const missing = [...favs].filter(id => !remote.has(id));
      if (missing.length) await DB.sb.from('ab_favs').upsert(missing.map(id => ({ user_id: uid, item_id: id })));
      remote.forEach(id => favs.add(id)); store.set('unaa_favs', [...favs]); updateFavCount();
      const [c] = await DB.select('ab_carts', q => q.eq('user_id', uid));
      if (c) Object.entries(c.items).forEach(([id, q]) => { if (PARTS.some(p => p.id === +id)) cart[id] = Math.max(cart[id] || 0, q); });
      store.set('unaa_cart', cart); saveCartRemote(); syncCartUI();
      render(); renderParts();
    } catch { }
  }

  // ---------- курс доллара НБКР ----------
  async function loadRate() {
    try {
      const [row] = await DB.select('ab_settings', q => q.eq('key', 'usd_rate'));
      let v = Number(row?.value);
      if (!row || Date.now() - Date.parse(row.updated_at) > 6 * 36e5) {
        const { data } = await DB.sb.functions.invoke('ab-notify', { body: { action: 'rate' } });
        if (data?.rate) v = Number(data.rate);
      }
      if (v > 50 && v < 200) { RATE = v; $('#rate').textContent = RATE.toFixed(2).replace('.', ','); render(); }
    } catch { }
  }

  // ---------- восстановление пароля ----------
  function renderAuthExtra(mode, note) {
    const forgot = mode === 'forgot';
    $('#authBody').innerHTML = `<h2 class="modal__title">${forgot ? 'Восстановление пароля' : 'Новый пароль'}</h2>
      ${note ? `<div class="auth-note">${note}</div>` : ''}
      <form class="auth-form" id="authForm">
        ${forgot ? '<input class="inp" name="email" type="email" placeholder="Email, указанный при регистрации" required autocomplete="email">'
          : '<input class="inp" name="password" type="password" placeholder="Новый пароль (не короче 6 символов)" minlength="6" required autocomplete="new-password">'}
        <button class="btn btn--primary btn--lg">${forgot ? 'Прислать ссылку' : 'Сохранить пароль'}</button>
      </form>
      ${forgot ? '<button class="link-btn" data-back-login>← Вернуться ко входу</button>' : ''}`;
    $('[data-back-login]', $('#authBody'))?.addEventListener('click', () => renderAuth('login'));
    $('#authForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target, btn = $('.btn--primary', f);
      busy(btn, true);
      try {
        if (forgot) {
          await DB.resetPassword(f.email.value.trim());
          renderAuth('login', `📩 Если такой аккаунт есть, на <b>${esc(f.email.value.trim())}</b> придёт письмо со ссылкой. Откройте её — здесь появится поле для нового пароля.`);
        } else {
          await DB.setPassword(f.password.value);
          closeModal($('#authModal')); toast('Пароль изменён, вы вошли');
        }
      } catch (err) { toast(err.message); busy(btn, false); }
    });
  }

  // ---------- push-уведомления и удаление аккаунта ----------
  const urlB64 = b64 => {
    const pad = '='.repeat((4 - b64.length % 4) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  };
  async function pushSubscription() {
    try { const reg = await navigator.serviceWorker?.getRegistration(); return reg ? await reg.pushManager.getSubscription() : null; } catch { return null; }
  }
  async function togglePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return toast('Этот браузер не поддерживает push-уведомления');
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return toast('Push работают на опубликованном сайте (https)');
    const cur = await reg.pushManager.getSubscription();
    if (cur) {
      await DB.sb.from('ab_push_subs').delete().eq('endpoint', cur.endpoint);
      await cur.unsubscribe();
      toast('Push-уведомления отключены'); return renderCab();
    }
    if (await Notification.requestPermission() !== 'granted') return toast('Разрешите уведомления для сайта в настройках браузера');
    const sub = (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(VAPID_PUBLIC) })).toJSON();
    const { error } = await DB.sb.from('ab_push_subs').upsert({ endpoint: sub.endpoint, user_id: DB.user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth });
    toast(error ? DB.humanError(error) : 'Push-уведомления включены');
    renderCab();
  }
  $('#cabBody').addEventListener('click', async e => {
    if (e.target.closest('[data-push]')) return togglePush().catch(err => toast(err.message));
    if (e.target.closest('[data-test-notify]')) {
      const { data, error } = await DB.sb.functions.invoke('ab-notify', { body: { action: 'test' } });
      return toast(error || !data?.ok ? 'Не удалось отправить тест' : 'Тест отправлен — проверьте телефон или Telegram');
    }
    if (e.target.closest('[data-delete-me]')) {
      if (!confirm('Удалить аккаунт? Объявления, заказы, записи, сообщения и ставки будут удалены навсегда.')) return;
      if (prompt('Чтобы подтвердить, напишите: УДАЛИТЬ') !== 'УДАЛИТЬ') return toast('Удаление отменено');
      try { await DB.deleteAccount(); closeModal($('#cabModal')); await loadRemote(); toast('Аккаунт удалён'); }
      catch (err) { toast(err.message); }
      return;
    }
    const ban = e.target.closest('[data-adm-ban]');
    if (ban) {
      const [uid, t] = ban.dataset.admBan.split('|');
      if (uid === DB.user.id) return toast('Нельзя заблокировать себя');
      const reason = prompt(`Заблокировать автора «${decodeURIComponent(t)}»? Причина:`);
      if (!reason) return;
      const days = prompt('На сколько дней? Пусто — навсегда', '30');
      const until = days && +days > 0 ? new Date(Date.now() + days * 864e5).toISOString() : null;
      try {
        await DB.sb.from('ab_bans').upsert({ user_id: uid, reason: reason.slice(0, 300), until }).then(r => { if (r.error) throw new Error(DB.humanError(r.error)); });
        adminLog('ban', `${decodeURIComponent(t)}: ${reason}`); toast('Пользователь заблокирован'); renderCab();
      } catch (err) { toast(err.message); }
      return;
    }
    const unban = e.target.closest('[data-adm-unban]');
    if (unban) {
      await DB.sb.from('ab_bans').delete().eq('user_id', unban.dataset.admUnban);
      adminLog('unban', unban.dataset.admUnban); toast('Блокировка снята'); renderCab();
    }
  });

  // ---------- админ: статистика, блокировки, журнал ----------
  function adminLog(action, target = '') {
    if (isAdmin) DB.sb.from('ab_admin_log').insert({ action: String(action).slice(0, 60), target: String(target).slice(0, 200) }).then(() => { });
  }
  const adminMain = CAB.admin;
  CAB.admin = async () => {
    const [main, an, bans, log] = await Promise.all([
      adminMain(),
      DB.rpc('ab_admin_analytics', { p_days: 7 }),
      DB.select('ab_bans', q => q.order('created_at', { ascending: false })),
      DB.select('ab_admin_log', q => q.order('created_at', { ascending: false }).limit(30))
    ]);
    const max = Math.max(1, ...an.daily.map(d => d.visitors));
    const KIND = { car: '🚗', part: '🔧', master: '🧑‍🔧', lot: '🔨' };
    return `<div class="lot__label">Посетители за 7 дней: ${an.visitors}</div>
      <div class="bars">${an.daily.map(d => `<div title="${d.visitors} посетителей, ${d.actions} действий"><span style="height:${Math.round(d.visitors / max * 100)}%"></span><b>${d.visitors}</b><small>${d.day}</small></div>`).join('') || '<p class="muted small">Данных пока нет</p>'}</div>
      <div class="adm-two">
        <div><div class="lot__label">Что ищут</div>${an.top_searches.length ? `<ol class="adm-list">${an.top_searches.map(t => `<li><span>${esc(t.ref)}</span><b>${t.n}</b></li>`).join('')}</ol>` : '<p class="muted small">Пока нет поисков</p>'}</div>
        <div><div class="lot__label">Что смотрят</div>${an.top_views.length ? `<ol class="adm-list">${an.top_views.map(t => `<li><span>${KIND[t.kind] || ''} ${esc(t.ref.replace(/ #\d+$/, ''))}</span><b>${t.n}</b></li>`).join('')}</ol>` : '<p class="muted small">Пока нет просмотров</p>'}</div>
      </div>
      ${main}
      <div class="lot__label" style="margin-top:16px">Заблокированные (${bans.length})</div>
      ${bans.length ? bans.map(b => `<div class="cab-item"><div class="cab-item__img">🚫</div><div class="cab-item__info"><b>${esc(b.reason || 'без причины')}</b><small>${b.until ? 'до ' + new Date(b.until).toLocaleDateString('ru-RU') : 'навсегда'} · ${b.user_id.slice(0, 8)}</small></div>
        <div class="cab-item__act"><button class="btn btn--ghost" data-adm-unban="${b.user_id}">Разблокировать</button></div></div>`).join('') : emptyNote('Никто не заблокирован')}
      <div class="lot__label" style="margin-top:16px">Журнал модерации</div>
      ${log.length ? `<ol class="adm-list adm-log">${log.map(l => `<li><span>${esc(l.action)} · ${esc(l.target)}</span><small>${esc(l.admin_email.split('@')[0])} · ${ago(Date.parse(l.created_at))}</small></li>`).join('')}</ol>` : emptyNote('Действий пока нет')}`;
  };

  // ---------- поиск по базе на сервере ----------
  let remoteCarKey = JSON.stringify([{}, '']), remotePartKey = JSON.stringify(['', '', '', '', '']);
  const likeSafe = q => q.replace(/[%_,()]/g, ' ').trim();
  function maybeRemoteCars() {
    const f = { ...state.f }; delete f.photo;
    const key = JSON.stringify([f, state.city]);
    if (key === remoteCarKey) return;
    remoteCarKey = key;
    clearTimeout(maybeRemoteCars.t);
    maybeRemoteCars.t = setTimeout(async () => {
      try {
        const rows = await DB.select('ab_cars', q => {
          q = q.eq('status', 'active');
          if (f.brand) q = q.eq('brand', f.brand);
          if (f.model) q = q.eq('model', f.model);
          if (f.yearFrom) q = q.gte('year', +f.yearFrom);
          if (f.yearTo) q = q.lte('year', +f.yearTo);
          if (f.priceFrom) q = q.gte('price', +f.priceFrom);
          if (f.priceTo) q = q.lte('price', +f.priceTo);
          ['body', 'fuel', 'gear', 'wheel'].forEach(k => { if (f[k]) q = q.eq(k, f[k]); });
          if (f.cleared) q = q.eq('cleared', true);
          if (state.city) q = q.eq('city', state.city);
          return q.order('created_at', { ascending: false }).limit(300);
        });
        if (key !== remoteCarKey) return;
        let added = 0;
        rows.forEach(r => { const c = carFromRow(r), i = ALL.findIndex(x => x.id === c.id); if (i >= 0) ALL[i] = c; else { ALL.unshift(c); added++; } });
        if (added) render();
      } catch { }
    }, 300);
  }
  function maybeRemoteParts() {
    const key = JSON.stringify([ps.q, ps.cat, ps.brand, ps.model, ps.cond]);
    if (key === remotePartKey) return;
    remotePartKey = key;
    clearTimeout(maybeRemoteParts.t);
    maybeRemoteParts.t = setTimeout(async () => {
      try {
        const rows = await DB.select('ab_parts', q => {
          q = q.eq('status', 'active');
          if (ps.cat) q = q.eq('cat', ps.cat);
          if (ps.brand) q = q.in('brand', [ps.brand, '']);
          if (ps.model) q = q.in('model', [ps.model, '']);
          if (ps.cond) q = q.eq('cond', ps.cond);
          const words = likeSafe(ps.q).split(/\s+/).filter(w => w.length > 2).slice(0, 3);
          words.forEach(w => { q = q.ilike('title', `%${w.length > 4 ? w.slice(0, -1) : w}%`); });
          return q.order('created_at', { ascending: false }).limit(300);
        });
        if (key !== remotePartKey) return;
        let added = 0;
        rows.forEach(r => { const p = partFromRow(r), i = PARTS.findIndex(x => x.id === p.id); if (i >= 0) PARTS[i] = p; else { PARTS.unshift(p); added++; } });
        if (added) renderParts();
      } catch { }
    }, 300);
  }

  // ---------- нет интернета ----------
  const offlineBar = () => { $('#offline').hidden = navigator.onLine; };
  addEventListener('online', () => { offlineBar(); toast('Связь восстановлена'); loadRemote(); loadLots(); });
  addEventListener('offline', offlineBar);
  offlineBar();

  // ---------- news ----------
  $('#newsGrid').innerHTML = NEWS.map(n => `<a href="#" class="news__item"><div class="news__img" style="background:${n.bg}">${n.e}</div>
    <div class="news__body"><div class="news__cat">${n.cat}</div><h3>${n.t}</h3><div class="news__meta">${n.d}</div></div></a>`).join('');

  // ---------- init ----------
  $('#rate').textContent = RATE.toFixed(2).replace('.', ',');
  updateFavCount();
  render();
  renderLots();
  renderParts();
  syncCartUI();
  renderMasters();
  updateBookingsCount();
  startBackend();
  route();
})();

// Подключение к Supabase: вход, профиль, фото, запросы к таблицам ab_*
const SUPABASE_URL = 'https://dbfbnywgvzdzjmcefrsh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_scfpiRlIpzy_y6hgSMKyGw_UhkhorNj'; // публичный ключ, доступ ограничен правилами RLS
// Демо-каталог (сгенерированные авто, запчасти и мастера). Перед запуском для реальных пользователей поставьте false.
const SHOW_DEMO = true;
// Имя Telegram-бота уведомлений без @ (создайте в @BotFather и впишите сюда), например 'avtobazar_kg_bot'
const TELEGRAM_BOT = '';

const DB = (() => {
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  let user = null, profile = null;
  const listeners = [];

  // понятные сообщения вместо технических ошибок
  function humanError(err) {
    const m = (err && (err.message || err.error_description)) || String(err);
    if (/Invalid login credentials/i.test(m)) return 'Неверный email или пароль';
    if (/Email not confirmed/i.test(m)) return 'Подтвердите email по ссылке из письма, затем войдите';
    if (/User already registered/i.test(m)) return 'Такой email уже зарегистрирован — войдите';
    if (/Password should be at least/i.test(m)) return 'Пароль должен быть не короче 6 символов';
    if (/rate limit/i.test(m)) return 'Слишком много попыток, попробуйте через минуту';
    if (/ab_bookings_slot|duplicate key/i.test(m)) return 'Это время только что заняли — выберите другое';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Нет связи с сервером. Проверьте интернет';
    return m;
  }
  const unwrap = ({ data, error }) => { if (error) throw new Error(humanError(error)); return data; };

  async function loadProfile() {
    if (!user) return (profile = null);
    let p = unwrap(await sb.from('ab_profiles').select('*').eq('id', user.id).maybeSingle());
    if (!p) {
      const md = user.user_metadata || {};
      p = unwrap(await sb.from('ab_profiles').upsert({ id: user.id, name: md.name || '', phone: md.phone || '' }).select().single());
    }
    return (profile = p);
  }

  async function init() {
    const { data: { session } } = await sb.auth.getSession();
    user = session?.user || null;
    if (user) await loadProfile().catch(() => {});
    sb.auth.onAuthStateChange(async (event, s) => {
      const prev = user?.id;
      user = s?.user || null;
      if (user?.id !== prev) {
        await loadProfile().catch(() => {});
        listeners.forEach(fn => fn(user));
      }
    });
  }

  // фото: dataURL (уже уменьшенное в браузере) → Storage → публичная ссылка
  async function upload(dataUrl) {
    if (!dataUrl) return null;
    if (/^https?:/.test(dataUrl)) return dataUrl; // уже загружено (редактирование)
    if (!user) throw new Error('Войдите, чтобы загрузить фото');
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    unwrap(await sb.storage.from('ab-photos').upload(path, blob, { contentType: 'image/jpeg' }));
    return sb.storage.from('ab-photos').getPublicUrl(path).data.publicUrl;
  }

  return {
    sb, init, upload, humanError,
    get user() { return user; },
    get profile() { return profile; },
    onAuth(fn) { listeners.push(fn); },
    async signUp(email, password, name, phone) {
      const data = unwrap(await sb.auth.signUp({ email, password, options: { data: { name, phone }, emailRedirectTo: location.origin + location.pathname } }));
      return { needsConfirm: !data.session };
    },
    async signIn(email, password) { unwrap(await sb.auth.signInWithPassword({ email, password })); },
    async signOut() { await sb.auth.signOut(); },
    async saveProfile(fields) { profile = unwrap(await sb.from('ab_profiles').upsert({ id: user.id, ...fields }).select().single()); return profile; },
    async select(table, build = q => q) { return unwrap(await build(sb.from(table).select('*'))); },
    async insert(table, row) { return unwrap(await sb.from(table).insert(row).select().single()); },
    async update(table, id, fields) { return unwrap(await sb.from(table).update(fields).eq('id', id).select().single()); },
    async remove(table, id) { unwrap(await sb.from(table).delete().eq('id', id)); },
    async rpc(name, args) { return unwrap(await sb.rpc(name, args)); },
    // подписка на изменения таблицы (RLS фильтрует, кто что видит)
    listen(table, onChange) {
      return sb.channel('ab-' + table + '-' + Math.random().toString(36).slice(2, 6))
        .on('postgres_changes', { event: '*', schema: 'public', table }, p => onChange(p))
        .subscribe();
    }
  };
})();

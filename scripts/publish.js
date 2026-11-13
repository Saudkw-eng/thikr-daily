// ينشر عنصراً واحداً من content.json على انستقرام عبر Instagram API with Instagram Login
// الاستخدام:
//   node scripts/publish.js --slot morning --dry-run          تجربة بدون نشر
//   node scripts/publish.js --slot night                      نشر فعلي
//   node scripts/publish.js --slot evening --date 2026-11-13 --dry-run   محاكاة يوم معيّن (مثلاً جمعة)
//   node scripts/publish.js --simulate 14                     محاكاة أسبوعين لكل الفترات للتأكد من التدوير
// متغيرات البيئة (من GitHub Secrets):
//   IG_ACCESS_TOKEN, IG_USER_ID, PUBLIC_BASE_URL
//   GRAPH_API_VERSION (اختياري، الافتراضي v22.0) و PUBLISHING_ENABLED=false لإيقاف النشر
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOG_FILE = path.join(ROOT, 'posted_log.json');
const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'content.json'), 'utf8'));
const schedule = JSON.parse(fs.readFileSync(path.join(ROOT, 'schedule.json'), 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const PLAN_FILE = path.join(ROOT, 'month_plan.json');
const plan = fs.existsSync(PLAN_FILE) ? JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8')) : { entries: {} };

const FILES = { post: 'post.jpg', story: 'story.jpg', reel: 'reel.mp4' };
const KUWAIT_OFFSET_MS = 3 * 60 * 60 * 1000;

function parseArgs() {
  const args = process.argv.slice(2);
  const get = name => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    slot: get('slot'),
    date: get('date'),
    id: get('id'),
    simulate: Number(get('simulate') || 0),
    dryRun: args.includes('--dry-run') || process.env.DRY_RUN === 'true',
  };
}

// تاريخ الكويت الحالي بصيغة YYYY-MM-DD
const kuwaitToday = () => new Date(Date.now() + KUWAIT_OFFSET_MS).toISOString().slice(0, 10);
const isFriday = date => new Date(`${date}T12:00:00Z`).getUTCDay() === 5;

function readLog() {
  if (!fs.existsSync(LOG_FILE)) return [];
  return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
}

function slotRule(slot, date) {
  const base = schedule.slots[slot];
  if (!base) throw new Error(`فترة غير معروفة: ${slot} (المتاح: ${Object.keys(schedule.slots).join(', ')})`);
  // قاعدة الجمعة تحل محل قاعدة الفترة بالكامل
  const rule = { ...((isFriday(date) && schedule.friday[slot]) || base) };
  if (schedule.also_story && !rule.formats.includes('story') && rule.formats.includes('post')) {
    rule.formats = [...rule.formats, 'story'];
  }
  return rule;
}

// يختار العنصر الأقل نشراً في هذه الفترة؛ لما ينشر الكل يرجع من البداية تلقائياً.
// ويتجنب تكرار عنصر سبق نشره في نفس اليوم (مثل أذكار الصباح والمساء المشتركة).
function pickItem(rule, slotKey, log, date) {
  const pool = content.items.filter(i =>
    rule.types.includes(i.type) &&
    (!rule.friday_only || i.friday) &&
    !(rule.exclude_friday_items && i.friday));
  if (!pool.length) throw new Error(`لا يوجد محتوى للفترة ${slotKey}`);
  const counts = {};
  for (const e of log) if (e.pool === slotKey) counts[e.id] = (counts[e.id] || 0) + 1;
  const today = new Set(log.filter(e => e.date === date).map(e => e.id));
  const candidates = pool.filter(i => !today.has(i.id));
  const choices = candidates.length ? candidates : pool;
  const min = Math.min(...choices.map(i => counts[i.id] || 0));
  const item = choices.find(i => (counts[i.id] || 0) === min);
  return { item, cycle: min + 1, poolSize: pool.length };
}

function mediaUrl(item, format) {
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  return `${base || '<PUBLIC_BASE_URL>'}/${cfg.output_dir}/${encodeURIComponent(item.id)}/${FILES[format]}`;
}

// ---------- Instagram API ----------
// graph.instagram.com لتوكن IGAA (Instagram Login)، و graph.facebook.com لتوكن EAA (Unified login / System user)
const API_HOST = process.env.IG_API_HOST || 'https://graph.instagram.com';
const apiVersion = () => process.env.GRAPH_API_VERSION || 'v22.0';

async function api(method, pathPart, params) {
  const url = `${API_HOST}/${apiVersion()}/${pathPart}`;
  const body = new URLSearchParams({ ...params, access_token: process.env.IG_ACCESS_TOKEN });
  const res = method === 'GET'
    ? await fetch(`${url}?${body}`)
    : await fetch(url, { method, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const msg = data.error ? `${data.error.message} (code ${data.error.code})` : `HTTP ${res.status}`;
    throw new Error(`Instagram API: ${msg}`);
  }
  return data;
}

async function waitForContainer(id) {
  for (let i = 0; i < 40; i++) {
    const { status_code } = await api('GET', id, { fields: 'status_code' });
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`فشل تجهيز الميديا: ${status_code}`);
    await new Promise(r => setTimeout(r, 6000));
  }
  throw new Error('انتهت مهلة تجهيز الفيديو');
}

async function publishOne(item, format, url) {
  const userId = process.env.IG_USER_ID;
  const head = await fetch(url, { method: 'HEAD' });
  if (!head.ok) throw new Error(`الملف غير متاح على الرابط العام (${head.status}): ${url}`);

  const params = format === 'reel'
    ? { media_type: 'REELS', video_url: url, caption: item.caption, share_to_feed: 'true' }
    : format === 'story'
      ? { media_type: 'STORIES', image_url: url }
      : { image_url: url, caption: item.caption };
  const container = await api('POST', `${userId}/media`, params);
  if (format !== 'post') await waitForContainer(container.id);
  const published = await api('POST', `${userId}/media_publish`, { creation_id: container.id });
  return published.id;
}

// ---------- إشعار الجوال (ntfy.sh) ----------
// NTFY_TOPIC من GitHub Secrets — اشترك فيه من تطبيق ntfy. إذا فاضي ما يرسل شي.
async function notify(title, message, click, tags) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;
  try {
    const res = await fetch('https://ntfy.sh/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic, title, message, tags, ...(click ? { click } : {}) }),
    });
    if (!res.ok) console.log(`⚠️ فشل إرسال الإشعار (HTTP ${res.status})`);
  } catch (e) {
    console.log(`⚠️ فشل إرسال الإشعار: ${e.message}`);
  }
}

async function permalink(mediaId) {
  try { return (await api('GET', mediaId, { fields: 'permalink' })).permalink; } catch { return undefined; }
}

const FORMAT_AR = { post: 'بوست', story: 'ستوري', reel: 'ريل' };

// ---------- التشغيل ----------
function describe(date, slot, rule, pick, format, url) {
  const { item, cycle, poolSize } = pick;
  return [
    `📅 ${date}${isFriday(date) ? ' (جمعة)' : ''} | الفترة: ${slot} (${schedule.slots[slot].time_kuwait} بتوقيت الكويت)`,
    `🧾 ${item.id} | النوع: ${item.type} | الصيغة: ${format} | الدورة ${cycle} (${poolSize} عنصر في هذه الفترة)`,
    `🔗 ${url}`,
  ].join('\n');
}

async function runSlot(slot, date, log, { dryRun, id, quiet }) {
  const rule = slotRule(slot, date);
  const slotKey = `${slot}${isFriday(date) && schedule.friday[slot] ? '-friday' : ''}`;
  // خطة الشهر (month_plan.json) لها الأولوية، إلا إذا هالفترة انتشرت اليوم من قبل
  const planned = !id && !quiet && plan.entries?.[date]?.[slot];
  const alreadyPosted = log.some(e => e.date === date && e.slot === slot && e.media_id);
  // وما ينشر عنصر الخطة إذا نفس العنصر انتشر اليوم في فترة ثانية
  const postedToday = log.some(e => e.date === date && e.id === planned?.id && e.media_id);
  const plannedItem = planned && !alreadyPosted && !postedToday && content.items.find(i => i.id === planned.id);
  if (plannedItem && planned.formats) rule.formats = planned.formats;
  const pick = id
    ? { item: content.items.find(i => i.id === id), cycle: '-', poolSize: '-' }
    : plannedItem
      ? { item: plannedItem, cycle: 'خطة الشهر', poolSize: '-' }
      : pickItem(rule, slotKey, log, date);
  if (!pick.item) throw new Error(`عنصر غير موجود: ${id}`);

  for (const format of rule.formats) {
    const url = mediaUrl(pick.item, format);
    const localFile = path.join(ROOT, cfg.output_dir, pick.item.id, FILES[format]);
    const exists = fs.existsSync(localFile);
    if (!quiet) {
      console.log(`\n${dryRun ? '🧪 DRY-RUN' : '🚀 نشر'}\n${describe(date, slot, rule, pick, format, url)}`);
      if (!exists) console.log(`⚠️  الملف غير موجود محلياً: ${path.relative(ROOT, localFile)} — شغّل scripts/render.js`);
      if (dryRun && format !== 'story') console.log(`📝 الكابشن:\n${pick.item.caption}`);
    }
    let mediaId = null;
    if (!dryRun) {
      if (!exists) throw new Error(`الملف غير موجود: ${localFile}`);
      mediaId = await publishOne(pick.item, format, url);
      console.log(`✅ تم النشر: media_id=${mediaId}`);
      const link = await permalink(mediaId);
      const label = pick.item.type === 'آية' ? `${pick.item.surah} ${pick.item.ayah}` : (pick.item.name || pick.item.type);
      await notify(`✅ تم نشر ${FORMAT_AR[format]}`, `${pick.item.type} — ${label}${link ? `\n${link}` : ''}`, link, ['white_check_mark']);
    }
    log.push({ at: new Date().toISOString(), date, slot, pool: slotKey, id: pick.item.id, format, media_id: mediaId, dry_run: dryRun || undefined });
  }
  return pick.item;
}

async function main() {
  const opts = parseArgs();

  if (opts.simulate) {
    // محاكاة أيام متتالية بسجل مؤقت في الذاكرة (لا يكتب شيئاً)
    const log = [];
    const start = new Date(`${opts.date || kuwaitToday()}T12:00:00Z`);
    for (let d = 0; d < opts.simulate; d++) {
      const date = new Date(start.getTime() + d * 86400000).toISOString().slice(0, 10);
      const picks = [];
      for (const slot of Object.keys(schedule.slots)) {
        const item = await runSlot(slot, date, log, { dryRun: true, quiet: true });
        picks.push(`${slot}: ${item.id}`);
      }
      console.log(`${date}${isFriday(date) ? ' جمعة' : '     '} | ${picks.join(' | ')}`);
    }
    return;
  }

  if (opts.slot === 'check') {
    // يتأكد إن التوكن شغال ويطابق IG_USER_ID بدون ما ينشر شي
    const t = process.env.IG_ACCESS_TOKEN || '';
    // أول ٤ أحرف وطول التوكن فقط (للتشخيص) — لا يُطبع التوكن نفسه
    console.log(`🔑 نوع التوكن: ${t.slice(0, 4)}… | الطول: ${t.length} | فيه مسافات: ${/\s/.test(t)}`);
    const hosts = ['https://graph.instagram.com', 'https://graph.facebook.com'];
    for (const host of hosts) {
      const url = `${host}/${apiVersion()}/${process.env.IG_USER_ID}?fields=username&access_token=${encodeURIComponent(t.trim())}`;
      const data = await fetch(url).then(r => r.json()).catch(e => ({ error: { message: e.message } }));
      if (data.error) console.log(`❌ ${host}: ${data.error.message}`);
      else { console.log(`✅ ${host}: التوكن شغال — الحساب @${data.username}`); return; }
    }
    throw new Error('التوكن ما اشتغل على أي من الخادمين');
  }
  if (!opts.slot) throw new Error('حدد --slot (morning | evening | night | check) أو --simulate N');
  if (process.env.PUBLISHING_ENABLED === 'false' && !opts.dryRun) {
    console.log('⏸️  النشر موقوف (PUBLISHING_ENABLED=false)');
    return;
  }
  if (!opts.dryRun) {
    for (const k of ['IG_ACCESS_TOKEN', 'IG_USER_ID', 'PUBLIC_BASE_URL']) {
      if (!process.env[k]) throw new Error(`متغير البيئة ${k} غير موجود`);
    }
  }

  const log = readLog();
  const date = opts.date || kuwaitToday();
  if (process.env.SKIP_IF_POSTED === 'true' && log.some(e => e.date === date && e.slot === opts.slot && e.media_id)) {
    console.log(`⏭️  فترة ${opts.slot} منشورة اليوم (${date}) — ما في شي ينشر`);
    return;
  }
  await runSlot(opts.slot, date, log, opts);
  if (!opts.dryRun) fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2) + '\n', 'utf8');
}

main().catch(async e => {
  console.error(`❌ ${e.message}`);
  const { slot, dryRun } = parseArgs();
  if (!dryRun && slot && slot !== 'check') await notify('❌ فشل النشر', `الفترة: ${slot}\n${e.message}`, undefined, ['warning']);
  process.exit(1);
});

// يبني خطة نشر ثابتة لعدد من الأيام (افتراضياً ٣٠) ويكتبها في month_plan.json و MONTH_PLAN.md
// الاستخدام:
//   node scripts/plan.js                          من اليوم (بتوقيت الكويت) لـ ٣٠ يوم
//   node scripts/plan.js --start 2026-12-13 --days 30
// publish.js يتبع الخطة إذا لقى فيها اليوم والفترة، وإذا خلصت الخطة يرجع للاختيار التلقائي.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'content.json'), 'utf8'));
const schedule = JSON.parse(fs.readFileSync(path.join(ROOT, 'schedule.json'), 'utf8'));
const logFile = path.join(ROOT, 'posted_log.json');
const log = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : [];

const args = process.argv.slice(2);
const get = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const kuwaitToday = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
const start = get('start') || kuwaitToday();
const days = Number(get('days') || 30);
const isFriday = d => new Date(`${d}T12:00:00Z`).getUTCDay() === 5;
const addDays = (d, n) => new Date(new Date(`${d}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const DAY_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// عدد مرات النشر وآخر يوم لكل عنصر (من السجل الحقيقي ثم من الخطة نفسها)
const uses = {};
const lastDay = {};
for (const e of log) if (e.media_id) {
  uses[e.id] = (uses[e.id] || 0) + 1;
  lastDay[e.id] = e.date;
}
const order = new Map(content.items.map((it, i) => [it.id, i]));
const rotation = {}; // عدّاد التناوب لكل فترة

function pick(slot, date, usedToday) {
  const friday = isFriday(date) && schedule.friday[slot];
  const rule = friday || schedule.slots[slot];
  const key = `${slot}${friday ? '-friday' : ''}`;
  const groups = rule.rotate || [rule.types];
  const r = rotation[key] || 0;
  // جرّب المجموعة الحالية في التناوب، وإذا فاضية جرّب اللي بعدها
  for (let g = 0; g < groups.length; g++) {
    const types = groups[(r + g) % groups.length];
    const pool = content.items.filter(i =>
      types.includes(i.type) &&
      (!rule.friday_only || i.friday) &&
      !(rule.exclude_friday_items && i.friday) &&
      !usedToday.has(i.id));
    if (!pool.length) continue;
    pool.sort((a, b) =>
      (uses[a.id] || 0) - (uses[b.id] || 0) ||
      String(lastDay[a.id] || '').localeCompare(String(lastDay[b.id] || '')) ||
      order.get(a.id) - order.get(b.id));
    rotation[key] = r + 1;
    return { item: pool[0], formats: rule.formats, pool: key };
  }
  throw new Error(`لا يوجد محتوى للفترة ${key} يوم ${date}`);
}

const plan = { generated_at: new Date().toISOString(), start, days, entries: {} };
const md = [
  `# خطة النشر — ${days} يوم من ${start}`,
  '',
  '> تُولّد بالأمر `node scripts/plan.js`. تقدر تعدّل `month_plan.json` يدوياً (غيّر id العنصر)، وأي فترة منشورة مسبقاً تنعرض ✅.',
  '',
  '| التاريخ | اليوم | 6:00 ص | 4:30 م | 9:00 م |',
  '|---|---|---|---|---|',
];
const snippet = t => { const w = String(t || '').replace(/[ً-ْٰ]/g, '').split(/\s+/); return w.slice(0, 6).join(' ') + (w.length > 6 ? '…' : ''); };
const label = it => it.type === 'آية' ? `${it.surah} ${it.ayah}` : (it.text ? snippet(it.text) : it.type);
const missing = [];

for (let d = 0; d < days; d++) {
  const date = addDays(start, d);
  const usedToday = new Set();
  const row = {};
  const cells = [];
  for (const slot of Object.keys(schedule.slots)) {
    const done = log.find(e => e.date === date && e.slot === slot && e.media_id);
    if (done) {
      usedToday.add(done.id);
      cells.push(`✅ ${label(content.items.find(i => i.id === done.id) || { type: done.id })}`);
      continue;
    }
    const { item, formats, pool } = pick(slot, date, usedToday);
    usedToday.add(item.id);
    uses[item.id] = (uses[item.id] || 0) + 1;
    lastDay[item.id] = date;
    row[slot] = { id: item.id, formats, pool };
    for (const f of formats) {
      const file = path.join(ROOT, 'output', item.id, { post: 'post.jpg', story: 'story.jpg', reel: 'reel.mp4' }[f]);
      if (!fs.existsSync(file)) missing.push(path.relative(ROOT, file));
    }
    const icon = formats.includes('reel') ? '🎬' : '🖼️';
    cells.push(`${icon} ${item.type === 'آية' ? '' : `${item.type}: `}${label(item)}`);
  }
  plan.entries[date] = row;
  md.push(`| ${date} | ${DAY_AR[new Date(`${date}T12:00:00Z`).getUTCDay()]} | ${cells.join(' | ')} |`);
}

// إحصائية التكرار
const counts = {};
for (const row of Object.values(plan.entries)) for (const e of Object.values(row)) counts[e.id] = (counts[e.id] || 0) + 1;
const total = Object.values(counts).reduce((a, b) => a + b, 0);
const repeated = Object.entries(counts).filter(([, n]) => n > 1);
md.push('', `**${total} منشور** — ${Object.keys(counts).length} عنصر مختلف، ${repeated.length} عنصر يتكرر مرتين (بفاصل أسبوعين تقريباً).`);
md.push('', '🖼️ بوست صورة · 🎬 ريل · ✅ منشور مسبقاً');

fs.writeFileSync(path.join(ROOT, 'month_plan.json'), JSON.stringify(plan, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(ROOT, 'MONTH_PLAN.md'), md.join('\n') + '\n', 'utf8');
console.log(`✅ خطة ${days} يوم من ${start}: ${total} منشور، ${Object.keys(counts).length} عنصر مختلف، ${repeated.length} متكرر`);
if (missing.length) {
  console.log(`⚠️ ${missing.length} ملف غير مولّد بعد — شغّل render.js:`);
  for (const m of [...new Set(missing)].slice(0, 20)) console.log('   ' + m);
  process.exitCode = 2;
}

// ينزّل تلاوة كل آية من quran.com (verses.quran.com) ويحفظها في audio/<id>.mp3
// الآيات المتعددة تُدمج بالترتيب في ملف واحد.
// الاستخدام:
//   node scripts/fetch_audio.js                 كل الآيات (الموجود يُتخطى)
//   node scripts/fetch_audio.js --ids ayah-18-109 --force
// القارئ من config.json ← reel.reciter_id (قائمة القرّاء: https://api.quran.com/api/v4/resources/recitations)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'content.json'), 'utf8'));
const AUDIO_DIR = path.join(ROOT, cfg.reel.audio_dir);
const RECITER = cfg.reel.reciter_id || 7;

const args = process.argv.slice(2);
const idsArg = args.includes('--ids') ? args[args.indexOf('--ids') + 1].split(',') : null;
const force = args.includes('--force');

async function getBuffer(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (attempt === 3) throw new Error(`HTTP ${res.status}: ${url}`);
    await new Promise(r => setTimeout(r, 1500 * attempt));
  }
}

async function ayahUrl(key) {
  const res = await fetch(`https://api.quran.com/api/v4/recitations/${RECITER}/by_ayah/${key}`);
  const data = await res.json();
  const file = data.audio_files?.[0]?.url;
  if (!file) throw new Error(`ما في تلاوة للآية ${key}`);
  return file.startsWith('http') ? file : `https://verses.quran.com/${file}`;
}

async function main() {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  const verses = content.items.filter(i => i.type === 'آية' && (!idsArg || idsArg.includes(i.id)));
  let done = 0;
  for (const item of verses) {
    const out = path.join(AUDIO_DIR, `${item.id}.mp3`);
    if (fs.existsSync(out) && !force) { console.log(`skip  ${item.id}`); continue; }
    const keys = item.verses.map(v => `${item.surah_number}:${v.n}`);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ayah-'));
    const parts = [];
    for (const [i, key] of keys.entries()) {
      const p = path.join(tmp, `${i}.mp3`);
      fs.writeFileSync(p, await getBuffer(await ayahUrl(key)));
      parts.push(p);
    }
    // دمج الآيات وتوحيد الصيغة (48kHz ستيريو)
    const list = path.join(tmp, 'list.txt');
    fs.writeFileSync(list, parts.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
      '-ar', '48000', '-ac', '2', '-b:a', '160k', out]);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`done  ${item.id} (${keys.join(', ')})`);
    done++;
  }
  console.log(`✅ ${done} تلاوة جديدة في ${path.relative(ROOT, AUDIO_DIR)}/`);
}

main().catch(e => { console.error(`❌ ${e.message}`); process.exit(1); });

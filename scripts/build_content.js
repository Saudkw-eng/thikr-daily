// يبني content.json من مصادر حرفية:
//  - الآيات: api.quran.com (text_uthmani) — لا يُكتب أي نص قرآني يدوياً
//  - الأذكار: hisnmuslim.com/api (نص حصن المسلم) — التخريج والدرجة مضافة هنا
// الاستخدام: node scripts/build_content.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'sources');

// ---------- الآيات ----------
// key: "سورة:من-إلى"
const VERSES = [
  { key: '13:28', topic: 'طمأنينة' },
  { key: '94:5-6', topic: 'أمل' },
  { key: '2:152', topic: 'ذكر' },
  { key: '2:186', topic: 'دعاء' },
  { key: '39:53', topic: 'رحمة' },
  { key: '40:60', topic: 'دعاء' },
  { key: '14:7', topic: 'شكر' },
  { key: '2:153', topic: 'صبر' },
  { key: '3:139', topic: 'ثبات' },
  { key: '29:69', topic: 'هداية' },
  { key: '93:5', topic: 'أمل' },
  { key: '20:25-28', topic: 'دعاء' },
  { key: '21:87', topic: 'دعاء' },
  { key: '50:16', topic: 'قرب' },
  { key: '2:255', topic: 'آية الكرسي' },
  { key: '112:1-4', topic: 'توحيد' },
  { key: '3:8', topic: 'دعاء' },
  { key: '2:201', topic: 'دعاء' },
  { key: '25:74', topic: 'دعاء' },
  { key: '16:128', topic: 'تقوى' },
  { key: '65:3', topic: 'توكل' },
  { key: '55:13', topic: 'شكر' },
  { key: '33:41-42', topic: 'ذكر' },
  // الجمعة
  { key: '18:10', topic: 'الكهف', friday: true },
  { key: '18:46', topic: 'الكهف', friday: true },
  { key: '18:109', topic: 'الكهف', friday: true },
  { key: '33:56', topic: 'الصلاة على النبي', friday: true },
  // إضافات خطة الشهر
  { key: '2:45', topic: 'صبر' },
  { key: '12:87', topic: 'أمل' },
  { key: '94:7-8', topic: 'عمل' },
  { key: '3:173', topic: 'توكل' },
  { key: '7:23', topic: 'دعاء' },
  { key: '14:40-41', topic: 'دعاء' },
  { key: '17:24', topic: 'بر الوالدين' },
  { key: '20:114', topic: 'علم' },
  { key: '28:24', topic: 'دعاء' },
  { key: '3:200', topic: 'صبر' },
  { key: '6:162', topic: 'إخلاص' },
  { key: '71:10', topic: 'استغفار' },
  { key: '18:1', topic: 'الكهف', friday: true },
  { key: '18:23-24', topic: 'الكهف', friday: true },
  { key: '18:28', topic: 'الكهف', friday: true },
  { key: '18:107', topic: 'الكهف', friday: true },
];

// ---------- الأذكار ----------
// id = رقم الذكر في hisnmuslim.com — النص يُسحب من المصدر كما هو.
// type: صباح | مساء | صباح ومساء | عام | جمعة
// استُبعدت أذكار في التصحيح خلاف معتبر (80، 81، 82، 83، 87، 89، 98).
const ADHKAR = [
  { id: 77, type: 'صباح', takhrij: 'صحيح مسلم (2723)', grade: 'صحيح' },
  { id: 77, type: 'مساء', evening: [['أَصْبَحْنَا وَأَصْبَحَ', 'أَمْسَيْنَا وَأَمْسَى'], ['خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيرَ مَا بَعْدَهُ', 'خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا'], ['شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ', 'شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا']], takhrij: 'صحيح مسلم (2723)', grade: 'صحيح' },
  { id: 78, type: 'صباح', takhrij: 'سنن الترمذي (3391)', grade: 'صحيح (الألباني)' },
  { id: 78, type: 'مساء', eveningText: 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ', takhrij: 'سنن الترمذي (3391)', grade: 'صحيح (الألباني)' },
  { id: 79, type: 'صباح ومساء', name: 'سيد الاستغفار', takhrij: 'صحيح البخاري (6306)', grade: 'صحيح' },
  { id: 84, type: 'صباح ومساء', takhrij: 'سنن أبي داود (5074)، سنن ابن ماجه (3871)', grade: 'صحيح (الألباني)' },
  { id: 85, type: 'صباح ومساء', takhrij: 'سنن الترمذي (3392)، سنن أبي داود (5067)', grade: 'صحيح (الألباني)' },
  { id: 86, type: 'صباح ومساء', takhrij: 'سنن أبي داود (5088)، سنن الترمذي (3388)', grade: 'صحيح (الألباني)' },
  { id: 88, type: 'صباح ومساء', takhrij: 'المستدرك للحاكم (1/545)', grade: 'حسن (الألباني، صحيح الترغيب)' },
  { id: 90, type: 'صباح', takhrij: 'مسند أحمد (15360)', grade: 'صحيح (الألباني، السلسلة الصحيحة 2989)' },
  { id: 90, type: 'مساء', evening: [['أَصْبَحْنا', 'أَمْسَيْنَا']], takhrij: 'مسند أحمد (15360)', grade: 'صحيح (الألباني، السلسلة الصحيحة 2989)' },
  { id: 91, type: 'صباح ومساء', takhrij: 'صحيح مسلم (2692)', grade: 'صحيح' },
  { id: 92, type: 'صباح ومساء', takhrij: 'صحيح البخاري (6404)، صحيح مسلم (2693)', grade: 'صحيح' },
  { id: 93, type: 'صباح', takhrij: 'صحيح البخاري (3293)، صحيح مسلم (2691)', grade: 'صحيح' },
  { id: 94, type: 'صباح', takhrij: 'صحيح مسلم (2726)', grade: 'صحيح' },
  { id: 95, type: 'صباح', takhrij: 'سنن ابن ماجه (925)', grade: 'صحيح (الألباني)' },
  { id: 96, type: 'عام', takhrij: 'صحيح مسلم (2702)', grade: 'صحيح' },
  { id: 97, type: 'مساء', takhrij: 'سنن الترمذي (3604)، مسند أحمد', grade: 'صحيح (الألباني)' },
  { id: 1, type: 'صباح', name: 'ذكر الاستيقاظ', takhrij: 'صحيح البخاري (6312)', grade: 'صحيح' },
  { id: 120, type: 'عام', name: 'دعاء الهم والحزن', takhrij: 'مسند أحمد (3712)', grade: 'صحيح (الألباني، السلسلة الصحيحة 199)' },
  { id: 121, type: 'عام', name: 'دعاء الهم والحزن', takhrij: 'صحيح البخاري (6363)', grade: 'صحيح' },
  { id: 122, type: 'عام', name: 'دعاء الكرب', takhrij: 'صحيح البخاري (6346)، صحيح مسلم (2730)', grade: 'صحيح' },
  { id: 123, type: 'عام', name: 'دعاء الكرب', takhrij: 'سنن أبي داود (5090)', grade: 'حسن (الألباني)' },
  { id: 124, type: 'عام', name: 'دعوة ذي النون', takhrij: 'سنن الترمذي (3505)', grade: 'صحيح (الألباني)' },
  { id: 125, type: 'عام', name: 'دعاء الكرب', takhrij: 'سنن أبي داود (1525)، سنن ابن ماجه (3882)', grade: 'صحيح (الألباني)' },
  { id: 196, type: 'عام', name: 'كفارة المجلس', takhrij: 'سنن الترمذي (3433)، سنن أبي داود (4859)', grade: 'صحيح (الألباني)' },
  { id: 248, type: 'عام', takhrij: 'صحيح البخاري (6307)', grade: 'صحيح' },
  { id: 250, type: 'عام', takhrij: 'سنن أبي داود (1517)، سنن الترمذي (3577)', grade: 'صحيح (الألباني)' },
  { id: 251, type: 'عام', takhrij: 'سنن الترمذي (3579)، سنن النسائي (572)', grade: 'صحيح (الألباني)' },
  { id: 252, type: 'عام', takhrij: 'صحيح مسلم (482)', grade: 'صحيح' },
  { id: 253, type: 'عام', takhrij: 'صحيح مسلم (2702)', grade: 'صحيح' },
  { id: 254, type: 'عام', takhrij: 'صحيح البخاري (6405)، صحيح مسلم (2691)', grade: 'صحيح' },
  { id: 256, type: 'عام', takhrij: 'صحيح البخاري (6682)، صحيح مسلم (2694)', grade: 'صحيح' },
  { id: 257, type: 'عام', takhrij: 'صحيح مسلم (2695)', grade: 'صحيح' },
  { id: 258, type: 'عام', takhrij: 'صحيح مسلم (2698)', grade: 'صحيح' },
  { id: 259, type: 'عام', takhrij: 'سنن الترمذي (3464)', grade: 'صحيح (الألباني)' },
  { id: 260, type: 'عام', takhrij: 'صحيح البخاري (4205)، صحيح مسلم (2704)', grade: 'صحيح' },
  { id: 261, type: 'عام', takhrij: 'صحيح مسلم (2137)', grade: 'صحيح' },
  { id: 262, type: 'عام', takhrij: 'صحيح مسلم (2696)', grade: 'صحيح' },
  { id: 263, type: 'عام', takhrij: 'صحيح مسلم (2697)', grade: 'صحيح' },
  { id: 264, type: 'عام', takhrij: 'سنن الترمذي (3383)، سنن ابن ماجه (3800)', grade: 'حسن (الألباني)' },
  // الجمعة: فضل الصلاة على النبي ﷺ
  { id: 219, type: 'جمعة', takhrij: 'صحيح مسلم (408)', grade: 'صحيح' },
  { id: 220, type: 'جمعة', takhrij: 'سنن أبي داود (2042)', grade: 'صحيح (الألباني)' },
  { id: 221, type: 'جمعة', takhrij: 'سنن الترمذي (3546)', grade: 'صحيح (الألباني)' },
  { id: 222, type: 'جمعة', takhrij: 'سنن النسائي (1282)', grade: 'صحيح (الألباني)' },
  { id: 223, type: 'جمعة', takhrij: 'سنن أبي داود (2041)', grade: 'حسن (الألباني)' },
];

const HASHTAGS = {
  'صباح': '#اذكار_الصباح #اذكار #ذكر_الله #حصن_المسلم',
  'مساء': '#اذكار_المساء #اذكار #ذكر_الله #حصن_المسلم',
  'صباح ومساء': '#اذكار_الصباح_والمساء #اذكار #ذكر_الله #حصن_المسلم',
  'عام': '#اذكار #ادعية #ذكر_الله #حصن_المسلم',
  'جمعة': '#جمعة_مباركة #الصلاة_على_النبي #اللهم_صل_على_محمد #اذكار',
  'آية': '#قران_كريم #القرآن_الكريم #آية #تدبر',
};
const CAPTION_LEAD = {
  'صباح': 'من أذكار الصباح 🌅',
  'مساء': 'من أذكار المساء 🌙',
  'صباح ومساء': 'من أذكار الصباح والمساء',
  'عام': 'ذكرٌ ودعاء',
  'جمعة': 'أكثروا من الصلاة على النبي ﷺ يوم الجمعة',
};
const REPEAT_WORDS = { 3: 'ثلاث مرات', 4: 'أربع مرات', 7: 'سبع مرات', 10: 'عشر مرات', 100: 'مائة مرة' };

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// يحمّل كل الأذكار من ملفات المصدر المنزّلة في sources/
function loadHisn() {
  const byId = {};
  for (const f of fs.readdirSync(SRC).filter(f => /^h\d+\.json$/.test(f))) {
    const d = readJson(path.join(SRC, f));
    const chapter = Object.keys(d)[0];
    for (const x of d[chapter]) byId[x.ID] = { ...x, chapter };
  }
  return byId;
}

// تنظيف تنسيقي فقط: إزالة (( )) وتعليمات التكرار وملاحظات المساء بين []
function cleanDhikr(t) {
  const isInstruction = inner => /مر[ةا]|إذا أصبح|إذا أمسى|الكسل/.test(inner.replace(/[ً-ْ]/g, ''));
  return t
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\(\(|\)\)/g, '')
    .replace(/\(([^()]*)\)/g, (m, inner) => (isInstruction(inner) ? '' : m))
    .replace(/^\s*\(\s*([^()]*?)\s*\)\s*$/, '$1')
    .replace(/ـ/g, '')
    .replace(/^وَقَالَ/, 'قَالَ')
    .replace(/:(\S)/g, ': $1')
    .replace(/\s+/g, ' ')
    .replace(/\s+([،.:؛])/g, '$1')
    .trim()
    .replace(/[\s.،]*أ[ً-ْ]*و[ً-ْ]*[\s.]*$/, '')
    .replace(/[.،\s]+$/, '');
}

async function buildVerses() {
  const chapters = {};
  const items = [];
  for (const v of VERSES) {
    const [s, range] = v.key.split(':');
    const [from, to = from] = range.split('-').map(Number);
    if (!chapters[s]) chapters[s] = (await getJson(`https://api.quran.com/api/v4/chapters/${s}?language=ar`)).chapter;
    const parts = [];
    for (let a = from; a <= to; a++) {
      const r = await getJson(`https://api.quran.com/api/v4/verses/by_key/${s}:${a}?fields=text_uthmani`);
      parts.push({ n: a, text: r.verse.text_uthmani.trim() });
    }
    const surah = chapters[s].name_arabic;
    const ayahLabel = from === to ? `${from}` : `${from}-${to}`;
    const text = parts.map(p => p.text).join(' ۝ ');
    const ref = `سورة ${surah} - الآية ${ayahLabel}`;
    items.push({
      id: `ayah-${s}-${ayahLabel}`,
      type: 'آية',
      friday: !!v.friday,
      text,
      verses: parts,
      surah,
      surah_number: Number(s),
      ayah: ayahLabel,
      source: { name: 'api.quran.com — الرسم العثماني (text_uthmani)', reference: ref },
      topic: v.topic,
      caption: `﴿${text}﴾\n[${ref}]\n\n${v.friday ? 'لا تنسوا قراءة سورة الكهف يوم الجمعة 🤍\n\n#سورة_الكهف #جمعة_مباركة ' : ''}${HASHTAGS['آية']}`,
    });
  }
  return items;
}

function buildAdhkar() {
  const hisn = loadHisn();
  const counter = {};
  return ADHKAR.map(a => {
    const src = hisn[a.id];
    if (!src) throw new Error(`ذكر غير موجود في المصدر: ${a.id}`);
    let text = cleanDhikr(src.ARABIC_TEXT);
    let note;
    if (a.eveningText) {
      text = a.eveningText;
      note = 'صيغة المساء كما نصّ عليها حصن المسلم';
    } else if (a.evening) {
      // NFC يوحّد ترتيب الشدة والحركة بين المصدر وأنماط الاستبدال
      text = text.normalize('NFC');
      for (let [from, to] of a.evening) {
        from = from.normalize('NFC');
        if (!text.includes(from)) throw new Error(`لم أجد "${from}" في الذكر ${a.id}`);
        text = text.split(from).join(to.normalize('NFC'));
      }
      note = 'صيغة المساء كما نصّ عليها حصن المسلم';
    }
    const key = `${a.id}-${a.type}`;
    counter[key] = (counter[key] || 0) + 1;
    const typeSlug = { 'صباح': 'sabah', 'مساء': 'masa', 'صباح ومساء': 'sabah-masa', 'عام': 'aam', 'جمعة': 'jumuah' }[a.type];
    const repeat = src.REPEAT > 1 ? src.REPEAT : 1;
    const repeatLine = REPEAT_WORDS[repeat] ? `(${REPEAT_WORDS[repeat]})\n` : '';
    return {
      id: `dhikr-${typeSlug}-${a.id}`,
      type: a.type,
      friday: a.type === 'جمعة',
      text,
      repeat,
      name: a.name || src.chapter,
      source: {
        name: 'حصن المسلم — hisnmuslim.com',
        hisn_id: a.id,
        chapter: src.chapter,
        takhrij: a.takhrij,
        grade: a.grade,
      },
      ...(note && { note }),
      caption: `${CAPTION_LEAD[a.type]}\n\n${text}\n${repeatLine}\n📚 ${a.takhrij} — ${a.grade}\n\n${HASHTAGS[a.type]}`,
    };
  });
}

(async () => {
  const verses = await buildVerses();
  const adhkar = buildAdhkar();
  const items = [...adhkar, ...verses];
  const ids = new Set(items.map(i => i.id));
  if (ids.size !== items.length) throw new Error('معرّفات مكررة');
  const out = {
    generated_at: new Date().toISOString(),
    sources: {
      quran: 'https://api.quran.com/api/v4 (text_uthmani)',
      adhkar: 'https://www.hisnmuslim.com/api/ar',
    },
    count: items.length,
    items,
  };
  fs.writeFileSync(path.join(ROOT, 'content.json'), JSON.stringify(out, null, 2), 'utf8');
  const byType = items.reduce((m, i) => ((m[i.type] = (m[i.type] || 0) + 1), m), {});
  console.log('total', items.length, byType);
})().catch(e => { console.error(e); process.exit(1); });

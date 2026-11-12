// يولّد التصاميم من content.json عبر قالب HTML ويصوّرها بـ Playwright
// الاستخدام:
//   node scripts/render.js --ids dhikr-sabah-77,ayah-13-28 --formats post,story,reel
//   node scripts/render.js --all --formats post
//   node scripts/render.js --type آية --formats reel
// الناتج: output/<id>/post.jpg | story.jpg | reel.mp4
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'content.json'), 'utf8'));
const TEMPLATE = pathToFileURL(path.join(ROOT, 'templates', 'card.html')).href;

function parseArgs() {
  const args = process.argv.slice(2);
  const get = name => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    all: args.includes('--all'),
    ids: (get('ids') || '').split(',').filter(Boolean),
    type: get('type'),
    formats: (get('formats') || 'post,story').split(',').filter(Boolean),
    force: args.includes('--force'),
  };
}

async function openCard(browser, item, format) {
  const { width, height } = cfg.sizes[format];
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(TEMPLATE);
  const info = await page.evaluate(([i, c, f]) => window.renderCard(i, c, f), [item, cfg, format]);
  return { page, info };
}

async function renderImage(browser, item, format, outFile) {
  const { page, info } = await openCard(browser, item, format);
  await page.screenshot({ path: outFile, type: 'jpeg', quality: 92 }); // انستقرام يقبل JPEG فقط للصور
  await page.close();
  return info;
}

function findAudio(id) {
  const dir = path.join(ROOT, cfg.reel.audio_dir);
  for (const name of [`${id}.mp3`, `${id}.m4a`, 'default.mp3', 'default.m4a']) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// الريل: كل إطار يُرسم في المتصفح عند زمن محدد ويُمرَّر لـ ffmpeg
async function renderReel(browser, item, outFile) {
  const { page, info } = await openCard(browser, item, 'reel');
  const { fps, min_seconds, max_seconds } = cfg.reel;
  const duration = Math.min(max_seconds, Math.max(min_seconds, 5 + info.lines * 1.3));
  const frames = Math.round(duration * fps);
  const audio = findAudio(item.id);

  const audioIn = audio
    ? ['-i', audio]
    : ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000'];
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    ...audioIn,
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
    '-af', `afade=t=out:st=${(duration - 1).toFixed(2)}:d=1`,
    '-t', duration.toFixed(2), '-movflags', '+faststart',
    outFile,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', code => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`)))));

  for (let f = 0; f < frames; f++) {
    await page.evaluate(([t, d]) => window.setTime(t, d), [f / fps, duration]);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await done;
  await page.close();
  return { ...info, duration, audio: audio ? path.basename(audio) : 'صامت' };
}

async function main() {
  const opts = parseArgs();
  const items = opts.all ? content.items
    : opts.type ? content.items.filter(i => i.type === opts.type)
    : content.items.filter(i => opts.ids.includes(i.id));
  const missing = opts.ids.filter(id => !content.items.some(i => i.id === id));
  if (missing.length) throw new Error(`معرّفات غير موجودة: ${missing.join(', ')}`);
  if (!items.length) throw new Error('حدد --ids أو --all');

  const browser = await chromium.launch();
  try {
    for (const item of items) {
      const dir = path.join(ROOT, cfg.output_dir, item.id);
      fs.mkdirSync(dir, { recursive: true });
      for (const format of opts.formats) {
        const out = path.join(dir, format === 'reel' ? 'reel.mp4' : `${format}.jpg`);
        if (!opts.force && fs.existsSync(out)) { console.log(`skip  ${item.id}/${path.basename(out)}`); continue; }
        const info = format === 'reel'
          ? await renderReel(browser, item, out)
          : await renderImage(browser, item, format, out);
        console.log(`done  ${item.id}/${path.basename(out)}`, JSON.stringify(info));
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });

# نشر الأذكار والآيات تلقائياً على انستقرام

نظام ينشر أذكار الصباح والمساء وآيات قرآنية (صور وريلز) على حساب انستقرام احترافي، تلقائياً عبر GitHub Actions.

| الوقت (الكويت) | المحتوى | الصيغة |
|---|---|---|
| 6:00 ص | أذكار الصباح | بوست صورة |
| 4:30 م | أذكار المساء | بوست صورة |
| 9:00 م | آية | ريل |
| **الجمعة** 6:00 ص | آية من سورة الكهف + تذكير بقراءتها | بوست |
| **الجمعة** 4:30 م | فضل الصلاة على النبي ﷺ | بوست |
| **الجمعة** 9:00 م | آية من الكهف / آية الصلاة على النبي | ريل |

> تقدر تغيّر هذا الجدول من [schedule.json](schedule.json) بدون لمس الكود.
> GitHub قد يتأخر في تشغيل المهام المجدولة من دقائق إلى نصف ساعة أحياناً — هذا طبيعي.

---

## محتويات المشروع

```
content.json            مكتبة المحتوى (73 عنصر) — يُبنى بالسكربت
config.json             الألوان، الخطوط، اسم الحساب، المقاسات
schedule.json           جدول النشر وقواعد الجمعة
posted_log.json         سجل المنشورات (يتحدث تلقائياً)
templates/card.html     قالب التصميم
fonts/                  الخطوط (Amiri Quran، Amiri، Noto Naskh)
output/<id>/            الصور والريلز الجاهزة (post.jpg, story.jpg, reel.mp4)
audio/                  ملفات التلاوة (اختياري)
scripts/build_content.js  يبني content.json من المصادر
scripts/render.js         يولّد الصور والريلز
scripts/publish.js        ينشر على انستقرام
.github/workflows/publish.yml   الجدولة
```

**مصادر المحتوى:** نص الآيات من `api.quran.com` بالرسم العثماني حرفياً، ونص الأذكار من حصن المسلم (`hisnmuslim.com`). التخريج والدرجة مكتوبة في `scripts/build_content.js` — راجعها على [الدرر السنية](https://dorar.net) قبل ما تبدأ.

---

## الخطوة ١: جهّز حساب انستقرام

1. افتح انستقرام ← الإعدادات ← **نوع الحساب والأدوات** ← **التبديل إلى حساب احترافي** (Business أو Creator).
2. ما تحتاج تربطه بصفحة فيسبوك — نستخدم *Instagram API with Instagram Login*.

## الخطوة ٢: طلّع التوكن من Meta for Developers

1. ادخل [developers.facebook.com](https://developers.facebook.com) وسجّل دخول، وفعّل حساب مطوّر إذا طلب منك.
2. **My Apps ← Create App**.
3. اختر حالة الاستخدام **Manage messaging & content on Instagram** (أو Other ← Business إذا ما ظهرت)، وكمّل إنشاء التطبيق.
4. من **Dashboard** اضغط **Customize the Manage messaging & content on Instagram use case** (أو من القائمة الجانبية: **Use cases ← Customize**)، ثم اختر **API setup with Instagram login**.
5. في قسم **Generate access tokens** اضغط **Add account** وسجّل دخول بحساب انستقرام حقك ووافق على الصلاحيات:
   - `instagram_business_basic`
   - `instagram_business_content_publish`
6. اضغط **Generate token** بجانب حسابك وانسخ التوكن. هذا هو **`IG_ACCESS_TOKEN`** (صالح 60 يوم).
7. طلّع **`IG_USER_ID`** بفتح هذا الرابط في المتصفح (حط التوكن مكان `TOKEN`):
   ```
   https://graph.instagram.com/v22.0/me?fields=user_id,username&access_token=TOKEN
   ```
   انسخ قيمة `user_id`.

> التطبيق يقدر يبقى في وضع **Development** طالما ينشر على حسابك أنت فقط (حسابك مضاف كمختبِر تلقائياً). ما تحتاج App Review.

### تجديد التوكن (كل أقل من 60 يوم)
افتح الرابط التالي بالتوكن الحالي، وخذ التوكن الجديد وحطه مكان القديم في GitHub Secrets:
```
https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=TOKEN
```
💡 حط تذكير في تقويمك كل 50 يوم. إذا انتهى التوكن بيفشل النشر وتوصلك رسالة من GitHub.

---

## الخطوة ٣: ارفع المشروع على GitHub

1. سوّ مستودع جديد على GitHub (**Public** — لأن GitHub Pages المجاني يحتاج مستودع عام. المفاتيح ما تنكشف لأنها في Secrets).
2. ارفع ملفات المشروع كلها (بما فيها مجلد `output/`).
3. **Settings ← Pages**: في Source اختر **Deploy from a branch**، الفرع `main` والمجلد `/ (root)`، واحفظ.
4. بعد دقيقة يصير عندك رابط مثل: `https://USERNAME.github.io/REPO`
   تأكد إنه شغال بفتح: `https://USERNAME.github.io/REPO/output/ayah-13-28/post.jpg`

## الخطوة ٤: أضف الـ Secrets والمتغيرات

**Settings ← Secrets and variables ← Actions**

تبويب **Secrets** ← New repository secret:

| الاسم | القيمة |
|---|---|
| `IG_ACCESS_TOKEN` | التوكن من الخطوة ٢ |
| `IG_USER_ID` | الـ user_id من الخطوة ٢ |

تبويب **Variables** ← New repository variable:

| الاسم | القيمة |
|---|---|
| `PUBLIC_BASE_URL` | `https://USERNAME.github.io/REPO` (بدون / في الآخر) |
| `PUBLISHING_ENABLED` | `true` |
| `GRAPH_API_VERSION` | اختياري، الافتراضي `v22.0` |

ثم **Settings ← Actions ← General ← Workflow permissions** واختر **Read and write permissions** (عشان يحفظ سجل النشر).

## الخطوة ٥: جرّب قبل التشغيل الفعلي

1. **Actions ← نشر انستقرام ← Run workflow**.
2. اختر الفترة وخلّ **dry_run** مفعّل ← Run. شوف المخرجات: بيطبع العنصر والرابط والكابشن بدون نشر.
3. لما تتأكد، شغّله مرة ثانية مع إلغاء **dry_run** — هذا ينشر فعلياً.
4. بعدها الجدولة تشتغل لحالها.

---

## إيقاف النشر

- **إيقاف مؤقت:** غيّر المتغير `PUBLISHING_ENABLED` إلى `false` (المهام تشتغل لكن ما تنشر شي). رجّعه `true` للاستئناف.
- **إيقاف كامل:** Actions ← نشر انستقرام ← زر **…** ← **Disable workflow**.

---

## إضافة محتوى جديد

المحتوى ينبني من `scripts/build_content.js` (لا تعدّل content.json يدوياً لأنه ينكتب من جديد):

**آية جديدة:** أضف سطر في مصفوفة `VERSES`:
```js
{ key: '2:286', topic: 'دعاء' },          // آية واحدة
{ key: '3:190-191', topic: 'تفكر' },      // عدة آيات
{ key: '18:1', topic: 'الكهف', friday: true },  // للجمعة
```
النص يُسحب تلقائياً من quran.com — لا تكتب نص الآية بنفسك.

**ذكر جديد:** ابحث عن رقمه في `sources/husn_ar.json` (قائمة الفصول) ثم ملف الفصل، وأضفه في `ADHKAR` مع التخريج والدرجة:
```js
{ id: 196, type: 'عام', name: 'كفارة المجلس', takhrij: 'سنن الترمذي (3433)', grade: 'صحيح (الألباني)' },
```
إذا الفصل مو منزّل: `curl -o sources/h<رقم>.json https://www.hisnmuslim.com/api/ar/<رقم>.json`

**بعدها:**
```bash
npm install
npx playwright install chromium
npm run content                                    # يبني content.json
node scripts/render.js --all --formats post,story  # الصور الجديدة فقط (الموجودة تُتخطى)
node scripts/render.js --type آية --formats reel    # ريلز الآيات
npm run dry-run                                    # محاكاة 14 يوم للتأكد
```
ثم ارفع التغييرات على GitHub (`git add . && git commit -m "محتوى جديد" && git push`).

> يحتاج جهازك: Node.js 20+ و ffmpeg.

---

## التصاميم

- كل الألوان والخطوط واسم الحساب في [config.json](config.json). غيّر `account.handle` إلى يوزرك.
- بعد أي تعديل على التصميم أعد التوليد مع `--force`:
  ```bash
  node scripts/render.js --all --formats post,story --force
  node scripts/render.js --type آية --formats reel --force
  ```
- **تجربة عنصر واحد:** `node scripts/render.js --ids ayah-13-28 --formats post,story,reel --force`

### الصوت في الريلز
الريلز تطلع بصوت صامت. لإضافة تلاوة **مرخّصة**: حط الملف في مجلد `audio/` باسم معرّف العنصر (`ayah-13-28.mp3`) أو `default.mp3` للكل، وأعد توليد الريل مع `--force`. الصوت يُقص على طول الريل ويختفي تدريجياً في آخر ثانية.

### نشر الستوري أيضاً
غيّر `"also_story": true` في schedule.json — بعدها كل بوست صباح ومساء ينزل معه ستوري.

---

## أوامر التجربة (dry-run)

```bash
node scripts/publish.js --slot morning --dry-run                   # وش بينشر الصبح
node scripts/publish.js --slot evening --date 2026-11-13 --dry-run # محاكاة يوم جمعة
node scripts/publish.js --simulate 30                              # جدول 30 يوم كامل
```
الـ dry-run ما ينشر وما يعدّل السجل.

## كيف يمنع التكرار
`posted_log.json` يسجل كل منشور. في كل فترة يُختار العنصر الأقل نشراً، ولما يخلص المحتوى كله يرجع من البداية تلقائياً (دورة ٢، ٣، …). وما يتكرر نفس الذكر مرتين في نفس اليوم.

## حل المشاكل
| الرسالة | السبب |
|---|---|
| `الملف غير متاح على الرابط العام (404)` | GitHub Pages ما اشتغل، أو `PUBLIC_BASE_URL` غلط، أو الملف ما انرفع |
| `Invalid OAuth access token` / `code 190` | التوكن انتهى — جدده (الخطوة ٢) |
| `Application request limit reached` | تجاوزت حد النشر (100 منشور / 24 ساعة) |
| `فشل تجهيز الميديا: ERROR` | الفيديو ما عجب انستقرام — أعد توليده |

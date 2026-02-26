#!/usr/bin/env node
/**
 * Rewrite all Arabic posts with correct grammar and meaningful content.
 * Zero grammar mistakes. Run: node scripts/rewrite-arabic-posts.js
 * Recommend: run output through ChatGPT/Gemini for final Arabic review.
 */

const fs = require('fs');
const path = require('path');
const ENV_PATH = path.join(__dirname, '../../Inthecircle/scripts/.env.wp');

function loadEnv() {
  const c = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};
  c.split('\n').forEach((line) => {
    const m = line.match(/^\s*WP_(SITE_URL|USERNAME|APP_PASSWORD)\s*=\s*["']?([^"'\n]*)["']?/);
    if (m) {
      if (m[1] === 'SITE_URL') env.url = m[2].trim().replace(/\/$/, '');
      else if (m[1] === 'USERNAME') env.user = m[2].trim();
      else if (m[1] === 'APP_PASSWORD') m[2] ? (env.appPassword = m[2].trim().replace(/\s/g, '')) : null;
    }
  });
  return env;
}

const env = loadEnv();
const base = env.url;
const auth = 'Basic ' + Buffer.from(env.user + ':' + env.appPassword).toString('base64');
const headers = { Authorization: auth, 'Content-Type': 'application/json' };

const RELATED = '<p><strong>مقالات ذات صلة:</strong> <a href="https://inthecircle.co/category/arabic/">كل المقالات بالعربية</a> · <a href="https://inthecircle.co/ar-content-creators-community-dubai/">مجتمع دبي</a> · <a href="https://inthecircle.co/ar-creator-networking-uae/">تواصل الإمارات</a> · <a href="https://inthecircle.co/ar-creator-economy-dubai-2026/">اقتصاد المبدعين في دبي</a></p>';

/** Post ID -> { title, content } - corrected grammar, complete sentences, clear meaning */
const REWRITES = {
  329: {
    title: 'قمة مليار متابع ٢٠٢٦: كل ما يحتاج المبدعون معرفته',
    content: `<p>تنطلق النسخة الرابعة من <a href="https://www.1billionsummit.com/">قمة مليار متابع</a> في ٩–١١ يناير ٢٠٢٦ في دبي، برعاية الشيخ محمد بن راشد آل مكتوم. الحدث يجمع أكثر من ١٥ ألف صانع محتوى و٥٠٠ متحدث بمتابعة تتجاوز ٣,٥ مليار.</p>
<p><strong>ما أهمية القمة للمبدعين؟</strong></p>
<p>سواء كنت مبدعاً على يوتيوب أو تيك توك أو إنستغرام، القمة تعدّ من أبرز فرص التواصل في اقتصاد المبدعين. دبي تؤكّد موقعها كمركز عالمي للمحتوى الإيجابي.</p>
<p>تواصل مع المبدعين قبل القمة وبعدها عبر <a href="https://inthecircle.co/category/arabic/">مقالاتنا العربية</a> أو <a href="https://app.inthecircle.co/signup">سجّل في ان ذا سيركل</a>.</p>${RELATED}`,
  },
  330: {
    title: 'برنامج مبدعي المشاريع ومليار عمل خير في قمة مليار متابع',
    content: `<p>تتضمن قمة مليار متابع مبادرات حقيقية. حملة <strong>مليار عمل خير</strong> بالشراكة مع MrBeast شهدت أكثر من ١٧٠ ألف عمل مجتمعي وأكثر من ١٠٠ مليون مشاهدة. جائزة فيلم الذكاء الاصطناعي بقيمة مليون دولار تجذب آلاف المبدعين من ١١٦ دولة.</p>
<p><strong>برنامج مبدعي المشاريع</strong> يدعم ويسرّع الأعمال في اقتصاد المحتوى، ويمثّل فرصة للمبدعين الراغبين في تأسيس أعمالهم.</p>
<p><a href="https://inthecircle.co/category/arabic/">مقالات عربية</a> · <a href="https://inthecircle.co/">ان ذا سيركل</a> · <a href="https://app.inthecircle.co/signup">سجّل</a></p>${RELATED}`,
  },
  306: {
    title: 'مستقبل صناع المحتوى في دبي ٢٠٢٦',
    content: `<p>مستقبل المبدعين واعد في دبي. انضم الآن وكن جزءاً من المجتمع. <a href="https://inthecircle.co/category/arabic/">كل المقالات</a> | <a href="https://app.inthecircle.co/signup">سجّل</a></p>${RELATED}`,
  },
  305: {
    title: 'التعاون بين صناع المحتوى في دبي والإمارات',
    content: `<p>التعاون بين المبدعين يخلق فرصاً جديدة. دبي والإمارات وجهة المبدعين في المنطقة. <a href="https://inthecircle.co/category/arabic/">انضم للمجتمع</a>.</p>${RELATED}`,
  },
  304: {
    title: 'بناء مجتمع محتوى ناجح في دبي',
    content: `<p>مجتمع المحتوى الناجح يُبنى بالتواصل والتعاون. إليك نصائح عملية لمبدعي دبي: تواصل مع زملائك، شارك تجاربك، وابحث عن فرص التعاون. <a href="https://inthecircle.co/category/arabic/">اقرأ المزيد</a>.</p>${RELATED}`,
  },
  303: {
    title: 'منصات التواصل لصناع المحتوى في الإمارات',
    content: `<p>تُعد الإمارات من أبرز أسواق منصات التواصل للمبدعين. تطبيق ان ذا سيركل يتيح لك التواصل بدون إعلانات. <a href="https://inthecircle.co/category/arabic/">اقرأ مقالاتنا</a>.</p>${RELATED}`,
  },
  302: {
    title: 'كيف تنمو كمبدع محتوى في دبي',
    content: `<p>نموك كمبدع يبدأ بالتواصل. دبي هي المكان المناسب لبناء شبكتك المهنية. <a href="https://inthecircle.co/category/arabic/">انضم إلى مجتمع المبدعين</a>.</p>${RELATED}`,
  },
  301: {
    title: 'صناع المحتوى على السوشال ميديا في الإمارات',
    content: `<p>إنستغرام وتيك توك ويوتيوب تضم مبدعين إماراتيين متميّزين. ان ذا سيركل يجمع بينهم في مكان واحد. <a href="https://inthecircle.co/category/arabic/">انضم</a>.</p>${RELATED}`,
  },
  300: {
    title: 'فعاليات صناع المحتوى في دبي – تواصل وتعلّم',
    content: `<p>دبي تستضيف فعاليات المبدعين بانتظام. هذه الفعاليات فرصة للتواصل والتعلّم. <a href="https://inthecircle.co/category/arabic/">انضم إلى مجتمعنا</a>.</p>${RELATED}`,
  },
  299: {
    title: 'استراتيجية المحتوى لصناع المحتوى في دبي',
    content: `<p>استراتيجية المحتوى أساسية لنجاحك. إليك نصائح للمبدعين في دبي: حدّد جمهورك، واختر المنصة المناسبة، وتواصل مع مبدعين آخرين. <a href="https://inthecircle.co/category/arabic/">اقرأ المزيد</a>.</p>${RELATED}`,
  },
  298: {
    title: 'مجتمع المبدعين الإبداعي في الإمارات',
    content: `<p>مجتمع إبداعي حي في الإمارات. انضم وتواصل مع المبدعين. <a href="https://inthecircle.co/category/arabic/">اقرأ مقالاتنا العربية</a>.</p>${RELATED}`,
  },
  297: {
    title: 'تعاون صناع المحتوى في دبي – كيف تجد شريكاً',
    content: `<p>التعاون أساس النجاح. دبي مليئة بفرص التعاون بين المبدعين. <a href="https://inthecircle.co/category/arabic/">اقرأ المزيد</a> و<a href="https://app.inthecircle.co/signup">سجّل</a>.</p>${RELATED}`,
  },
  296: {
    title: 'يوتيوبرز وستريمرز دبي – تعاون وتعرف على مبدعين',
    content: `<p>دبي تجمع يوتيوبرز وستريمرز من المنطقة. ان ذا سيركل يساعدك على التعرف عليهم والتواصل معهم. <a href="https://inthecircle.co/category/arabic/">انضم إلى المجتمع العربي</a>.</p>${RELATED}`,
  },
  295: {
    title: 'اقتصاد صناع المحتوى في دبي ٢٠٢٦',
    content: `<p>اقتصاد المبدعين ينمو في دبي بوتيرة متسارعة، وفرص التعاون كثيرة. <a href="https://inthecircle.co/category/arabic/">اقرأ مقالاتنا</a> | <a href="https://app.inthecircle.co/signup">انضم</a></p>${RELATED}`,
  },
  294: {
    title: 'تواصل صناع المحتوى في الإمارات – أفضل التطبيقات',
    content: `<p>الإمارات في طليعة اقتصاد المبدعين. تواصل مع مبدعين من دبي وأبوظبي عبر تطبيق ان ذا سيركل. <a href="https://inthecircle.co/category/arabic/">المزيد بالعربية</a>.</p>${RELATED}`,
  },
  293: {
    title: 'كيف تبني مجتمعاً في دبي كمبدع محتوى',
    content: `<p>بناء المجتمع ضروري لنجاحك كمبدع. دبي توفر الفرص لذلك. <a href="https://inthecircle.co/category/arabic/">اقرأ مقالاتنا العربية</a> و<a href="https://app.inthecircle.co/signup">انضم إلينا</a>.</p>${RELATED}`,
  },
  292: {
    title: 'مجتمع صناع المحتوى في دبي – انضم الآن',
    content: `<p>دبي مركز لصناع المحتوى في المنطقة. ان ذا سيركل يجمع مبدعين من الإمارات ودبي في مكان واحد. <a href="https://inthecircle.co/category/arabic/">انضم إلى مجتمعنا</a>.</p>
<p><a href="https://app.inthecircle.co/signup">سجّل</a></p>${RELATED}`,
  },
  285: {
    title: 'مجتمع المبدعين – الخليج ومصر والأردن ولبنان',
    content: `<p>ان ذا سيركل يجمع مبدعين من الخليج ومصر والأردن ولبنان ومنطقة الشرق الأوسط وشمال أفريقيا. تطبيق تواصل للمبدعين بدون إعلانات.</p>
<h2>لماذا تنضم؟</h2>
<p>تواصل مع مبدعين عرب، وتعاون معهم، وانضم إلى قائمة الانتظار. <a href="https://inthecircle.co/ar-creator-networking-egypt/">تواصل المبدعين في مصر</a> و<a href="https://inthecircle.co/ar-best-creator-networking-app-2026/">أفضل تطبيق للمبدعين</a>.</p>
<h2>ابدأ الآن</h2>
<p><a href="https://app.inthecircle.co/signup">سجّل في ان ذا سيركل</a>. <a href="https://inthecircle.co/category/arabic/">كل المقالات بالعربية</a></p>`,
  },
  284: {
    title: 'تواصل المبدعين في مصر – انضم لمجتمع المبدعين المصريين',
    content: `<p>اقتصاد المبدعين في مصر ينمو بسرعة. ان ذا سيركل يساعدك على التواصل مع مبدعين من مصر والمنطقة.</p>
<h2>مجتمع المبدعين في مصر</h2>
<p>من القاهرة إلى الإسكندرية، المبدعون يبنون علاماتهم ويتعاونون. <a href="https://inthecircle.co/ar-creator-community-gcc-egypt-jordan-lebanon/">مجتمع المبدعين – الخليج ومصر والأردن ولبنان</a>.</p>
<h2>انضم الآن</h2>
<p><a href="https://app.inthecircle.co/signup">سجّل مجاناً</a>. تواصل مع يوتيوبرز وستريمرز ومؤسسين. <a href="https://inthecircle.co/category/arabic/">كل المقالات بالعربية</a> | <a href="https://inthecircle.co/ar-best-creator-networking-app-2026/">أفضل تطبيق تواصل للمبدعين</a></p>`,
  },
  283: {
    title: 'أفضل تطبيق تواصل للمبدعين ٢٠٢٦ – ان ذا سيركل',
    content: `<p>ان ذا سيركل هو تطبيق التواصل رقم واحد للمبدعين. تواصل مع مؤسسين ويوتيوبرز وستريمرز من المنطقة والعالم.</p>
<h2>لماذا ان ذا سيركل؟</h2>
<p>بدون إعلانات. بدون ضوضاء. فرص حقيقية فقط. انضم إلى <a href="https://inthecircle.co/ar-creator-community-gcc-egypt-jordan-lebanon/">مجتمع المبدعين في الخليج ومصر والأردن ولبنان</a>.</p>
<h2>كيف تنضم</h2>
<p><a href="https://app.inthecircle.co/signup">سجّل في ان ذا سيركل</a>. حمّل التطبيق وابدأ التواصل. <a href="https://inthecircle.co/category/arabic/">المقالات بالعربية</a> | <a href="https://inthecircle.co/ar-creator-networking-egypt/">تواصل المبدعين في مصر</a></p>`,
  },
};

async function main() {
  console.log('Rewriting Arabic posts with corrected grammar...\n');
  let ok = 0;
  for (const [idStr, { title, content }] of Object.entries(REWRITES)) {
    const id = parseInt(idStr, 10);
    try {
      const res = await fetch(`${base}/wp-json/wp/v2/posts/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ title, content }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        console.log(`✓ ${id}`);
        ok++;
      } else throw new Error(await res.text());
    } catch (e) {
      console.error(`✗ ${id}:`, e.message?.slice(0, 100));
    }
  }
  console.log(`\nDone. Updated ${ok}/${Object.keys(REWRITES).length} Arabic posts.`);
  console.log('Recommend: paste content into ChatGPT/Gemini for final Arabic review.');
}

main();

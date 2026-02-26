#!/usr/bin/env node
/**
 * Create blog posts about the 1 Billion Followers Summit via WordPress REST API.
 * Run: node scripts/create-1billion-posts.js
 * Requires: Inthecircle/scripts/.env.wp
 */

const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '../../Inthecircle/scripts/.env.wp');

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error('Missing', ENV_PATH);
    process.exit(1);
  }
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

function getAuthHeader(env) {
  return 'Basic ' + Buffer.from(env.user + ':' + env.appPassword).toString('base64');
}

const ENGLISH_POSTS = [
  {
    title: '1 Billion Followers Summit 2026: What Creators Need to Know',
    content: `<p>The fourth edition of the <a href="https://www.1billionsummit.com/">1 Billion Followers Summit</a> is set for January 9–11, 2026 in Dubai, under the patronage of Sheikh Mohammed bin Rashid Al Maktoum. The event brings together over 15,000 content creators and 500+ speakers with a combined following of more than 3.5 billion.</p>
<p><strong>Why it matters for creators</strong></p>
<p>Whether you're a streamer, YouTuber, or TikTok creator, the summit is one of the biggest networking opportunities in the creator economy. Dubai continues to position itself as a global hub for positive content and the digital economy, and this event reflects that vision.</p>
<p>Connect with other creators before, during, and after the summit. <a href="https://inthecircle.co/about/">Learn about InTheCircle</a> — the networking app for creators and founders. <a href="https://inthecircle.co/blog/">Explore our blog</a> for more creator tips.</p>`,
    categories: [16], // News
    status: 'publish',
  },
  {
    title: '1 Billion Followers Summit: Emirates Towers, DIFC, Museum of the Future',
    content: `<p>The 2026 1 Billion Followers Summit spans three iconic Dubai venues: Emirates Towers, Dubai International Financial Centre (DIFC), and the Museum of the Future. The theme is <strong>"Content for Good"</strong>, highlighting positive and impactful content creation.</p>
<p>Each venue offers a different atmosphere for networking, talks, and workshops. Whether you're exploring AI-driven content or connecting with brands and fellow creators, the multi-venue setup gives you plenty of opportunities to grow.</p>
<p>Want to build your creator network ahead of the summit? <a href="https://app.inthecircle.co/signup">Join InTheCircle</a> and start connecting with creators in Dubai and beyond. <a href="https://inthecircle.co/">Home</a> | <a href="https://inthecircle.co/faq/">FAQ</a></p>`,
    categories: [16],
    status: 'publish',
  },
  {
    title: '1 Billion Acts of Kindness and AI Film Award: Summit Highlights',
    content: `<p>The 1 Billion Followers Summit isn't just about networking — it's driving real initiatives. The <strong>1 Billion Acts of Kindness</strong> campaign, launched with MrBeast, has already seen 170,000+ community acts and over 100 million views within weeks.</p>
<p>Another standout is the <strong>AI Film Award</strong>: a $1 million prize for the best short film made with generative AI. Over 30,000 participants from 116 countries submitted 3,500 films. The TikTok Education Initiative has also engaged 610,000 participants creating 320,000 educational videos with 1.8 billion views.</p>
<p>These programs show how content can drive both community impact and career growth. <a href="https://inthecircle.co/blog/">Read more creator insights</a> and <a href="https://app.inthecircle.co/signup">sign up</a> to connect with creators who care about content for good.</p>`,
    categories: [18], // Resources
    status: 'publish',
  },
  {
    title: 'How to Network at the 1 Billion Followers Summit Dubai',
    content: `<p>With 15,000+ creators and 500+ speakers, the 1 Billion Followers Summit can feel overwhelming. Here are practical tips to make the most of your networking:</p>
<p><strong>1. Connect before the event</strong> — Use <a href="https://inthecircle.co/">InTheCircle</a> to find and meet creators who will attend. Build relationships before you land in Dubai.</p>
<p><strong>2. Target sessions that fit your niche</strong> — Whether you focus on education, entertainment, or lifestyle, pick talks where you're likely to meet like-minded creators.</p>
<p><strong>3. Follow up</strong> — Exchange contacts and follow up within 48 hours. InTheCircle makes it easy to stay in touch after the summit.</p>
<p>Dubai is the place to be for creator networking in 2026. <a href="https://inthecircle.co/about/">About InTheCircle</a> | <a href="https://inthecircle.co/blog/">Blog</a></p>`,
    categories: [18],
    status: 'publish',
  },
  {
    title: 'Creators Ventures Programme: Launch Your Business at 1 Billion Followers Summit',
    content: `<p>The <strong>Creators Ventures Programme</strong> at the 1 Billion Followers Summit supports and accelerates businesses in the content economy. If you're building a creator-led brand or platform, this programme can help you connect with investors, partners, and mentors.</p>
<p>The UAE is committed to growing the creator economy, and initiatives like this show the opportunities available to founders and creators in Dubai and the wider region.</p>
<p>Networking is key to growth. <a href="https://app.inthecircle.co/signup">Sign up for InTheCircle</a> — the professional networking app for creators and founders. <a href="https://inthecircle.co/faq/">FAQ</a> | <a href="https://inthecircle.co/blog/">Blog</a></p>`,
    categories: [18],
    status: 'publish',
  },
];

const ARABIC_POSTS = [
  {
    title: 'قمة مليار متابع ٢٠٢٦: كل ما يحتاج المبدعون معرفته',
    content: `<p>تنطلق النسخة الرابعة من <a href="https://www.1billionsummit.com/">قمة مليار متابع</a> في ٩–١١ يناير ٢٠٢٦ في دبي، برعاية الشيخ محمد بن راشد آل مكتوم. الحدث يجمع أكثر من ١٥ ألف صانع محتوى و٥٠٠+ متحدث بمتابعة تتجاوز ٣.٥ مليار.</p>
<p><strong>لماذا يهم المبدعين</strong></p>
<p>سواء كنت مبدعاً على يوتيوب أو تيك توك أو إنستغرام، القمة واحدة من أكبر فرص التواصل في اقتصاد المبدعين. دبي تواصل تأكيد موقعها كمركز عالمي للمحتوى الإيجابي.</p>
<p>تواصل مع المبدعين قبل القمة وبعدها. <a href="https://inthecircle.co/category/arabic/">كل المقالات بالعربية</a> | <a href="https://app.inthecircle.co/signup">سجّل في إنثيسيركل</a></p>`,
    categories: [19], // Arabic
    status: 'publish',
  },
  {
    title: 'برنامج مبدعي المشاريع ومليار عمل خير في قمة مليار متابع',
    content: `<p>تتضمن قمة مليار متابع مبادرات حقيقية. حملة <strong>مليار عمل خير</strong> بالشراكة مع مستبيست شهدت أكثر من ١٧٠ ألف عمل مجتمعي وأكثر من ١٠٠ مليون مشاهدة. جائزة فيلم الذكاء الاصطناعي بقيمة مليون دولار تجذب آلاف المبدعين من ١١٦ دولة.</p>
<p><strong>برنامج مبدعي المشاريع</strong> يدعم ويسرّع الأعمال في اقتصاد المحتوى. فرصة للمبدعين الراغبين بتأسيس أعمالهم.</p>
<p><a href="https://inthecircle.co/category/arabic/">مقالات عربية</a> · <a href="https://inthecircle.co/">إنثيسيركل</a> · <a href="https://app.inthecircle.co/signup">سجّل</a></p>`,
    categories: [19],
    status: 'publish',
  },
];

async function createPost(base, headers, post) {
  const res = await fetch(`${base}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: post.title,
      content: post.content,
      categories: post.categories,
      status: post.status || 'publish',
      date: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`POST failed ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  const env = loadEnv();
  if (!env.url || !env.user || !env.appPassword) {
    console.error('Set WP_SITE_URL, WP_USERNAME, WP_APP_PASSWORD in', ENV_PATH);
    process.exit(1);
  }

  const base = env.url;
  const headers = {
    Authorization: getAuthHeader(env),
    'Content-Type': 'application/json',
  };

  console.log('Creating 1 Billion Followers Summit posts...\n');

  const all = [...ENGLISH_POSTS, ...ARABIC_POSTS];
  let created = 0;

  for (const post of all) {
    try {
      const p = await createPost(base, headers, post);
      console.log(`✓ Created: ${post.title} (ID ${p.id})`);
      created++;
    } catch (e) {
      console.error(`✗ Failed: ${post.title} – ${e.message}`);
    }
  }

  console.log(`\nDone. Created ${created}/${all.length} posts.`);
  console.log('View at https://inthecircle.co/blog/ and https://inthecircle.co/category/arabic/');
}

main();

#!/usr/bin/env node
/**
 * Apply strong SEO (meta title, description, focus keyphrase) to all posts via AIOSEO REST API.
 * Run: node scripts/apply-seo-all-posts.js
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

/** Strong SEO per post: title (50–60 chars), description (150–160 chars), keyphrase */
const SEO_BY_SLUG = {
  // 1 Billion Followers Summit
  '1-billion-followers-summit-2026-what-creators-need-to-know': {
    title: '1 Billion Followers Summit 2026: What Creators Need to Know',
    description: 'The 4th 1 Billion Followers Summit is Jan 9–11, 2026 in Dubai. 15,000+ creators, 500+ speakers. What it means for you & how to network.',
    keyphrase: '1 billion followers summit',
  },
  '1-billion-followers-summit-emirates-towers-difc-museum-of-the-future': {
    title: '1 Billion Followers Summit: Emirates Towers, DIFC, Museum of Future',
    description: 'The 2026 summit spans Emirates Towers, DIFC & Museum of the Future. Theme: Content for Good. Where to network in Dubai.',
    keyphrase: '1 billion followers summit Dubai venues',
  },
  '1-billion-acts-of-kindness-and-ai-film-award-summit-highlights': {
    title: '1 Billion Acts of Kindness & AI Film Award: Summit Highlights',
    description: '1 Billion Acts of Kindness with MrBeast. AI Film Award $1M prize. How the summit drives real impact for creators. Read more.',
    keyphrase: '1 billion followers summit initiatives',
  },
  'how-to-network-at-the-1-billion-followers-summit-dubai': {
    title: 'How to Network at 1 Billion Followers Summit Dubai 2026',
    description: '15,000+ creators at the summit. Tips to network: connect before, target sessions, follow up. Build your circle with InTheCircle.',
    keyphrase: 'network 1 billion followers summit Dubai',
  },
  'creators-ventures-programme-launch-your-business-at-1-billion-followers-summit': {
    title: 'Creators Ventures Programme: Launch Your Business | Summit 2026',
    description: 'The Creators Ventures Programme accelerates businesses in the content economy. Connect with investors & mentors in Dubai. Join InTheCircle.',
    keyphrase: 'creators ventures programme Dubai',
  },
  // Core English
  'best-creator-networking-app-2026': {
    title: 'Best Creator Networking App 2026 – Connect & Collaborate | InTheCircle',
    description: 'The best creator networking app in 2026 helps founders, YouTubers & streamers connect. No ads, real collaborations. See why InTheCircle leads.',
    keyphrase: 'creator networking app',
  },
  'how-to-connect-with-other-creators': {
    title: 'How to Connect with Other Creators – Real Strategies 2026',
    description: 'Learn how to connect with other creators: networking app, DMs, community. Find collaborators and grow your circle with InTheCircle.',
    keyphrase: 'connect with creators',
  },
  'networking-for-youtubers-and-streamers': {
    title: 'Networking for YouTubers and Streamers – Find Your Circle',
    description: 'Networking for YouTubers and streamers: join a real creator community. Find collabs, guests, support. InTheCircle – the creator app.',
    keyphrase: 'YouTuber network streamer community',
  },
  'how-to-find-collaborators-as-a-creator': {
    title: 'How to Find Collaborators as a Creator – Step-by-Step 2026',
    description: 'How to find collaborators: use a creator networking app, define goals, reach out with value. Join InTheCircle to find your next collab.',
    keyphrase: 'find collaborators creators',
  },
  'why-creator-networking-matters': {
    title: 'Why Creator Networking Matters in 2026 – Build Your Circle',
    description: 'Why creator networking matters: audience, collabs, long-term growth. Join a creator community and use the right networking app for creators.',
    keyphrase: 'creator networking professional networking creators',
  },
  'creator-community-build-your-circle': {
    title: 'Creator Community: How to Build Your Circle in 2026',
    description: 'Build your creator community and find your circle. The best creator app connects you with founders, YouTubers & streamers. Join InTheCircle.',
    keyphrase: 'creator community',
  },
  'inthecircle-community-trending-waitlist': {
    title: 'Why InTheCircle Community Is Trending – Creators Joining 2026',
    description: 'The InTheCircle creator community is trending. Thousands of creators joining. See why the networking app for creators is growing fast in 2026.',
    keyphrase: 'inthecircle community trending creator waitlist',
  },
  'creator-community-gcc-egypt-jordan-lebanon': {
    title: 'Creator Community: GCC, Egypt, Jordan & Lebanon | InTheCircle',
    description: 'Creator community for GCC, UAE, Saudi Arabia, Egypt, Jordan, Lebanon. Connect with Arab creators. InTheCircle – networking for MENA creators.',
    keyphrase: 'creator community GCC Egypt Jordan Lebanon',
  },
  'inthecircle-waitlist-creators-joining': {
    title: 'InTheCircle Waitlist: Thousands of Creators Joining – Get In',
    description: "The InTheCircle waitlist is growing. Thousands of creators joining. Join the creator community everyone's talking about – GCC, Egypt, MENA & global.",
    keyphrase: 'inthecircle waitlist creators joining',
  },
  'creator-collaboration-tips': {
    title: 'Creator Collaboration Tips: Find Your Perfect Partner 2026',
    description: 'Creator collaboration tips: define goals, find complementary creators, reach out with value. Use InTheCircle to find collaborators.',
    keyphrase: 'creator collaboration tips',
  },
  'mena-creator-economy-connect-arab-creators': {
    title: 'MENA Creator Economy: Connect with Arab Creators | InTheCircle',
    description: 'The MENA creator economy is booming. Connect with Arab creators in UAE, Saudi, Egypt. InTheCircle – the networking app for MENA creators.',
    keyphrase: 'MENA creator economy Arab creators',
  },
  'connect-with-streamers-gaming-creators': {
    title: 'How to Connect with Streamers and Gaming Creators',
    description: 'Connect with streamers and gaming creators. Find collabs, sponsors, community. InTheCircle helps YouTubers and streamers network.',
    keyphrase: 'connect streamers gaming creators',
  },
  'creator-networking-egypt-egyptian-creators': {
    title: 'Creator Networking Egypt: Connect with Egyptian Creators',
    description: 'Creator networking in Egypt: connect with Egyptian creators, find collabs, grow your audience. Join InTheCircle – the MENA creator app.',
    keyphrase: 'creator networking Egypt Egyptian creators',
  },
  'best-creator-networking-app-egypt': {
    title: 'Best Creator Networking App for Egypt: InTheCircle 2026',
    description: 'The best creator networking app for Egypt. Connect with Egyptian creators, find collaborators, grow. InTheCircle – no ads, real connections.',
    keyphrase: 'creator networking app Egypt',
  },
  'welcome-to-in-the-circle': {
    title: 'Welcome to InTheCircle – Creator & Founder Networking App',
    description: 'InTheCircle connects creators, founders & digital professionals. Build your circle, find collaborators, grow. Join the future of creator networking.',
    keyphrase: 'inthecircle creator networking app',
  },
  // Arabic posts – strong Arabic SEO
  'ar-best-creator-networking-app-2026': {
    title: 'أفضل تطبيق تواصل للمبدعين ٢٠٢٦ – ان ذا سيركل',
    description: 'ان ذا سيركل أفضل تطبيق تواصل للمبدعين في ٢٠٢٦. تواصل مع صناع المحتوى، وجد شركاء، انضم لمجتمع المبدعين.',
    keyphrase: 'تطبيق تواصل للمبدعين',
  },
  'ar-creator-networking-uae': {
    title: 'تواصل صناع المحتوى في الإمارات – أفضل التطبيقات',
    description: 'تواصل المبدعين في الإمارات ودبي. أفضل تطبيقات التواصل للمبدعين. ان ذا سيركل – مجتمع المبدعين الإماراتيين.',
    keyphrase: 'تواصل صناع المحتوى الإمارات',
  },
  'ar-creator-networking-egypt': {
    title: 'تواصل المبدعين في مصر – انضم لمجتمع المبدعين المصريين',
    description: 'تواصل صناع المحتوى في مصر. انضم لمجتمع المبدعين المصريين، وجد شركاء تعاون، ان ذا سيركل.',
    keyphrase: 'تواصل المبدعين مصر',
  },
  'ar-creator-community-gcc-egypt-jordan-lebanon': {
    title: 'مجتمع المبدعين – الخليج ومصر والأردن ولبنان',
    description: 'مجتمع المبدعين في الخليج ومصر والأردن ولبنان. تواصل مع المبدعين العرب. ان ذا سيركل – تطبيق التواصل للمبدعين.',
    keyphrase: 'مجتمع المبدعين الخليج مصر',
  },
  'ar-content-creators-community-dubai': {
    title: 'مجتمع صناع المحتوى في دبي – انضم الآن',
    description: 'مجتمع صناع المحتوى في دبي والإمارات. انضم وتواصل مع المبدعين. ان ذا سيركل – أفضل تطبيق تواصل للمبدعين.',
    keyphrase: 'مجتمع صناع المحتوى دبي',
  },
  'ar-build-creator-community-dubai': {
    title: 'كيف تبني مجتمعاً في دبي كمبدع محتوى',
    description: 'كيف تبني مجتمع محتوى ناجح في دبي. نصائح للمبدعين. تواصل وتعلم. ان ذا سيركل يساعدك على بناء مجتمعك.',
    keyphrase: 'بناء مجتمع محتوى دبي',
  },
  'ar-creator-economy-dubai-2026': {
    title: 'اقتصاد صناع المحتوى في دبي ٢٠٢٦',
    description: 'اقتصاد المبدعين في دبي ٢٠٢٦. الفرص والنمو. انضم لمجتمع المبدعين في الإمارات. ان ذا سيركل.',
    keyphrase: 'اقتصاد صناع المحتوى دبي',
  },
  'ar-creator-platforms-uae': {
    title: 'منصات التواصل لصناع المحتوى في الإمارات',
    description: 'أفضل منصات التواصل للمبدعين في الإمارات. ان ذا سيركل بدون إعلانات. تواصل مع المبدعين الإماراتيين.',
    keyphrase: 'منصات تواصل المبدعين الإمارات',
  },
  'ar-grow-as-content-creator-dubai': {
    title: 'كيف تنمو كمبدع محتوى في دبي',
    description: 'نموك كمبدع يبدأ بالتواصل. دبي المكان المناسب. مجتمع المبدعين. ان ذا سيركل يساعدك على النمو.',
    keyphrase: 'نمو مبدع محتوى دبي',
  },
  'ar-creator-events-dubai': {
    title: 'فعاليات صناع المحتوى في دبي – تواصل وتعلّم',
    description: 'دبي تستضيف فعاليات المبدعين. تواصل وتعلّم. مجتمعنا. ان ذا سيركل – انضم لمجتمع المبدعين.',
    keyphrase: 'فعاليات صناع المحتوى دبي',
  },
  'ar-social-media-creators-uae': {
    title: 'صناع المحتوى على السوشال ميديا في الإمارات',
    description: 'إنستغرام وتيك توك ويوتيوب – مبدعون إماراتيون. ان ذا سيركل يجمعهم. انضم لمجتمع المبدعين.',
    keyphrase: 'صناع المحتوى السوشال ميديا الإمارات',
  },
  'ar-content-strategy-dubai': {
    title: 'استراتيجية المحتوى لصناع المحتوى في دبي',
    description: 'استراتيجية المحتوى مهمة. نصائح للمبدعين في دبي. اقرأ المزيد. ان ذا سيركل – تواصل مع المبدعين.',
    keyphrase: 'استراتيجية المحتوى دبي',
  },
  'ar-creative-community-uae': {
    title: 'مجتمع المبدعين الإبداعي في الإمارات',
    description: 'مجتمع إبداعي حي في الإمارات. انضم وتواصل. مقالات عربية. ان ذا سيركل – تطبيق تواصل المبدعين.',
    keyphrase: 'مجتمع المبدعين الإمارات',
  },
  'ar-content-collaboration-dubai': {
    title: 'تعاون صناع المحتوى في دبي – كيف تجد شريكاً',
    description: 'التعاون أساس النجاح. دبي مليئة بفرص التعاون. ان ذا سيركل يساعدك على إيجاد شركاء.',
    keyphrase: 'تعاون صناع المحتوى دبي',
  },
  'ar-content-creator-collaboration-dubai-uae': {
    title: 'التعاون بين صناع المحتوى في دبي والإمارات',
    description: 'التعاون بين المبدعين يخلق فرصاً. دبي والإمارات وجهة المبدعين. انضم للمجتمع. ان ذا سيركل.',
    keyphrase: 'تعاون صناع المحتوى دبي الإمارات',
  },
  'ar-youtubers-streamers-dubai': {
    title: 'يوتيوبرز وستريمرز دبي – تعاون وتعرف على مبدعين',
    description: 'تواصل مع يوتيوبرز وستريمرز في دبي. تعاون وتعرف على مبدعين. ان ذا سيركل – مجتمع المبدعين.',
    keyphrase: 'يوتيوبرز ستريمرز دبي',
  },
  'ar-build-successful-content-community-dubai': {
    title: 'بناء مجتمع محتوى ناجح في دبي',
    description: 'مجتمع المحتوى الناجح يبنى بالتواصل والتعاون. نصائح لمبدعي دبي. ان ذا سيركل يساعدك.',
    keyphrase: 'مجتمع محتوى ناجح دبي',
  },
  'ar-future-content-creators-dubai-2026': {
    title: 'مستقبل صناع المحتوى في دبي ٢٠٢٦',
    description: 'مستقبل المبدعين واعد في دبي. انضم الآن وكن جزءاً من المجتمع. ان ذا سيركل – تواصل مع المبدعين.',
    keyphrase: 'مستقبل صناع المحتوى دبي',
  },
};

/** Decode URL-encoded slug for lookup */
function decodeSlug(slug) {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

/** Truncate SEO title to ≤55 chars (buffer under 60) at word boundary */
function truncateTitle(title, max = 55) {
  if (!title || title.length <= max) return title;
  const cut = title.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
}

/** Truncate meta description to ≤155 chars (buffer under 160) at word boundary */
function truncateDesc(desc, max = 155) {
  if (!desc || desc.length <= max) return desc;
  const cut = desc.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
}

/** Generate SEO from title when no explicit mapping */
function fallbackSeo(title, slug) {
  const brand = ' | InTheCircle';
  const t = (title || '').replace(/&#038;/g, '&').slice(0, 55);
  const titleFinal = truncateTitle(t.length + brand.length <= 60 ? t + brand : t);
  const desc = `Read more about ${t}. Connect with creators. Join InTheCircle – the networking app for creators.`;
  return {
    title: titleFinal,
    description: truncateDesc(desc),
    keyphrase: slug && slug.startsWith('ar-') ? 'مبدعون إنثيسيركل' : 'creator networking',
  };
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

  console.log('Fetching all posts...\n');
  const res = await fetch(`${base}/wp-json/wp/v2/posts?per_page=100&status=publish`, { headers });
  if (!res.ok) {
    console.error('Failed to fetch posts:', res.status);
    process.exit(1);
  }
  const posts = await res.json();
  console.log(`Found ${posts.length} posts. Applying SEO...\n`);

  let ok = 0;
  let fail = 0;

  for (const post of posts) {
    const slug = post.slug || '';
    const rawSlug = decodeSlug(slug);
    const title = (post.title?.rendered || post.title || '').replace(/&#038;/g, '&');
    let seo = SEO_BY_SLUG[slug] || SEO_BY_SLUG[rawSlug];

    // Arabic slugs may be URL-encoded; try to match by partial
    if (!seo && slug.includes('%')) {
      for (const [k, v] of Object.entries(SEO_BY_SLUG)) {
        if (rawSlug.includes(k) || k.includes(rawSlug)) {
          seo = v;
          break;
        }
      }
    }

    // 1B Arabic posts – match by title
    if (!seo && (title.includes('مليار متابع') || title.includes('قمة مليار') || title.includes('برنامج مبدعي المشاريع'))) {
      seo = title.includes('برنامج مبدعي') ? {
        title: 'برنامج مبدعي المشاريع ومليار عمل خير | قمة مليار متابع',
        description: 'برنامج مبدعي المشاريع ومليار عمل خير في قمة مليار متابع ٢٠٢٦. انضم لمجتمع المبدعين. ان ذا سيركل.',
        keyphrase: 'قمة مليار متابع',
      } : {
        title: 'قمة مليار متابع ٢٠٢٦: كل ما يحتاج المبدعون معرفته',
        description: 'قمة مليار متابع ٢٠٢٦ في دبي. ١٥ ألف مبدع، ٥٠٠+ متحدث. انضم لمجتمع المبدعين. ان ذا سيركل.',
        keyphrase: 'قمة مليار متابع',
      };
    }

    if (!seo) seo = fallbackSeo(title, slug);

    const body = {
      aioseo_meta_data: {
        title: truncateTitle(seo.title),
        description: truncateDesc(seo.description),
      },
    };
    if (seo.keyphrase) {
      body.aioseo_meta_data.keyphrases = [{ keyphrase: seo.keyphrase }];
    }

    try {
      const patchRes = await fetch(`${base}/wp-json/wp/v2/posts/${post.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (patchRes.ok) {
        console.log(`✓ ${post.id} ${slug.slice(0, 50)}`);
        ok++;
      } else {
        const errText = await patchRes.text();
        if (patchRes.status === 400 && body.aioseo_meta_data.keyphrases) {
          delete body.aioseo_meta_data.keyphrases;
          const retry = await fetch(`${base}/wp-json/wp/v2/posts/${post.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15000),
          });
          if (retry.ok) {
            console.log(`✓ ${post.id} (title+desc) ${slug.slice(0, 50)}`);
            ok++;
          } else {
            console.error(`✗ ${post.id} ${slug}:`, (await retry.text()).slice(0, 100));
            fail++;
          }
        } else {
          console.error(`✗ ${post.id} ${slug}:`, errText.slice(0, 150));
          fail++;
        }
      }
    } catch (e) {
      console.error(`✗ ${post.id} ${slug}:`, e.message);
      fail++;
    }
  }

  console.log(`\nDone. Updated ${ok}/${posts.length} posts.${fail ? ` Failed: ${fail}` : ''}`);
}

main();

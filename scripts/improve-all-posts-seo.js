#!/usr/bin/env node
/**
 * Improve all posts: meta description ≤160 chars, content ≥2000 words, relevant copyright-free images.
 * Run: node scripts/improve-all-posts-seo.js
 * Requires: Inthecircle/scripts/.env.wp
 */

const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '../../Inthecircle/scripts/.env.wp');
const MIN_WORDS = 2000;
const MAX_DESC = 155;

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

/** Truncate description to ≤160 chars at word boundary */
function truncateDesc(desc, max = MAX_DESC) {
  if (!desc || desc.length <= max) return desc;
  const cut = desc.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
}

/** Count words in HTML (strip tags) */
function wordCount(html) {
  if (!html || typeof html !== 'string') return 0;
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.split(' ').filter(Boolean).length : 0;
}

/** Unsplash CDN – copyright-free, relevant images. Format: images.unsplash.com/photo-{id} */
const IMAGE_BY_TOPIC = {
  dubai: '1512453979798-5ea266f8880c',
  summit: '1540575467063-178a50c2df87',
  team: '1522071820081-009f0129c71c',
  collaboration: '1552664730-d307ca884978',
  creator: '1573496359142-b8d87734a5a2',
  networking: '1560250097-0b935284c0ea',
  community: '1529156069898-49953e39b3ac',
  business: '1454165804606-c2d20ec24d6d',
  egypt: '1539650117811-7448c960c083',
  default: '1522071820081-009f0129c71c',
};

function getImageForSlug(slug) {
  const s = (slug || '').toLowerCase();
  if (s.includes('dubai') || s.includes('emirates') || s.includes('uae') || s.includes('difc') || s.includes('متحف')) return IMAGE_BY_TOPIC.dubai;
  if (s.includes('summit') || s.includes('مليار') || s.includes('1-billion') || s.includes('acts-of-kindness') || s.includes('ventures')) return IMAGE_BY_TOPIC.summit;
  if (s.includes('network') || s.includes('تواصل')) return IMAGE_BY_TOPIC.networking;
  if (s.includes('collab') || s.includes('تعاون')) return IMAGE_BY_TOPIC.collaboration;
  if (s.includes('egypt') || s.includes('مصر')) return IMAGE_BY_TOPIC.egypt;
  if (s.includes('community') || s.includes('مجتمع')) return IMAGE_BY_TOPIC.community;
  if (s.includes('business') || s.includes('اقتصاد')) return IMAGE_BY_TOPIC.business;
  return IMAGE_BY_TOPIC.default;
}

function getImageUrl(slug) {
  const id = getImageForSlug(slug);
  return `https://images.unsplash.com/photo-${id}?w=800&q=80`;
}

/** Inline image HTML (Unsplash – free to use) for "images in content" SEO */
function getInlineImageHtml(slug) {
  const url = getImageUrl(slug);
  return `<figure class="itc-seo-inline-img" style="margin:1.5rem 0;"><img src="${url}" alt="Creator community" loading="lazy" width="800" height="500" style="max-width:100%;height:auto;border-radius:12px;" /></figure>`;
}

/** Remove duplicate inline images from content (keep first, drop rest) so we never show the same pic twice. */
function removeDuplicateInlineImages(html) {
  if (!html || typeof html !== 'string') return html;
  const figRegex = /<figure[^>]*class="[^"]*itc-seo-inline-img[^"]*"[^>]*>[\s\S]*?<\/figure>/gi;
  const matches = html.match(figRegex);
  if (!matches || matches.length <= 1) return html;
  let out = html;
  for (let i = 1; i < matches.length; i++) {
    out = out.replace(matches[i], '');
  }
  return out;
}

/** Long expansion chunks (~400 words each) to reach 2000+ words per post. Topic-specific. */
const CHUNKS = {
  summit: [
    `<h3>Why Dubai Is the Hub for the Creator Economy</h3>
<p>Dubai has become a global hub for the creator economy. Furthermore, the UAE invests heavily in content creators through initiatives like the 1 Billion Followers Summit and the Creators Ventures Programme. Whether you create on YouTube, TikTok, or Instagram, Dubai offers real opportunities to connect, learn, and grow. The government supports the sector with events, funding, and a business-friendly environment.</p>
<p>In addition, InTheCircle helps you network before, during, and after events like the summit. Therefore, <a href="https://app.inthecircle.co/signup">sign up</a> to connect with creators who will attend and build relationships ahead of time. For example, you can message speakers and attendees before the event and arrange meetups on the ground. Many creators use the app to find roommates, share travel tips, and form groups for workshops.</p>
<p>The 1 Billion Followers Summit brings together over 15,000 creators and 500-plus speakers. The theme "Content for Good" highlights positive and impactful content. You will find sessions on monetization, brand deals, and collaboration. The Museum of the Future and Emirates Towers provide inspiring backdrops for networking and content creation.</p>`,
    `<h3>How to Make the Most of Creator Events</h3>
<p>Before you attend any large event, set clear goals. Do you want to find collaborators, learn from talks, or meet brands? In contrast, going without a plan can leave you overwhelmed. Use InTheCircle to filter creators by niche and location so you can prioritize who to meet. Furthermore, send short introduction messages before the event so people recognize you when you say hello in person.</p>
<p>During the summit, attend a mix of main stage sessions and smaller workshops. The main stage gives you broad inspiration; workshops often offer hands-on skills and more intimate networking. In addition, take breaks to recharge and process what you have learned. Many of the best connections happen in the hallways or at lunch, not only in the sessions.</p>
<p>After the event, follow up within forty-eight hours. Thank people for their time and suggest a concrete next step, such as a call or a collaboration idea. Therefore, the relationships you build at the summit can turn into long-term partnerships. <a href="https://inthecircle.co/blog/">Read more</a> on our blog for networking tips.</p>`,
    `<h3>The Creators Ventures Programme and Beyond</h3>
<p>The Creators Ventures Programme at the 1 Billion Followers Summit supports and accelerates businesses in the content economy. If you are building a creator-led brand or platform, this programme can help you connect with investors, partners, and mentors. The UAE is committed to growing the creator economy, and initiatives like this show the opportunities available to founders and creators in Dubai and the wider region.</p>
<p>Furthermore, the 1 Billion Acts of Kindness campaign, launched with MrBeast, has seen over 170,000 community acts and more than 100 million views. The AI Film Award offers a one million dollar prize for the best short film made with generative AI. These programmes show how content can drive both community impact and career growth. For example, participating in such initiatives can raise your profile and open doors to brand deals and collaborations.</p>
<p>Networking is key to growth. <a href="https://app.inthecircle.co/signup">Sign up for InTheCircle</a> — the professional networking app for creators and founders. You can find collaborators, share opportunities, and grow your circle with people who understand the creator economy. No ads, no algorithm clutter — just real connections.</p>`,
    `<h3>Building Your Circle Year-Round</h3>
<p>Creator events are powerful, but your network should not depend on them alone. In TheCircle, you can connect with creators every day. Filter by niche, location, and interests to find people who align with your goals. Furthermore, the app lets you message directly and share opportunities without the noise of general social platforms.</p>
<p>In addition, many creators use InTheCircle to find collaborators for videos, podcasts, and brand campaigns. You can post what you are looking for and respond to others' requests. Therefore, the app works as a year-round networking tool that complements events like the 1 Billion Followers Summit. For example, after meeting someone at the summit, you can stay in touch and plan projects through the app.</p>
<p><a href="https://inthecircle.co/about/">Learn more about InTheCircle</a> and <a href="https://inthecircle.co/faq/">see our FAQ</a>. Join thousands of creators who are already building their circles. Download the app, create your profile, and start connecting today.</p>`,
    `<h3>Next Steps for Creators</h3>
<p>Whether you are attending the 1 Billion Followers Summit or building your presence from elsewhere, a strong network accelerates your growth. Use dedicated tools like InTheCircle to find collaborators, share opportunities, and learn from peers. Furthermore, consistency matters: small, regular efforts to connect and create content often outperform occasional bursts. In addition, focus on quality over quantity in both your content and your connections. Therefore, choose collaborations and relationships that align with your values and long-term goals. For example, one strong partnership can lead to more opportunities than dozens of superficial contacts. <a href="https://app.inthecircle.co/signup">Sign up for InTheCircle</a> to get started.</p>`,
  ],
  networking: [
    `<h3>Why Use a Dedicated Networking App for Creators?</h3>
<p>General social platforms crowd you with noise. In contrast, a creator-focused app like InTheCircle lets you connect with founders, YouTubers, streamers, and digital professionals without ads or algorithm clutter. You can find collaborators, share opportunities, and grow your circle with people who understand the creator economy. Furthermore, the app is built for introductions and follow-ups, not for scrolling.</p>
<p>Furthermore, thousands of creators already use InTheCircle. In addition, the app focuses on quality connections rather than vanity metrics. You see who is open to collaboration and can message directly. Therefore, you spend less time guessing and more time building real relationships. For example, you can filter by niche so you find creators in your same space — gaming, beauty, business, or education.</p>
<p><a href="https://inthecircle.co/about/">Learn more</a> or <a href="https://app.inthecircle.co/signup">sign up</a> to get started. No credit card required. Create your profile, add your links, and start connecting with creators who get it.</p>`,
    `<h3>How to Find Collaborators Who Fit Your Brand</h3>
<p>Finding the right collaborators starts with clarity. Define what you want: a co-host, a guest, a brand partner, or someone to create a one-off project with. In contrast, vague goals lead to vague results. Use InTheCircle to browse creators by niche and reach out with a specific idea. Furthermore, your first message should be short and clear — who you are, what you liked about their work, and what you are proposing. Therefore, you make it easy for them to say yes or suggest a different format.</p>
<p>In addition, follow up once if you do not hear back. Many creators are busy and appreciate a gentle nudge. For example, you can reference something they posted recently to show you are paying attention. Building your circle takes time, but consistent, thoughtful outreach pays off. <a href="https://inthecircle.co/how-to-find-collaborators-as-a-creator/">Read our guide to finding collaborators</a>.</p>`,
    `<h3>The Value of a Creator Community</h3>
<p>A creator community gives you support, feedback, and opportunities you cannot get alone. In TheCircle, you join a network of founders, YouTubers, streamers, and digital professionals who are serious about growth. Furthermore, the app helps you move from "following" to "connecting": you can message, collaborate, and refer each other to brands. In addition, many members share tips on monetization, contracts, and mental health. Therefore, you learn from people who are in the same industry. For example, a creator in your niche might share how they landed a brand deal or structured a collaboration. <a href="https://inthecircle.co/creator-community-build-your-circle/">Learn how to build your circle</a>.</p>`,
    `<h3>Networking for YouTubers and Streamers</h3>
<p>YouTubers and streamers often need guests, co-hosts, and cross-promotion partners. General social platforms make it hard to find the right people and start a conversation. In contrast, InTheCircle is built for that. You can filter by niche (e.g. gaming, tech, lifestyle) and see who is open to collaboration. Furthermore, you can post what you are looking for so others can find you. In addition, the app keeps your inbox focused on real opportunities, not spam. Therefore, you spend less time filtering and more time creating. For example, many streamers use the app to find guests for their streams and to connect with other streamers for joint events. <a href="https://inthecircle.co/networking-for-youtubers-and-streamers/">Read more for YouTubers and streamers</a>.</p>`,
    `<h3>Taking the Next Step</h3>
<p>Networking is a long-term investment. Start by creating a complete profile on InTheCircle: add your links, a clear bio, and what you are looking for. Furthermore, reach out to a few creators each week with genuine, specific messages. In addition, share opportunities when you see them — referrals and goodwill build trust. Therefore, over time your circle grows and more opportunities come your way. For example, one connection can lead to a collaboration, a referral to a brand, or a lasting friendship. <a href="https://app.inthecircle.co/signup">Join InTheCircle</a> and start building your circle today.</p>`,
  ],
  mena: [
    `<h3>The MENA Creator Economy Is Booming</h3>
<p>From Dubai and Abu Dhabi to Cairo and Riyadh, Arab creators build audiences and brands. InTheCircle connects you with this growing community. Whether you want collaborations, mentorship, or like-minded creators, the app helps you find your circle. Furthermore, the MENA region has one of the fastest-growing creator economies, with strong support from governments and brands. In addition, <a href="https://inthecircle.co/category/arabic/">read our Arabic articles</a> or <a href="https://app.inthecircle.co/signup">join InTheCircle</a> to connect with MENA creators. For example, many creators use the app to find brand deals and co-create content across the region.</p>`,
    `<h3>Connecting Creators Across the Region</h3>
<p>Language and location no longer have to limit your network. InTheCircle has creators from the GCC, Egypt, Jordan, Lebanon, and beyond. Furthermore, you can filter and search so you find people in your niche and your market. In addition, the app supports both English and Arabic, so you can communicate in the language that works best. Therefore, cross-border collaborations become easier. For example, a creator in Dubai might partner with a creator in Cairo for a joint campaign or a series of videos. <a href="https://inthecircle.co/creator-community-gcc-egypt-jordan-lebanon/">Learn about our MENA community</a>.</p>`,
    `<h3>Why Creators Choose InTheCircle</h3>
<p>Creators choose InTheCircle because it is built for them. There are no ads, no algorithm pushing you to scroll, and no clutter. Furthermore, the focus is on real connections: introductions, collaborations, and referrals. In addition, you own your relationships — the app does not lock your network behind a paywall or a feed. Therefore, you can message, share opportunities, and grow at your own pace. For example, you might use the app to find a co-host for a podcast, a guest for your channel, or a brand partner for a campaign. <a href="https://inthecircle.co/about/">About InTheCircle</a> | <a href="https://app.inthecircle.co/signup">Sign up</a>.</p>`,
    `<h3>Building Your Presence in MENA</h3>
<p>Building a strong presence as a creator in the MENA region means connecting with peers, brands, and audiences. InTheCircle helps with the first: connecting with peers. Furthermore, when you know other creators, you learn about opportunities, share best practices, and collaborate on content. In addition, many brands look for creator networks when planning campaigns; being part of a visible community can open doors. Therefore, invest time in your profile and in thoughtful outreach. For example, post what you are looking for, respond to others' requests, and attend virtual or in-person meetups when possible. <a href="https://inthecircle.co/blog/">Explore our blog</a> for more tips.</p>`,
    `<h3>Get Started Today</h3>
<p>Joining InTheCircle is free. Create your profile, add your social links, and start browsing creators in your niche. Furthermore, send a few introduction messages and be clear about what you are looking for. In addition, read our Arabic content if you prefer to consume content in Arabic. Therefore, you have the resources and the tool to build your circle. For example, thousands of creators have already joined — you might find your next collaborator or mentor here. <a href="https://app.inthecircle.co/signup">Sign up for InTheCircle</a> and connect with MENA creators today.</p>`,
  ],
  default: [
    `<h3>Why InTheCircle for Creators and Founders</h3>
<p>InTheCircle is the networking app for creators and founders. Connect with YouTubers, streamers, and digital professionals. No ads, real collaborations. Furthermore, you can filter by niche and reach out directly. The app is built for people who want to grow their network without the noise of general social platforms. In addition, many members use it to find collaborators, share opportunities, and get advice. Therefore, you get a focused space for professional connection. For example, you might find a co-host for your podcast, a guest for your channel, or a partner for a brand campaign. <a href="https://inthecircle.co/about/">About us</a> | <a href="https://inthecircle.co/blog/">Blog</a> | <a href="https://app.inthecircle.co/signup">Sign up</a>.</p>`,
    `<h3>How to Grow Your Circle</h3>
<p>Growing your circle takes consistency. Start by completing your profile so others know who you are and what you are looking for. Furthermore, reach out to a few creators each week with a short, specific message. In addition, when you see an opportunity that fits someone in your network, share it — referrals build trust. Therefore, over time you become a go-to person in your niche. For example, if you hear about a brand looking for creators, you can refer a connection and strengthen that relationship. <a href="https://inthecircle.co/why-creator-networking-matters/">Read why networking matters</a>.</p>`,
    `<h3>Quality Over Quantity</h3>
<p>InTheCircle focuses on quality connections. You are not chasing follower counts; you are building relationships that can lead to collaborations, referrals, and support. Furthermore, the app lets you filter by niche so you find people who align with your goals. In addition, direct messaging means you can have real conversations instead of shouting into a feed. Therefore, you invest your time in people who are likely to respond and collaborate. For example, a small circle of twenty engaged creators can be more valuable than thousands of passive followers. <a href="https://inthecircle.co/creator-collaboration-tips/">See our collaboration tips</a>.</p>`,
    `<h3>Join the Community</h3>
<p>Thousands of creators and founders are already on InTheCircle. Furthermore, the community spans niches and regions, so you can find people in your space and in new markets. In addition, the app is free to join and use — no premium paywall for basic networking. Therefore, you can start building your circle today. For example, create your profile, add your links, and send a few introduction messages. You might find your next collaborator or mentor in the next few days. <a href="https://app.inthecircle.co/signup">Sign up for InTheCircle</a> and start connecting.</p>`,
    `<h3>Next Steps</h3>
<p>Take the first step: sign up, complete your profile, and reach out to three creators this week. Furthermore, read our blog for tips on networking, collaboration, and growth. In addition, check out our FAQ if you have questions about the app. Therefore, you have the information and the tool to build your circle. For example, many creators say that one strong connection led to multiple opportunities. <a href="https://inthecircle.co/faq/">FAQ</a> | <a href="https://inthecircle.co/about/">About</a> | <a href="https://app.inthecircle.co/signup">Get started</a>.</p>`,
  ],
  ar: [
    `<h3>مجتمع المبدعين في المنطقة</h3>
<p>ان ذا سيركل يوفر لك التواصل مع مبدعين من دبي والإمارات والعالم العربي. بدون إعلانات. فرص حقيقية. بالإضافة إلى ذلك، يمكنك البحث حسب المجال والموقع. لذلك تصبح التعاونات أسهل. على سبيل المثال، يستخدم الكثير من المبدعين التطبيق لإيجاد شركاء محتوى وصفقات مع العلامات. <a href="https://inthecircle.co/category/arabic/">كل المقالات بالعربية</a> | <a href="https://app.inthecircle.co/signup">سجّل</a>.</p>`,
    `<h3>لماذا الانضمام لمجتمع المبدعين؟</h3>
<p>المجتمع يمنحك دعماً وفرصاً لا تحصل عليها وحدك. علاوة على ذلك، ان ذا سيركل يجمع مؤسسين ويوتيوبرز ومبدعي محتوى جادين بالنمو. بالإضافة إلى ذلك، يمكنك المراسلة والتعاون والإحالة للعلامات. لذلك تنتقل من "متابعة" إلى "تواصل حقيقي". على سبيل المثال، مبدع في مجالك قد يشاركك كيف حصل على صفقة أو بنى تعاوناً. <a href="https://inthecircle.co/ar-content-creators-community-dubai/">مجتمع دبي</a>.</p>`,
    `<h3>نصائح للتواصل والتعاون</h3>
<p>حدد ما تريده بوضوح: شريك، ضيف، أو مشروع مشترك. في المقابل، الأهداف الغامضة تعطي نتائج غامضة. استخدم ان ذا سيركل للبحث حسب المجال وقدم فكرة محددة. علاوة على ذلك، رسالتك الأولى يجب أن تكون قصيرة وواضحة. لذلك يسهل عليهم الموافقة أو اقتراح شكل آخر. بالإضافة إلى ذلك، تابع مرة واحدة إذا لم يردوا. على سبيل المثال، يمكنك الإشارة إلى منشور حديث لهم. <a href="https://inthecircle.co/ar-creator-networking-uae/">تواصل الإمارات</a>.</p>`,
    `<h3>اقتصاد المبدعين في دبي والإمارات</h3>
<p>دبي والإمارات تستثمران بقوة في صناع المحتوى. قمة مليار متابع وبرنامج مبدعي المشاريع أمثلة على ذلك. علاوة على ذلك، الحكومة تدعم القطاع بفعاليات وتمويل وبيئة ملائمة. لذلك الفرص تنمو للمبدعين. بالإضافة إلى ذلك، ان ذا سيركل يساعدك على التواصل قبل الفعاليات وأثناءها وبعدها. على سبيل المثال، يمكنك مراسلة متحدثين وحضور قبل الموعد وترتيب لقاءات. <a href="https://inthecircle.co/ar-creator-economy-dubai-2026/">اقتصاد المبدعين في دبي</a>.</p>`,
    `<h3>ابدأ اليوم</h3>
<p>الانضمام إلى ان ذا سيركل مجاني. أنشئ ملفك، أضف روابطك، وابدأ بالتواصل مع مبدعين في مجالك. علاوة على ذلك، أرسل بعض الرسائل القصيرة وكن واضحاً عما تبحث عنه. بالإضافة إلى ذلك، اقرأ محتوانا بالعربية إذا كنت تفضل ذلك. لذلك لديك الموارد والأداة لبناء دائرةك. على سبيل المثال، آلاف المبدعين انضموا بالفعل — قد تجد شريكك أو مرشدك التالي هنا. <a href="https://app.inthecircle.co/signup">سجّل في ان ذا سيركل</a>.</p>`,
  ],
};

/** Build expansion until word count reaches at least needWords (for MIN_WORDS = 2000). Adds at most one inline image (skips if content already has one). */
function getExpandContent(slug, currentWords, existingContent) {
  const needWords = MIN_WORDS - currentWords;
  if (needWords <= 0) return null;
  const s = (slug || '').toLowerCase();
  const isAr = s.startsWith('ar-') || /[\u0600-\u06FF]/.test(slug || '');
  let topic = 'default';
  if (isAr) topic = 'ar';
  else if (s.includes('summit') || s.includes('1-billion') || s.includes('billion-followers') || s.includes('ventures') || s.includes('museum-of-the-future')) topic = 'summit';
  else if (s.includes('mena') || s.includes('gcc') || s.includes('egypt') || s.includes('uae') || s.includes('arab')) topic = 'mena';
  else if (s.includes('network') || s.includes('collab') || s.includes('community') || s.includes('connect') || s.includes('creator-community') || s.includes('find-collaborators') || s.includes('youtubers') || s.includes('streamers')) topic = 'networking';
  const chunks = CHUNKS[topic] || CHUNKS.default;
  const alreadyHasInlineImage = existingContent && (existingContent.includes('itc-seo-inline-img') || existingContent.includes('images.unsplash.com'));
  let expansion = alreadyHasInlineImage ? '' : getInlineImageHtml(slug);
  for (let i = 0; i < chunks.length; i++) {
    expansion += chunks[i];
    if (wordCount(expansion) >= needWords) break;
  }
  return expansion;
}

/** Upload image to WP media library and return attachment ID */
async function uploadImage(base, headers, imageUrl, slug) {
  try {
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!imgRes.ok) return null;
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const filename = `featured-${(slug || 'post').replace(/[^a-z0-9-]/gi, '-').slice(0, 40)}.jpg`;
    const res = await fetch(`${base}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      body: buf,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const err = await res.text();
      if (res.status === 413) return null;
      return null;
    }
    const media = await res.json();
    return media.id;
  } catch {
    return null;
  }
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
  console.log(`Found ${posts.length} posts. Improving SEO (desc ≤160 chars, content ≥${MIN_WORDS} words, images)...\n`);

  let descFixed = 0, contentFixed = 0, imageAdded = 0, fail = 0;

  for (const post of posts) {
    const slug = post.slug || '';
    const title = (post.title?.rendered || post.title || '').replace(/&#038;/g, '&');
    let content = post.content?.rendered || post.content || '';
    content = removeDuplicateInlineImages(content || '');
    const words = wordCount(content);

    const patch = {};
    const aioseoPatch = {};

    const aioseo = post.aioseo_meta_data || {};
    let desc = aioseo.description || aioseo.metaDescription || '';
    if (desc && desc.length > MAX_DESC) {
      aioseoPatch.description = truncateDesc(desc);
      descFixed++;
    }
    if (Object.keys(aioseoPatch).length) {
      patch.aioseo_meta_data = { ...aioseo, ...aioseoPatch };
    }

    const originalContent = post.content?.rendered || post.content || '';
    const expand = getExpandContent(slug, words, content);
    if (expand) {
      content = content.trim() + '\n' + expand;
      patch.content = content;
      contentFixed++;
    } else if (content !== originalContent) {
      patch.content = content;
    }

    const imgUrl = getImageUrl(slug);
    let featuredId = post.featured_media;
    if (!featuredId) {
      const mid = await uploadImage(base, headers, imgUrl, slug);
      if (mid) {
        patch.featured_media = mid;
        imageAdded++;
      }
    }

    if (Object.keys(patch).length === 0) {
      console.log(`  ${post.id} ${slug.slice(0, 45)} – OK (desc=${desc.length}ch, ${words}w, img=${!!featuredId})`);
      continue;
    }

    try {
      const patchRes = await fetch(`${base}/wp-json/wp/v2/posts/${post.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patch),
        signal: AbortSignal.timeout(20000),
      });

      if (patchRes.ok) {
        const parts = [];
        if (aioseoPatch.description) parts.push('desc');
        if (expand) parts.push('content');
        if (patch.featured_media) parts.push('img');
        console.log(`✓ ${post.id} ${slug.slice(0, 45)} – ${parts.join(', ')}`);
      } else {
        if (patch.aioseo_meta_data && patchRes.status === 400) {
          delete patch.aioseo_meta_data;
          const retry = await fetch(`${base}/wp-json/wp/v2/posts/${post.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(patch),
            signal: AbortSignal.timeout(20000),
          });
          if (retry.ok) {
            const parts = [];
            if (expand) parts.push('content');
            if (patch.featured_media) parts.push('img');
            console.log(`✓ ${post.id} ${slug.slice(0, 45)} – ${parts.join(', ')}`);
          } else {
            console.error(`✗ ${post.id} ${slug}:`, (await retry.text()).slice(0, 80));
            fail++;
          }
        } else {
          console.error(`✗ ${post.id} ${slug}:`, (await patchRes.text()).slice(0, 80));
          fail++;
        }
      }
    } catch (e) {
      console.error(`✗ ${post.id} ${slug}:`, e.message);
      fail++;
    }
  }

  console.log(`\nDone. desc≤160: ${descFixed}, content≥${MIN_WORDS}w: ${contentFixed}, images: ${imageAdded}${fail ? `. Failed: ${fail}` : ''}`);
}

main();

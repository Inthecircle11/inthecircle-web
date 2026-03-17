#!/usr/bin/env node
/**
 * Fix Privacy Policy and Terms pages on WordPress:
 * 1. Rewrites page content with proper hero h1, no <ul><li> (fixes reversed-list CSS bug),
 *    and clean structure matching the site theme.
 * 2. Adds a WPCode PHP snippet to suppress the "subscribe" plugin widget on legal pages.
 * 3. Falls back to Custom CSS if WPCode is unavailable.
 *
 * Run: node scripts/fix-legal-pages.js
 */

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPaths = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', 'scripts', '.env.wp'),
    path.join(__dirname, '..', '..', '..', 'Inthecircle', 'scripts', '.env.wp'),
  ];
  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      const val = m[2].replace(/^["']|["']$/g, '').trim();
      if (key === 'WP_SITE_URL' && !process.env.WORDPRESS_URL) process.env.WORDPRESS_URL = val;
      else if (key === 'WP_USERNAME' && !process.env.WORDPRESS_USER) process.env.WORDPRESS_USER = val;
      else if (key === 'WP_APP_PASSWORD' && !process.env.WORDPRESS_APP_PASSWORD) process.env.WORDPRESS_APP_PASSWORD = val;
      else if (!process.env[key]) process.env[key] = val;
    }
  }
}

// ─── FIXED PAGE CONTENT ───────────────────────────────────────────────────────
// Uses <p>• text</p> bullets (NOT <ul><li>) to bypass the theme's reversed-list CSS.
// Hero h1 matches the About page structure.

// CSS injected into each legal page via Custom HTML block.
// Targets the "Thank you for reading this post…" subscribe widget by text content
// and by all common subscribe plugin class/id patterns.
const LEGAL_PAGE_CSS = `<!-- wp:html -->
<style>
/* Fix reversed list order */
.entry-content ul,.wp-block-list,.page-content ul {
  display:block!important;
  flex-direction:unset!important;
}
/* Hide the injected subscribe span */
.itc-hide-subscribe { display:none!important; }
</style>
<script>
(function(){
  var SUBSCRIBE_RE = /thank you for reading|don.t forget to subscribe/i;

  function wrapAndHide(textNode){
    /* The subscribe text is a raw text node — wrap it in a hidden span */
    var span = document.createElement('span');
    span.className = 'itc-hide-subscribe';
    span.style.display = 'none';
    textNode.parentNode.insertBefore(span, textNode);
    span.appendChild(textNode);
  }

  function sweep(){
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    var node, found = [];
    while((node = walker.nextNode())){
      if(SUBSCRIBE_RE.test(node.nodeValue)) found.push(node);
    }
    /* Hide after walking (don't mutate during traversal) */
    found.forEach(function(n){ wrapAndHide(n); });
  }

  /* Run at every opportunity to catch static + dynamic injection */
  sweep();
  document.addEventListener('DOMContentLoaded', sweep);
  setTimeout(sweep, 300);
  setTimeout(sweep, 1000);
  setTimeout(sweep, 2500);

  /* MutationObserver catches widgets injected after page load (OptinMonster etc.) */
  var observer = new MutationObserver(function(){
    sweep();
  });
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
  } else {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
})();
</script>
<!-- /wp:html -->
`;

const PRIVACY_CONTENT = LEGAL_PAGE_CSS + `
<!-- wp:heading {"level":1,"textAlign":"center"} -->
<h1 class="has-text-align-center">Privacy Policy</h1>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"center","className":"itc-page-meta"} -->
<p class="has-text-align-center itc-page-meta"><em>Last updated: January 2026</em></p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Your privacy is important to In The Circle. This policy explains how we collect, use, and protect your data.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>1. Information We Collect</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>We collect information you provide directly:</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>• Account information (name, email, profile photo)</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• Profile details (bio, skills, interests)</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• Content you create (posts, messages, comments)</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• Connected social media accounts</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>We automatically collect:</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>• Device information and identifiers</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• Usage data and analytics</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• Location data (with your permission)</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>2. How We Use Your Information</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>We use your information to:</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>• Provide and improve the App</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• Connect you with other creators</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• Send notifications and updates</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• Ensure safety and security</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• Comply with legal obligations</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>3. Information Sharing</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>We do not sell your personal information. We may share information:</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>• With other users as part of the App's features</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• With service providers who assist our operations</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• When required by law</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• With your consent</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>4. Data Security</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>We implement industry-standard security measures to protect your data, including encryption in transit and at rest. However, no method of transmission over the internet is 100% secure.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>5. Your Rights</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>You have the right to:</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>• Access your personal data</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• Correct inaccurate data</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• Delete your account and data</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• Export your data</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• Opt out of marketing communications</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>6. Data Retention</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>We retain your data as long as your account is active. When you delete your account, we will delete your personal data within 30 days, except where we are required to retain it for legal purposes.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>7. Children's Privacy</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>In The Circle is not intended for users under 18 years of age. We do not knowingly collect information from children under 18.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>8. Contact Us</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>For privacy-related questions, please contact our Data Protection Officer at <a href="mailto:privacy@inthecircle.co">privacy@inthecircle.co</a> or through the app settings.</p>
<!-- /wp:paragraph -->
`.trim();

const TERMS_CONTENT = LEGAL_PAGE_CSS + `
<!-- wp:heading {"level":1,"textAlign":"center"} -->
<h1 class="has-text-align-center">Terms of Service</h1>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"center","className":"itc-page-meta"} -->
<p class="has-text-align-center itc-page-meta"><em>Last updated: January 2026</em></p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Welcome to In The Circle. By using our app, you agree to these terms. If you do not agree, please do not use the App.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>1. Acceptance of Terms</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>By accessing and using In The Circle ("the App"), you agree to be bound by these Terms of Service.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>2. User Accounts</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>You must be at least 18 years old to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate and complete information when creating your account.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>3. User Content</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>You retain ownership of content you post on In The Circle. By posting content, you grant us a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content within the App. You agree not to post content that is illegal, harmful, threatening, abusive, or violates the rights of others.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>4. Prohibited Conduct</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>You agree not to:</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>• Use the App for any illegal purpose</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• Harass, abuse, or harm other users</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• Impersonate any person or entity</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• Post false or misleading information</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• Attempt to gain unauthorized access to the App</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• Use the App to spam or send unsolicited messages</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>• Violate any applicable laws or regulations</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>5. Intellectual Property</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>The App and its original content, features, and functionality are owned by In The Circle and are protected by international copyright, trademark, and other intellectual property laws.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>6. Termination</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>We reserve the right to terminate or suspend your account at any time, without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>7. Privacy</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Your privacy is important to us. Please review our <a href="https://inthecircle.co/privacy-policy/">Privacy Policy</a> for details on how we collect and use your data.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>8. Disclaimer</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>The App is provided "as is" without warranties of any kind. We do not guarantee that the App will be error-free, secure, or continuously available.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>9. Changes to Terms</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>We may update these terms periodically. Continued use of the app constitutes acceptance of updated terms.</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>10. Contact</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>For questions about these Terms, please contact us at <a href="mailto:legal@inthecircle.co">legal@inthecircle.co</a> or through the app.</p>
<!-- /wp:paragraph -->
`.trim();

// ─── WPCODE PHP SNIPPET: suppress subscribe widget on legal pages ─────────────
const SUBSCRIBE_SUPPRESS_PHP = `<?php
/**
 * Suppress subscribe/newsletter widgets on legal pages (privacy-policy, terms).
 * Runs early enough to remove content filters before they fire.
 */
add_action( 'wp', function () {
    if ( ! is_page( array( 'privacy-policy', 'terms' ) ) ) {
        return;
    }
    // Remove any known subscribe-widget content filters
    $hooks = array(
        'subscribe_reloaded_show',
        'wp_subscribe_content',
        'wp_sub_form',
        'sumo_subscribers_opt_in_form',
        'mailchimp_sf_subscribe_form',
        'mc4wp_form',
        'newsletter_form',
        'convertkit_form',
    );
    foreach ( $hooks as $hook ) {
        remove_all_filters( $hook );
    }

    // Broad safety net: strip any content filter that injects the subscribe prompt
    add_filter( 'the_content', function ( $content ) {
        return preg_replace(
            '/(<[^>]*>)?\\s*Thank you for reading this post[^<]*don[\'\\u2019]t forget to subscribe[^<]*(<\\/[^>]*>)?/i',
            '',
            $content
        );
    }, 999 );

    // Hide subscribe widget elements via inline CSS (catches widget-area and shortcode injections)
    add_action( 'wp_head', function () {
        echo '<style id="itc-no-subscribe-legal">
/* Hide subscribe widgets on Privacy Policy and Terms pages */
.wp-subscribe, .wp-subscribe-widget, #wp-subscribe,
.newsletter-widget, .newsletter_widget, .tnp-widget,
.mailchimp-subscribe, #mc_embed_signup,
.mc4wp-form, .convertkit-form, [class*="subscribe-form"],
[id*="subscribe"], .sumo-subscribe,
.wp-block-jetpack-subscriptions, .jetpack-subscribe,
.entry-content p:empty { display: none !important; }
</style>' . PHP_EOL;
    }, 1 );
}, 1 );
`;

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  loadEnv();
  const baseUrl = (process.env.WORDPRESS_URL || '').replace(/\/$/, '');
  const user = process.env.WORDPRESS_USER || 'admin';
  const appPassword = process.env.WORDPRESS_APP_PASSWORD || '';

  if (!baseUrl || !appPassword) {
    console.error('Missing credentials. Set WORDPRESS_URL, WORDPRESS_USER, WORDPRESS_APP_PASSWORD.');
    process.exit(1);
  }

  const auth = Buffer.from(`${user}:${appPassword}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };
  const apiBase = `${baseUrl}/wp-json/wp/v2`;

  // ── 1. Update page content ────────────────────────────────────────────────
  const pages = [
    { slug: 'privacy-policy', title: 'Privacy Policy – InTheCircle', content: PRIVACY_CONTENT },
    { slug: 'terms', title: 'Terms of Service – InTheCircle', content: TERMS_CONTENT },
  ];

  for (const page of pages) {
    try {
      const listRes = await fetch(`${apiBase}/pages?slug=${encodeURIComponent(page.slug)}&per_page=1`, { headers });
      const list = await listRes.json();
      const body = { title: page.title, content: page.content, status: 'publish', slug: page.slug };

      if (Array.isArray(list) && list.length > 0) {
        const id = list[0].id;
        const res = await fetch(`${apiBase}/pages/${id}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(await res.text());
        console.log(`✅ Updated page: ${page.slug} (ID ${id})`);
      } else {
        const res = await fetch(`${apiBase}/pages`, { method: 'POST', headers, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(await res.text());
        const created = await res.json();
        console.log(`✅ Created page: ${page.slug} (ID ${created.id})`);
      }
    } catch (err) {
      console.error(`❌ Failed ${page.slug}:`, err.message);
    }
  }

  // ── 2. Add WPCode snippet to suppress subscribe widget ────────────────────
  const snippetTitle = 'ITC: Hide subscribe widget on legal pages';
  const snippetBody = {
    title: snippetTitle,
    status: 'publish',
    content: SUBSCRIBE_SUPPRESS_PHP,
    meta: { wpcode_snippet_type: 'php', wpcode_snippet_status: 'active' },
  };

  try {
    // WPCode snippets are stored as post type 'wpcode'
    const listRes = await fetch(`${apiBase}/wpcode?search=${encodeURIComponent('ITC: Hide subscribe')}&per_page=5`, { headers });
    if (listRes.ok) {
      const list = await listRes.json();
      if (Array.isArray(list) && list.length > 0) {
        const id = list[0].id;
        const res = await fetch(`${apiBase}/wpcode/${id}`, { method: 'PATCH', headers, body: JSON.stringify(snippetBody) });
        if (!res.ok) throw new Error(await res.text());
        console.log(`✅ Updated WPCode snippet (ID ${id})`);
      } else {
        const res = await fetch(`${apiBase}/wpcode`, { method: 'POST', headers, body: JSON.stringify(snippetBody) });
        if (!res.ok) throw new Error(await res.text());
        const created = await res.json();
        console.log(`✅ Created WPCode snippet (ID ${created.id})`);
      }
    } else {
      throw new Error(`WPCode REST endpoint not available (${listRes.status})`);
    }
  } catch (err) {
    console.warn(`⚠️  WPCode snippet skipped: ${err.message}`);
    console.log('   → Trying fallback: WordPress custom CSS...');
    await addCustomCSS(apiBase, headers);
  }

  console.log('\nDone. Verify:');
  console.log('  ' + baseUrl + '/privacy-policy/');
  console.log('  ' + baseUrl + '/terms/');
}

// Fallback: add CSS via WordPress Custom CSS (post type: custom_css)
async function addCustomCSS(apiBase, headers) {
  const css = `
/* ITC: Hide subscribe widgets on Privacy Policy and Terms pages */
.page-privacy-policy .wp-subscribe,
.page-privacy-policy [class*="subscribe"],
.page-privacy-policy [id*="subscribe"],
.page-privacy-policy .mc4wp-form,
.page-privacy-policy .jetpack-subscribe,
.page-terms .wp-subscribe,
.page-terms [class*="subscribe"],
.page-terms [id*="subscribe"],
.page-terms .mc4wp-form,
.page-terms .jetpack-subscribe { display: none !important; }

/* Fix ul list order on all pages (theme may reverse flex) */
.entry-content ul,
.page-content ul,
.wp-block-list { display: block !important; flex-direction: unset !important; }
`.trim();

  try {
    // WordPress stores custom CSS as a custom post type 'custom_css' with name = active theme stylesheet
    const themeRes = await fetch(`${apiBase}/themes?status=active`, { headers });
    let stylesheet = 'twentytwentyfour';
    if (themeRes.ok) {
      const themes = await themeRes.json();
      if (Array.isArray(themes) && themes.length > 0) stylesheet = themes[0].stylesheet;
    }

    // Check if custom CSS post exists
    const existingRes = await fetch(`${apiBase}/custom_css`, { headers });
    if (!existingRes.ok) throw new Error('custom_css endpoint not available');

    const existing = await existingRes.json();
    const cssPost = Array.isArray(existing) ? existing.find(p => p.slug === stylesheet) : null;

    if (cssPost) {
      const existingCSS = cssPost.content?.raw || cssPost.content?.rendered || '';
      if (!existingCSS.includes('ITC: Hide subscribe widgets')) {
        const merged = existingCSS + '\n\n' + css;
        const res = await fetch(`${apiBase}/custom_css/${cssPost.id}`, {
          method: 'PATCH', headers, body: JSON.stringify({ content: merged }),
        });
        if (!res.ok) throw new Error(await res.text());
        console.log(`✅ Appended CSS to existing custom_css (ID ${cssPost.id})`);
      } else {
        console.log('   Custom CSS already includes subscribe suppression. Skipping.');
      }
    } else {
      const res = await fetch(`${apiBase}/custom_css`, {
        method: 'POST', headers, body: JSON.stringify({ title: stylesheet, slug: stylesheet, content: css, status: 'publish' }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      console.log(`✅ Created custom_css (ID ${created.id})`);
    }
  } catch (err) {
    console.error(`❌ Fallback CSS also failed: ${err.message}`);
    console.error('   Manual fix needed: WordPress Admin → Appearance → Customize → Additional CSS — paste the subscribe-suppression CSS.');
  }
}

main();

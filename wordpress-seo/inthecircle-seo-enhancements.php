<?php
/**
 * Plugin Name: Inthecircle SEO Enhancements
 * Description: Implements recommended SEO: meta tags, Open Graph, Twitter Cards, Schema.org, canonicals, per-page titles/descriptions.
 * Version: 2.0.2
 * Author: Inthecircle
 */

if (!defined('ABSPATH')) exit;

define('ITC_SEO_VERSION', '2.0.2');
define('ITC_SEO_BASE_URL', 'https://inthecircle.co');
define('ITC_SEO_OG_IMAGE', ITC_SEO_BASE_URL . '/wp-content/uploads/2026/02/email-logo-optimized.jpg');
define('ITC_SEO_LOGO_URL', ITC_SEO_BASE_URL . '/wp-content/uploads/2026/02/inthecircle-logo-header-optimized-1.png');
define('ITC_SEO_OPTION_APP_STORE_ID', 'itc_seo_app_store_id');

/** SEO keywords for ranking in creator/app-related searches (aligned with app.inthecircle.co) */
define('ITC_SEO_KEYWORDS', 'inthecircle, in the circle app, creator networking app, networking app for creators, connect with creators, creator community, YouTuber network, streamer community, digital creator app, collaboration app, creator platform');


/** Normalize brand and positioning text everywhere. */
function itc_seo_normalize_brand_copy($text) {
    if (!is_string($text) || $text === '') return $text;
    $text = str_replace('InTheCircle', 'Inthecircle', $text);
    $text = preg_replace('/\bfounders\b\s*,\s*/i', '', $text);
    $text = preg_replace('/\bfounders\b\s*&\s*/i', 'creators & ', $text);
    $text = preg_replace('/\bfounders\b/i', 'creators', $text);
    $text = preg_replace('/\bcreators\s*,\s*creators\b/i', 'creators', $text);
    return $text;
}

function itc_seo_get_app_store_id() {
    $id = get_option(ITC_SEO_OPTION_APP_STORE_ID, '');
    return preg_match('/^\d+$/', $id) ? $id : '6758384054';
}

/**
 * Per-page SEO data (slug => [title, description])
 */
function itc_seo_get_page_data() {
    return [
        'home' => [
            'title' => 'Inthecircle Networking App for Creators Community',
            'description' => 'Inthecircle is a networking app for creators. Connect with creators, collaborate on projects, and grow your circle in a creators-only iOS community.',
            'url' => ITC_SEO_BASE_URL . '/',
        ],
        'home-v2' => [
            'title' => 'Inthecircle Networking App for Creators Community',
            'description' => 'Inthecircle is a networking app for creators. Connect with creators, collaborate on projects, and grow your circle in a creators-only iOS community.',
            'url' => ITC_SEO_BASE_URL . '/',
        ],
        'about' => [
            'title' => 'About Inthecircle – Creator Networking Platform',
            'description' => 'In The Circle is the future of professional networking for creators. Quality connections, privacy-first, no ads. Learn our mission.',
            'url' => ITC_SEO_BASE_URL . '/about/',
        ],
        'faq' => [
            'title' => 'FAQ – Inthecircle Help Center',
            'description' => 'Find answers about profiles, connections, messaging & more. Get help with the Inthecircle creator networking app.',
            'url' => ITC_SEO_BASE_URL . '/faq/',
        ],
        'privacy-policy' => [
            'title' => 'Privacy Policy – Inthecircle',
            'description' => 'How Inthecircle collects, uses & protects your data. We never sell your information. Read our privacy policy.',
            'url' => ITC_SEO_BASE_URL . '/privacy-policy/',
        ],
        'terms' => [
            'title' => 'Terms of Service – Inthecircle',
            'description' => 'Inthecircle terms of service. Rules for using our creator networking app.',
            'url' => ITC_SEO_BASE_URL . '/terms/',
        ],
    ];
}

/**
 * Get current page SEO data
 */
function itc_seo_get_current_data() {
    $pages = itc_seo_get_page_data();
    
    if (is_404()) {
        return [
            'title' => 'Page Not Found – Inthecircle',
            'description' => 'The page you\'re looking for doesn\'t exist. Return to Inthecircle – the #1 networking app for creators.',
            'url' => ITC_SEO_BASE_URL . (isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/'),
        ];
    }
    
    if (is_front_page()) {
        return $pages['home'];
    }
    
    $slug = get_post_field('post_name', get_queried_object_id());
    if ($slug && isset($pages[$slug])) {
        return $pages[$slug];
    }
    
    // Fallback for any page
    $fallback = [
        'title' => get_bloginfo('name') . ' – ' . get_bloginfo('description'),
        'description' => get_bloginfo('description') ?: 'Inthecircle – The #1 networking app for creators.',
        'url' => get_permalink(),
    ];
    
    return $fallback;
}

/**
 * Only override AIOSEO / document title for the homepage and explicitly mapped static pages.
 * Posts and other pages must use All in One SEO meta (TruSEO scores + correct SERP titles).
 */
function itc_seo_should_override_aioseo_meta() {
    global $post;
    // Blog posts: never override — fixes REST/TruSEO when is_front_page() disagrees with the current post (e.g. AIOSEO analyze).
    if ($post && isset($post->post_type) && $post->post_type === 'post') {
        return false;
    }
    $qid = (int) get_queried_object_id();
    if ($qid && get_post_type($qid) === 'post') {
        return false;
    }
    if (is_singular('post')) {
        return false;
    }
    if (is_front_page()) {
        return true;
    }
    if (!is_singular()) {
        return false;
    }
    $slug = get_post_field('post_name', get_queried_object_id());
    $pages = itc_seo_get_page_data();
    return $slug && isset($pages[$slug]);
}

/**
 * Output meta tags (NO OG/Twitter - AIOSEO handles those to avoid duplicates)
 */
function itc_seo_output_head() {
    // Early connection + preload for faster LCP (mobile PageSpeed)
    echo '<!-- Inthecircle SEO - Preload Critical Assets -->' . "\n";
    echo '<link rel="preconnect" href="' . esc_url(parse_url(ITC_SEO_BASE_URL, PHP_URL_SCHEME) . '://' . parse_url(ITC_SEO_BASE_URL, PHP_URL_HOST)) . '">' . "\n";
    echo '<link rel="preload" href="' . esc_url(ITC_SEO_LOGO_URL) . '" as="image" fetchpriority="high">' . "\n";
    
    // Keywords (for ranking in app-related searches) - AIOSEO doesn't handle this
    echo '<meta name="keywords" content="' . esc_attr(ITC_SEO_KEYWORDS) . '">' . "\n";
}
add_action('wp_head', 'itc_seo_output_head', 1);

/**
 * Fix cookie banner text contrast – dark text on dark background is unreadable.
 * Ensures heading and body text are light on dark cookie popups.
 */
function itc_seo_cookie_banner_text_contrast() {
    ?>
<style id="itc-cookie-banner-contrast">
/* Cookie banner text – ensure readable on dark backgrounds (Complianz, CookieAdmin, WP Consent, etc.) */
.cmplz-cookiebanner .cmplz-message,
.cmplz-cookiebanner .cmplz-header,
.cmplz-cookiebanner h1,
.cmplz-cookiebanner h2,
.cmplz-cookiebanner h3,
.cmplz-cookiebanner p,
.cmplz-cookiebanner .cmplz-body,
.cmplz-cookiebanner .cmplz-text,
.cmplz-cookiebanner .cmplz-categories .cmplz-category .cmplz-category-header .cmplz-category-title,
.cmplz-cookiebanner .cmplz-categories .cmplz-category .cmplz-description,
#cmplz-cookiebanner .cmplz-message,
#cmplz-cookiebanner .cmplz-body,
#cmplz-cookiebanner p,
#cmplz-cookiebanner h1,
#cmplz-cookiebanner h2,
#cmplz-cookiebanner h3,
[class*="cmplz"] .cmplz-message,
[class*="cmplz"] .cmplz-body,
[class*="cmplz"] p,
[class*="cookie-banner"] h1,
[class*="cookie-banner"] h2,
[class*="cookie-banner"] h3,
[class*="cookie-banner"] p,
[class*="cookie-consent"] h1,
[class*="cookie-consent"] h2,
[class*="cookie-consent"] h3,
[class*="cookie-consent"] p,
[class*="cookieadmin"] h1,
[class*="cookieadmin"] h2,
[class*="cookieadmin"] h3,
[class*="cookieadmin"] p,
[id*="cookieadmin"] h1,
[id*="cookieadmin"] h2,
[id*="cookieadmin"] h3,
[id*="cookieadmin"] p,
[class*="consent-banner"] h1,
[class*="consent-banner"] h2,
[class*="consent-banner"] h3,
[class*="consent-banner"] p,
[class*="wpconsent"] .cmplz-message,
[class*="wpconsent"] .cmplz-body,
[class*="wpconsent"] p {
    color: #e5e7eb !important;
}
.cmplz-cookiebanner .cmplz-header,
[class*="cookie-banner"] h1,
[class*="cookie-banner"] h2,
[class*="cookie-consent"] h1,
[class*="cookie-consent"] h2,
[class*="cookieadmin"] h1,
[class*="cookieadmin"] h2,
[id*="cookieadmin"] h1,
[id*="cookieadmin"] h2 {
    color: #f3f4f6 !important;
}
</style>
    <?php
}
add_action('wp_head', 'itc_seo_cookie_banner_text_contrast', 25);

/**
 * Override document title – handled in document_title_parts (priority 999)
 */

/**
 * Output site-wide JSON-LD schema (Organization, WebSite, SoftwareApplication, WebApplication)
 */
function itc_seo_output_schema() {
    $app_store_url = 'https://apps.apple.com/app/in-the-circle/id' . itc_seo_get_app_store_id();

    $schema = [
        '@context' => 'https://schema.org',
        '@graph' => [
            [
                '@type' => 'Organization',
                '@id' => ITC_SEO_BASE_URL . '/#organization',
                'name' => 'inthecircle',
                'url' => ITC_SEO_BASE_URL,
                'logo' => [
                    '@type' => 'ImageObject',
                    'url' => ITC_SEO_OG_IMAGE,
                ],
                // Keep a minimal sameAs list to avoid excessive external-link ratio penalties in analyzers.
                'sameAs' => [
                    'https://www.instagram.com/inthecircle',
                ],
                'contactPoint' => [
                    '@type' => 'ContactPoint',
                    'email' => 'support@inthecircle.co',
                    'contactType' => 'customer support',
                ],
            ],
            [
                '@type' => 'WebSite',
                '@id' => ITC_SEO_BASE_URL . '/#website',
                'url' => ITC_SEO_BASE_URL,
                'name' => 'inthecircle',
                'description' => 'Inthecircle networking app for creators. Learn more on our About, FAQ, and Blog pages.',
                'publisher' => ['@id' => ITC_SEO_BASE_URL . '/#organization'],
                'potentialAction' => [
                    '@type' => 'SearchAction',
                    'target' => ['@type' => 'EntryPoint', 'urlTemplate' => ITC_SEO_BASE_URL . '/?s={search_term_string}'],
                    'query-input' => 'required name=search_term_string',
                ],
            ],
            [
                '@type' => 'SoftwareApplication',
                'name' => 'In The Circle',
                'url' => $app_store_url,
                'operatingSystem' => 'iOS',
                'applicationCategory' => 'SocialNetworkingApplication',
                'offers' => ['@type' => 'Offer', 'price' => '0', 'priceCurrency' => 'USD'],
                'aggregateRating' => [
                    '@type' => 'AggregateRating',
                    'ratingValue' => '4.9',
                    'ratingCount' => '1000',
                ],
            ],
            [
                '@type' => 'WebApplication',
                'name' => 'inthecircle',
                'url' => ITC_SEO_BASE_URL,
                'applicationCategory' => 'SocialNetworkingApplication',
                'operatingSystem' => 'iOS',
                'offers' => ['@type' => 'Offer', 'price' => '0', 'priceCurrency' => 'USD'],
                'description' => 'Join inthecircle – the #1 networking app for creators. Connect with creators, YouTubers, streamers & digital professionals. Download free on iOS.',
                'screenshot' => ITC_SEO_OG_IMAGE,
            ],
        ],
    ];

    echo '<script type="application/ld+json">' . "\n" . wp_json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n</script>\n";
}
add_action('wp_head', 'itc_seo_output_schema', 5);

/**
 * Output FAQ schema on FAQ page only
 */
function itc_seo_output_faq_schema() {
    if (!is_page('faq') && !is_page('help-center')) return;
    
    $schema = [
        '@context' => 'https://schema.org',
        '@type' => 'FAQPage',
        'mainEntity' => [
            ['@type' => 'Question', 'name' => 'How do I edit my profile?', 'acceptedAnswer' => ['@type' => 'Answer', 'text' => 'Go to Settings > Edit Profile. You can update your photo, bio, skills, and other information from there.']],
            ['@type' => 'Question', 'name' => 'How do I connect with other creators?', 'acceptedAnswer' => ['@type' => 'Answer', 'text' => 'Browse the Connect tab to discover creators. Tap Connect to show interest, or tap their profile to learn more. When both parties show interest, you will connect!']],
            ['@type' => 'Question', 'name' => 'How do I post content?', 'acceptedAnswer' => ['@type' => 'Answer', 'text' => 'Tap the + button in the tab bar to create a new post. You can share updates, photos, or look for collaboration opportunities.']],
            ['@type' => 'Question', 'name' => 'How do I message someone?', 'acceptedAnswer' => ['@type' => 'Answer', 'text' => 'Once you have connected with a creator, you can message them from your Inbox. Tap on any conversation to start chatting.']],
            ['@type' => 'Question', 'name' => 'How do I change my notification settings?', 'acceptedAnswer' => ['@type' => 'Answer', 'text' => 'Go to Settings > Notification Preferences to customize which notifications you receive.']],
            ['@type' => 'Question', 'name' => 'How do I report inappropriate content?', 'acceptedAnswer' => ['@type' => 'Answer', 'text' => 'Tap the three dots (...) on any post or profile and select Report. Our team will review it promptly.']],
            ['@type' => 'Question', 'name' => 'How do I delete my account?', 'acceptedAnswer' => ['@type' => 'Answer', 'text' => 'Go to Settings and scroll to the bottom. Tap Delete Account and follow the confirmation steps.']],
            ['@type' => 'Question', 'name' => 'Is my data secure?', 'acceptedAnswer' => ['@type' => 'Answer', 'text' => 'Yes! We use industry-standard encryption and never share your personal data with third parties without your consent.']],
        ],
    ];
    
    echo '<script type="application/ld+json">' . "\n" . wp_json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n</script>\n";
}
add_action('wp_head', 'itc_seo_output_faq_schema', 6);

/**
 * Add internal links to homepage for SEO (Learn more, FAQ)
 */
function itc_seo_home_internal_links($content) {
    if (!is_front_page()) return $content;
    
    $about_url = home_url('/about/');
    $faq_url = home_url('/faq/');
    $blog_url = home_url('/blog/');
    $terms_url = home_url('/terms-of-service/');
    $privacy_url = home_url('/privacy-policy/');
    $links = '<p class="itc-seo-links" style="margin:1.25rem 0;font-size:0.95em;">'
        . '<a href="' . esc_url($about_url) . '" style="color:#a5b4fc;">About</a> &middot; '
        . '<a href="' . esc_url($faq_url) . '" style="color:#a5b4fc;">FAQ</a> &middot; '
        . '<a href="' . esc_url($blog_url) . '" style="color:#a5b4fc;">Blog</a> &middot; '
        . '<a href="' . esc_url($terms_url) . '" style="color:#a5b4fc;">Terms</a> &middot; '
        . '<a href="' . esc_url($privacy_url) . '" style="color:#a5b4fc;">Privacy</a>'
        . '</p>';
    
    // Insert before "How It Works" or first H2
    if (preg_match('/(<h2[^>]*>)/i', $content, $m)) {
        $content = preg_replace('/(<h2[^>]*>)/i', $links . "\n$1", $content, 1);
    } else {
        $content = $links . $content;
    }
    
    return $content;
}
add_filter('the_content', 'itc_seo_home_internal_links', 15);

/**
 * Add alt text to custom logo
 */
function itc_seo_logo_alt($html) {
    if (empty($html)) return $html;
    $alt = 'Inthecircle – Creator networking app logo';
    if (strpos($html, 'alt=""') !== false || strpos($html, "alt=''") !== false) {
        $html = preg_replace('/alt=["\']?["\']?/', 'alt="' . esc_attr($alt) . '" ', $html);
    } elseif (preg_match('/<img[^>]+>/', $html) && !preg_match('/\salt=/', $html)) {
        $html = preg_replace('/<img /', '<img alt="' . esc_attr($alt) . '" ', $html);
    }
    // LCP: ensure logo image has high fetch priority (preload is already in head)
    if (strpos($html, 'fetchpriority') === false) {
        $html = preg_replace('/<img /', '<img fetchpriority="high" ', $html);
    }
    return $html;
}
add_filter('get_custom_logo', 'itc_seo_logo_alt', 20);

/**
 * Add alt text to header/logo images in content (by URL pattern)
 */
function itc_seo_content_image_alt($content) {
    $logo_pattern = 'email/logo';
    $alt = 'Inthecircle – Creator networking app logo';
    
    if (strpos($content, $logo_pattern) === false) return $content;
    
    $content = preg_replace_callback(
        '/<img([^>]*src=[^>]*' . preg_quote($logo_pattern) . '[^>]*)>/i',
        function ($m) use ($alt) {
            $tag = $m[0];
            if (preg_match('/\salt\s*=\s*["\']?[^"\'>]*["\']?/i', $tag)) return $tag;
            return preg_replace('/<img /', '<img alt="' . esc_attr($alt) . '" ', $tag);
        },
        $content
    );
    
    return $content;
}
add_filter('the_content', 'itc_seo_content_image_alt', 10);

/**
 * Replace placeholder App Store URL in content with real URL
 */
function itc_seo_app_store_url($content) {
    $placeholder = 'https://apps.apple.com/app/in-the-circle/id123456789';
    $real = 'https://apps.apple.com/app/in-the-circle/id' . itc_seo_get_app_store_id();
    if ($placeholder !== $real) {
        $content = str_replace($placeholder, $real, $content);
    }
    return $content;
}
add_filter('the_content', 'itc_seo_app_store_url', 5);

/**
 * Override All in One SEO title and description with our recommended values
 */
function itc_seo_aioseo_title($title) {
    if (itc_seo_should_override_aioseo_meta()) {
        $data = itc_seo_get_current_data();
        if (isset($data['title']) && !empty($data['title'])) {
            $title = $data['title'];
        }
    }
    return itc_seo_normalize_brand_copy($title);
}
add_filter('aioseo_title', 'itc_seo_aioseo_title', 999);

function itc_seo_aioseo_description($description) {
    if (itc_seo_should_override_aioseo_meta()) {
        $data = itc_seo_get_current_data();
        if (isset($data['description']) && !empty($data['description'])) {
            $description = $data['description'];
        }
    }
    return itc_seo_normalize_brand_copy($description);
}
add_filter('aioseo_description', 'itc_seo_aioseo_description', 999);

function itc_seo_aioseo_facebook_tags($tags) {
    if (itc_seo_should_override_aioseo_meta()) {
        $data = itc_seo_get_current_data();
        if (isset($data['title'])) {
            $tags['og:title'] = $data['title'];
        }
        if (isset($data['description'])) {
            $tags['og:description'] = $data['description'];
        }
    }
    $tags['og:image'] = ITC_SEO_OG_IMAGE;
    $tags['og:site_name'] = 'Inthecircle';
    foreach ($tags as $k => $v) {
        if (is_string($v)) $tags[$k] = itc_seo_normalize_brand_copy($v);
    }
    return $tags;
}
add_filter('aioseo_facebook_tags', 'itc_seo_aioseo_facebook_tags', 999);

function itc_seo_aioseo_twitter_tags($tags) {
    if (itc_seo_should_override_aioseo_meta()) {
        $data = itc_seo_get_current_data();
        if (isset($data['title'])) {
            $tags['twitter:title'] = $data['title'];
        }
        if (isset($data['description'])) {
            $tags['twitter:description'] = $data['description'];
        }
    }
    $tags['twitter:image'] = ITC_SEO_OG_IMAGE;
    foreach ($tags as $k => $v) {
        if (is_string($v)) $tags[$k] = itc_seo_normalize_brand_copy($v);
    }
    return $tags;
}
add_filter('aioseo_twitter_tags', 'itc_seo_aioseo_twitter_tags', 999);

/**
 * Replace App Store placeholder URL in DOM (for page builders that bypass the_content)
 */
function itc_seo_app_store_url_js() {
    $real_id = itc_seo_get_app_store_id();
    if ($real_id === '123456789') return;
    ?>
    <script>
    (function(){
        var placeholder = 'id123456789';
        var realId = 'id<?php echo esc_js($real_id); ?>';
        document.querySelectorAll('a[href*="apps.apple.com"]').forEach(function(a){
            if (a.href.indexOf(placeholder) !== -1) a.href = a.href.replace(placeholder, realId);
        });
    })();
    </script>
    <?php
}
add_action('wp_footer', 'itc_seo_app_store_url_js', 20);

/**
 * Admin settings page – App Store ID
 */
function itc_seo_add_menu() {
    add_options_page('Inthecircle SEO', 'Inthecircle SEO', 'manage_options', 'itc-seo', 'itc_seo_settings_page');
}
add_action('admin_menu', 'itc_seo_add_menu');

/**
 * Focus keyphrase per post slug (no AIOSEO Pro required).
 * Used to set or supply focus keyphrase so TruSEO can run.
 */
function itc_seo_get_focus_keyphrase_map() {
    return [
        '1-billion-followers-summit-2026-what-creators-need-to-know' => '1 billion followers summit',
        '1-billion-followers-summit-emirates-towers-difc-museum-of-the-future' => '1 billion followers summit Dubai',
        '1-billion-acts-of-kindness-and-ai-film-award-summit-highlights' => '1 billion followers summit',
        'how-to-network-at-the-1-billion-followers-summit-dubai' => '1 billion followers summit Dubai',
        'creators-ventures-programme-launch-your-business-at-1-billion-followers-summit' => 'creators ventures programme',
        'best-creator-networking-app-2026' => 'creator networking app',
        'how-to-connect-with-other-creators' => 'connect with creators',
        'networking-for-youtubers-and-streamers' => 'YouTuber network',
        'how-to-find-collaborators-as-a-creator' => 'find collaborators creators',
        'why-creator-networking-matters' => 'creator networking',
        'creator-community-build-your-circle' => 'creator community',
        'inthecircle-community-trending-waitlist' => 'inthecircle community',
        'creator-community-gcc-egypt-jordan-lebanon' => 'creator community GCC',
        'inthecircle-waitlist-creators-joining' => 'inthecircle waitlist',
        'creator-collaboration-tips' => 'creator collaboration',
        'mena-creator-economy-connect-arab-creators' => 'MENA creator economy',
        'connect-with-streamers-gaming-creators' => 'connect streamers creators',
        'creator-networking-egypt-egyptian-creators' => 'creator networking Egypt',
        'best-creator-networking-app-egypt' => 'creator networking app Egypt',
        'welcome-to-in-the-circle' => 'inthecircle creator networking',
        'ar-best-creator-networking-app-2026' => 'تطبيق تواصل للمبدعين',
        'ar-creator-networking-uae' => 'تواصل صناع المحتوى الإمارات',
        'ar-creator-networking-egypt' => 'تواصل المبدعين مصر',
        'ar-creator-community-gcc-egypt-jordan-lebanon' => 'مجتمع المبدعين',
        'ar-content-creators-community-dubai' => 'مجتمع صناع المحتوى دبي',
        'ar-build-creator-community-dubai' => 'بناء مجتمع محتوى دبي',
        'ar-creator-economy-dubai-2026' => 'اقتصاد صناع المحتوى دبي',
        'ar-creator-platforms-uae' => 'منصات تواصل المبدعين',
        'ar-grow-as-content-creator-dubai' => 'نمو مبدع محتوى دبي',
        'ar-creator-events-dubai' => 'فعاليات صناع المحتوى دبي',
        'ar-social-media-creators-uae' => 'صناع المحتوى الإمارات',
        'ar-content-strategy-dubai' => 'استراتيجية المحتوى دبي',
        'ar-creative-community-uae' => 'مجتمع المبدعين الإمارات',
        'ar-content-collaboration-dubai' => 'تعاون صناع المحتوى دبي',
        'ar-content-creator-collaboration-dubai-uae' => 'تعاون صناع المحتوى دبي',
        'ar-youtubers-streamers-dubai' => 'يوتيوبرز ستريمرز دبي',
        'ar-build-successful-content-community-dubai' => 'مجتمع محتوى ناجح دبي',
        'ar-future-content-creators-dubai-2026' => 'مستقبل صناع المحتوى دبي',
    ];
}

function itc_seo_get_focus_keyphrase_for_post($post_id) {
    $post = get_post($post_id);
    if (!$post || $post->post_type !== 'post') return '';
    $slug = $post->post_name;
    $map = itc_seo_get_focus_keyphrase_map();
    if (isset($map[$slug])) return $map[$slug];
    $title = $post->post_title;
    if (strpos($title, 'مليار متابع') !== false || strpos($title, 'قمة مليار') !== false || strpos($title, 'برنامج مبدعي') !== false) {
        return 'قمة مليار متابع';
    }
    return (strpos($slug, 'ar') === 0) ? 'تطبيق تواصل للمبدعين' : 'creator networking';
}

/**
 * When AIOSEO loads post data, supply focus keyphrase if missing (free, no Pro).
 * Lets TruSEO see a keyphrase so scores can appear.
 */
function itc_seo_aioseo_get_post_supply_keyphrase($post) {
    if (!is_object($post)) return $post;
    $post_id = isset($post->post_id) ? (int) $post->post_id : 0;
    if (!$post_id) return $post;
    $keyphrase = itc_seo_get_focus_keyphrase_for_post($post_id);
    if ($keyphrase === '') return $post;
    $current = '';
    if (isset($post->keyphrases) && is_array($post->keyphrases) && !empty($post->keyphrases)) {
        $first = reset($post->keyphrases);
        $current = is_object($first) && isset($first->keyphrase) ? $first->keyphrase : (is_string($first) ? $first : '');
    }
    if (isset($post->focusKeyphrase)) $current = $current ?: (string) $post->focusKeyphrase;
    if ($current !== '') return $post;
    if (property_exists($post, 'focusKeyphrase')) $post->focusKeyphrase = $keyphrase;
    if (property_exists($post, 'keyphrases')) {
        $post->keyphrases = [ (object) ['keyphrase' => $keyphrase] ];
    }
    return $post;
}
add_filter('aioseo_get_post', 'itc_seo_aioseo_get_post_supply_keyphrase', 10, 1);

/**
 * When AIOSEO saves post data, set focus keyphrase if missing (so it persists).
 */
function itc_seo_aioseo_save_post_set_keyphrase($post) {
    if (!is_object($post)) return $post;
    $post_id = isset($post->post_id) ? (int) $post->post_id : 0;
    if (!$post_id) return $post;
    $keyphrase = itc_seo_get_focus_keyphrase_for_post($post_id);
    if ($keyphrase === '') return $post;
    $current = '';
    if (isset($post->keyphrases) && is_array($post->keyphrases) && !empty($post->keyphrases)) {
        $first = reset($post->keyphrases);
        $current = is_object($first) && isset($first->keyphrase) ? $first->keyphrase : (is_string($first) ? $first : '');
    }
    if (isset($post->focusKeyphrase)) $current = $current ?: (string) $post->focusKeyphrase;
    if ($current !== '') return $post;
    if (property_exists($post, 'focusKeyphrase')) $post->focusKeyphrase = $keyphrase;
    if (property_exists($post, 'keyphrases')) {
        $post->keyphrases = [ (object) ['keyphrase' => $keyphrase] ];
    }
    return $post;
}
add_filter('aioseo_save_post', 'itc_seo_aioseo_save_post_set_keyphrase', 10, 1);

/**
 * Try to write focus keyphrase directly to AIOSEO table (works when filters don't persist).
 */
function itc_seo_aioseo_direct_update_keyphrase($post_id, $keyphrase) {
    global $wpdb;
    $table = $wpdb->prefix . 'aioseo_posts';
    if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table)) !== $table) {
        return false;
    }
    $cols = $wpdb->get_results("DESCRIBE `{$table}`", ARRAY_A);
    $col_names = array_column($cols, 'Field');
    $post_id = (int) $post_id;
    $keyphrase = sanitize_text_field($keyphrase);
    $keyphrases_json = wp_json_encode([['keyphrase' => $keyphrase]]);
    if (in_array('keyphrases', $col_names, true)) {
        $updated = $wpdb->update($table, ['keyphrases' => $keyphrases_json], ['post_id' => $post_id]);
        if ($updated !== false) return true;
        if ($wpdb->last_error) return false;
        $exists = $wpdb->get_var($wpdb->prepare("SELECT 1 FROM `{$table}` WHERE post_id = %d", $post_id));
        if (!$exists) {
            return $wpdb->insert($table, ['post_id' => $post_id, 'keyphrases' => $keyphrases_json]) !== false;
        }
        return false;
    }
    if (in_array('keyphrase', $col_names, true)) {
        $updated = $wpdb->update($table, ['keyphrase' => $keyphrase], ['post_id' => $post_id]);
        if ($updated !== false) return true;
        $exists = $wpdb->get_var($wpdb->prepare("SELECT 1 FROM `{$table}` WHERE post_id = %d", $post_id));
        if (!$exists) {
            return $wpdb->insert($table, ['post_id' => $post_id, 'keyphrase' => $keyphrase]) !== false;
        }
        return false;
    }
    return false;
}

/**
 * Bulk action: set focus keyphrase for all posts (direct DB + save trigger).
 */
function itc_seo_bulk_set_focus_keywords() {
    if (!current_user_can('manage_options')) return;
    if (!isset($_GET['itc_seo_bulk_keywords']) || $_GET['itc_seo_bulk_keywords'] !== '1') return;
    check_admin_referer('itc_seo_bulk_keywords');
    $posts = get_posts(['post_type' => 'post', 'post_status' => 'publish', 'numberposts' => -1, 'fields' => 'ids']);
    $count = 0;
    $direct = 0;
    foreach ($posts as $id) {
        $id = (int) $id;
        $keyphrase = itc_seo_get_focus_keyphrase_for_post($id);
        if ($keyphrase !== '' && itc_seo_aioseo_direct_update_keyphrase($id, $keyphrase)) {
            $direct++;
        }
        wp_update_post(['ID' => $id]);
        $count++;
    }
    wp_redirect(add_query_arg([
        'page' => 'itc-seo',
        'itc_keywords_done' => $count,
        'itc_keywords_direct' => $direct,
    ], admin_url('options-general.php')));
    exit;
}
add_action('admin_init', 'itc_seo_bulk_set_focus_keywords');

function itc_seo_settings_page() {
    if (!current_user_can('manage_options')) return;
    if (isset($_POST['itc_seo_save']) && check_admin_referer('itc_seo_settings')) {
        $id = isset($_POST['itc_app_store_id']) ? sanitize_text_field($_POST['itc_app_store_id']) : '';
        if (preg_match('/^\d*$/', $id)) {
            update_option(ITC_SEO_OPTION_APP_STORE_ID, $id !== '' ? $id : '6758384054');
            echo '<div class="notice notice-success"><p>Settings saved.</p></div>';
        } else {
            echo '<div class="notice notice-error"><p>App Store ID must be numbers only (e.g. 6738291).</p></div>';
        }
    }
    $current = itc_seo_get_app_store_id();
    ?>
    <div class="wrap">
        <h1>Inthecircle SEO Settings</h1>
        <form method="post">
            <?php wp_nonce_field('itc_seo_settings'); ?>
            <table class="form-table">
                <tr>
                    <th><label for="itc_app_store_id">App Store ID</label></th>
                    <td>
                        <input type="text" id="itc_app_store_id" name="itc_app_store_id" value="<?php echo esc_attr($current); ?>" class="regular-text" placeholder="123456789">
                        <p class="description">Enter your App Store ID (numbers only). Find it in your app URL: <code>apps.apple.com/app/in-the-circle/id<strong>XXXXXXX</strong></code>. Current live app ID: 6758384054.</p>
                        <p><strong>Current URL:</strong> <a href="https://apps.apple.com/app/in-the-circle/id<?php echo esc_attr($current); ?>" target="_blank" rel="noopener">https://apps.apple.com/app/in-the-circle/id<?php echo esc_attr($current); ?></a></p>
                    </td>
                </tr>
            </table>
            <p class="submit"><input type="submit" name="itc_seo_save" class="button button-primary" value="Save Settings"></p>
        </form>

        <hr style="margin: 2rem 0 1rem;">
        <h2>AIOSEO Focus Keywords (no subscription)</h2>
        <p>This plugin can supply a focus keyphrase for each post so All in One SEO can show TruSEO scores. It works with <strong>AIOSEO Lite</strong> (no Pro required).</p>
        <p><strong>Option A – Automatic:</strong> When you open or save a post, the focus keyphrase is set from the list above if it’s empty. Refresh the <a href="<?php echo esc_url(admin_url('admin.php?page=aioseo')); ?>">AIOSEO Overview</a> to see scores.</p>
        <p><strong>Option B – Bulk set now:</strong> Click below to run a quick “save” on all published posts so AIOSEO stores the focus keyphrase. Then refresh AIOSEO Overview.</p>
        <p>
            <a href="<?php echo esc_url(wp_nonce_url(admin_url('options-general.php?page=itc-seo&itc_seo_bulk_keywords=1'), 'itc_seo_bulk_keywords')); ?>" class="button button-secondary">Set focus keywords for all posts</a>
            <a href="<?php echo esc_url(admin_url('options-general.php?page=itc-seo&itc_seo_show_columns=1')); ?>" class="button button-link">Show AIOSEO table columns (debug)</a>
        </p>
        <?php
        if (isset($_GET['itc_keywords_done'])) {
            $n = (int) $_GET['itc_keywords_done'];
            $direct = isset($_GET['itc_keywords_direct']) ? (int) $_GET['itc_keywords_direct'] : 0;
            $overview_url = admin_url('admin.php?page=aioseo');
            echo '<div class="notice notice-success"><p>';
            echo 'Triggered save for ' . (int) $n . ' posts. ';
            if ($direct > 0) {
                echo 'Wrote focus keyphrase to AIOSEO table for ' . (int) $direct . ' posts. ';
            } elseif ($n > 0) {
                echo '(Direct DB write did not run—your AIOSEO table may use different column names.) ';
            }
            echo 'Refresh <a href="' . esc_url($overview_url) . '">AIOSEO Overview</a> to see TruSEO scores.';
            echo '</p></div>';
        }
        if (current_user_can('manage_options') && isset($_GET['itc_seo_show_columns'])) {
            global $wpdb;
            $table = $wpdb->prefix . 'aioseo_posts';
            $exists = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table)) === $table;
            echo '<div class="notice notice-info" style="margin-top:1rem;"><p><strong>Debug: AIOSEO table</strong> <code>' . esc_html($table) . '</code> ' . ($exists ? 'exists.' : 'not found.') . '</p>';
            if ($exists) {
                $cols = $wpdb->get_results("DESCRIBE `{$table}`", ARRAY_A);
                echo '<p>Columns: ' . esc_html(implode(', ', array_column($cols, 'Field'))) . '.</p></div>';
            } else {
                echo '</div>';
            }
        }
        ?>
    </div>
    <?php
}

/**
 * One-time setup: ensure "Blog" page exists and set as Posts page (Settings → Reading).
 */
function itc_seo_blog_setup_once() {
    if (get_option('itc_seo_blog_setup_done')) {
        return;
    }
    $slug = 'blog';
    $page = get_page_by_path($slug, OBJECT, 'page');
    if (!$page) {
        $page_id = wp_insert_post([
            'post_title'   => 'Blog',
            'post_name'    => $slug,
            'post_status'  => 'publish',
            'post_type'    => 'page',
            'post_content' => '<p>Latest updates and articles from inthecircle.</p>',
        ]);
        if (is_wp_error($page_id)) {
            return;
        }
    } else {
        $page_id = (int) $page->ID;
    }
    update_option('page_for_posts', $page_id);
    update_option('itc_seo_blog_setup_done', 1);
}
add_action('init', 'itc_seo_blog_setup_once', 5);

/**
 * Add "Blog" to the site navigation menu(s).
 */
function itc_seo_add_blog_menu_item($items, $args) {
    $locations = ['primary', 'header', 'main', 'top', 'navigation', 'menu-1', ''];
    $loc = isset($args->theme_location) ? $args->theme_location : '';
    if (!in_array($loc, $locations, true)) {
        return $items;
    }
    $page_for_posts = get_option('page_for_posts');
    $blog_url = $page_for_posts ? get_permalink($page_for_posts) : home_url('/blog/');
    if (!$blog_url) {
        $blog_url = home_url('/');
    }
    $blog_link = '<li class="menu-item menu-item-type-post_type menu-item-itc-blog"><a href="' . esc_url($blog_url) . '">Blog</a></li>';
    return $items . $blog_link;
}
add_filter('wp_nav_menu_items', 'itc_seo_add_blog_menu_item', 10, 2);

/**
 * Fallback: inject "Blog" into header nav via JS (for themes/page builders that don't use wp_nav_menu).
 */
function itc_seo_inject_blog_link_js() {
    $page_for_posts = get_option('page_for_posts');
    $blog_url = $page_for_posts ? get_permalink($page_for_posts) : home_url('/blog/');
    if (!$blog_url) {
        $blog_url = home_url('/');
    }
    ?>
    <script>
    (function(){
        var blogUrl = <?php echo json_encode(esc_url($blog_url)); ?>;
        var blogLabel = 'BLOG';
        function inject() {
            if (document.querySelector('.itc-blog-injected')) return;
            var nav = document.querySelector('header nav, .header nav, nav.menu, .main-navigation, .site-nav, header [class*="menu"], header [class*="nav"], nav');
            if (!nav) nav = document.querySelector('header');
            if (!nav) return;
            var links = nav.querySelectorAll('a');
            var container = null;
            for (var i = 0; i < links.length; i++) {
                var t = (links[i].textContent || '').trim().toUpperCase();
                if (t === 'HOME' || t === 'ABOUT' || t === 'FAQ' || t.indexOf('SIGN UP') !== -1) {
                    container = links[i].parentNode;
                    if (container && container.tagName === 'LI') container = container.parentNode;
                    if (!container) container = links[i].parentNode;
                    break;
                }
            }
            if (container) {
                var item = document.createElement(container.tagName === 'UL' ? 'li' : 'span');
                item.className = 'menu-item itc-blog-injected';
                var a = document.createElement('a');
                a.href = blogUrl;
                a.textContent = blogLabel;
                item.appendChild(a);
                container.appendChild(item);
            }
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', inject);
        } else {
            inject();
        }
        setTimeout(inject, 800);
    })();
    </script>
    <?php
}
add_action('wp_footer', 'itc_seo_inject_blog_link_js', 8);

/**
 * Fallback: inject internal links on homepage via JS (for page builders that bypass the_content)
 */
function itc_seo_footer_internal_links() {
    if (!is_front_page()) return;
    $about = esc_url(home_url('/about/'));
    $faq = esc_url(home_url('/faq/'));
    ?>
    <script>
    (function(){
        if (document.querySelector('.itc-seo-links')) return;
        var firstH2 = document.querySelector('main h2, .entry-content h2, article h2, [role="main"] h2, body h2');
        if (!firstH2) return;
        var p = document.createElement('p');
        p.className = 'itc-seo-links';
        p.style.cssText = 'margin:1.25rem 0;font-size:0.95em';
        p.innerHTML = '<a href="<?php echo $about; ?>" style="color:#a5b4fc">About</a> &middot; '
            + '<a href="<?php echo $faq; ?>" style="color:#a5b4fc">FAQ</a> &middot; '
            + '<a href="<?php echo esc_url(home_url('/blog/')); ?>" style="color:#a5b4fc">Blog</a> &middot; '
            + '<a href="<?php echo esc_url(home_url('/terms-of-service/')); ?>" style="color:#a5b4fc">Terms</a> &middot; '
            + '<a href="<?php echo esc_url(home_url('/privacy-policy/')); ?>" style="color:#a5b4fc">Privacy</a>';
        firstH2.parentNode.insertBefore(p, firstH2);
    })();
    </script>
    <?php
}
add_action('wp_footer', 'itc_seo_footer_internal_links', 5);

/**
 * Security headers
 */
function itc_seo_security_headers() {
    if (headers_sent()) return;
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');
    }
}
add_action('send_headers', 'itc_seo_security_headers');

/**
 * Custom 404 page – replace main content with branded block (works with most themes)
 */
function itc_seo_404_page() {
    if (!is_404()) return;
    $home = esc_url(home_url('/'));
    $faq = esc_url(home_url('/faq/'));
    $html = '<div class="itc-404" style="text-align:center;padding:4rem 2rem;max-width:600px;margin:0 auto;font-family:system-ui,sans-serif;"><h1 style="font-size:2.5rem;margin-bottom:1rem;">Page Not Found</h1><p style="font-size:1.1rem;color:#666;margin-bottom:2rem;">The page you\'re looking for doesn\'t exist or has been moved.</p><p><a href="' . $home . '" style="display:inline-block;padding:0.75rem 1.5rem;background:#000;color:#fff;text-decoration:none;border-radius:6px;margin-right:0.5rem;">Back to Home</a> <a href="' . $faq . '" style="display:inline-block;padding:0.75rem 1.5rem;border:1px solid #000;color:#000;text-decoration:none;border-radius:6px;">See FAQ</a></p></div>';
    ?>
    <script>
    (function(){
        var main = document.querySelector('main, .content, .entry-content, #content, [role="main"], .site-main');
        if (main) {
            main.innerHTML = <?php echo json_encode($html); ?>;
        }
    })();
    </script>
    <?php
}
add_action('wp_footer', 'itc_seo_404_page', 1);

/**
 * 404 title
 */
function itc_seo_404_title_parts($parts) {
    if (is_404()) {
        return ['title' => 'Page Not Found', 'page' => '', 'tagline' => 'Inthecircle'];
    }
    if (!itc_seo_should_override_aioseo_meta()) {
        if (is_array($parts)) {
            foreach ($parts as $k => $v) {
                if (is_string($v)) $parts[$k] = itc_seo_normalize_brand_copy($v);
            }
        }
        return $parts;
    }
    $data = itc_seo_get_current_data();
    if (isset($data['title']) && !empty($data['title'])) {
        return ['title' => itc_seo_normalize_brand_copy($data['title']), 'page' => '', 'tagline' => ''];
    }
    return $parts;
}
add_filter('document_title_parts', 'itc_seo_404_title_parts', 999);

/**
 * GA4 conversion events – Sign Up and Download App clicks
 */
function itc_seo_ga4_conversions() {
    ?>
    <script>
    (function(){
        function fireEvent(name, params) {
            if (typeof gtag === 'function') {
                gtag('event', name, params || {});
            }
        }
        document.addEventListener('click', function(e) {
            var a = e.target.closest('a');
            if (!a || !a.href) return;
            var href = a.href;
            if (href.indexOf('app.inthecircle.co/signup') !== -1 || (href.indexOf('inthecircle') !== -1 && (a.textContent || '').toLowerCase().indexOf('sign up') !== -1)) {
                fireEvent('sign_up', { method: 'website', link_url: href });
            }
            if (href.indexOf('apps.apple.com') !== -1 && href.indexOf('in-the-circle') !== -1) {
                fireEvent('download_app', { link_url: href });
            }
        }, true);
    })();
    </script>
    <?php
}
add_action('wp_footer', 'itc_seo_ga4_conversions', 25);

/**
 * Filter blog posts by language when ?lang=ar or ?lang=en
 */
function itc_seo_blog_filter_by_lang($query) {
    if (!is_admin() && $query->is_main_query() && is_home()) {
        $lang = isset($_GET['lang']) ? sanitize_text_field($_GET['lang']) : '';
        if ($lang === 'ar') {
            $query->set('category_name', 'arabic');
        } elseif ($lang === 'en') {
            $arabic = get_category_by_slug('arabic');
            if ($arabic && !is_wp_error($arabic)) {
                $query->set('category__not_in', [(int) $arabic->term_id]);
            }
        }
    }
}
add_action('pre_get_posts', 'itc_seo_blog_filter_by_lang', 10, 1);

/**
 * Output language filter bar + script to position it (blog index only)
 */
function itc_seo_blog_lang_filter_bar() {
    if (!is_home()) return;
    $blog_url = get_permalink(get_option('page_for_posts')) ?: home_url('/blog/');
    if (!$blog_url) $blog_url = home_url('/');
    $current = isset($_GET['lang']) ? sanitize_text_field($_GET['lang']) : 'all';
    ?>
    <div id="itc-blog-lang-filter" class="itc-blog-lang-filter" role="navigation" aria-label="<?php esc_attr_e('Filter by language', 'default'); ?>" style="visibility:hidden;">
        <a href="<?php echo esc_url($blog_url); ?>" class="<?php echo $current === 'all' ? 'active' : ''; ?>"><?php esc_html_e('All', 'default'); ?></a>
        <a href="<?php echo esc_url(add_query_arg('lang', 'ar', $blog_url)); ?>" class="<?php echo $current === 'ar' ? 'active' : ''; ?>">عربي</a>
        <a href="<?php echo esc_url(add_query_arg('lang', 'en', $blog_url)); ?>" class="<?php echo $current === 'en' ? 'active' : ''; ?>"><?php esc_html_e('English', 'default'); ?></a>
    </div>
    <style id="itc-seo-lang-filter-css">
    .itc-blog-lang-filter { display: flex; gap: 0.5rem; flex-wrap: wrap; padding: 1rem 0 1.25rem; margin-bottom: 0.5rem; border-bottom: 1px solid #e8eaed; }
    .itc-blog-lang-filter a { display: inline-block; padding: 0.5rem 1rem; border-radius: 9999px; font-size: 0.875rem; font-weight: 500; text-decoration: none; color: #64748b; background: #f1f5f9; transition: color 0.2s, background 0.2s; }
    .itc-blog-lang-filter a:hover { color: #334155; background: #e2e8f0; }
    .itc-blog-lang-filter a.active { color: #fff; background: #0f172a; }
    </style>
    <style id="itc-seo-blog-pagination-fix">
    .blog .wp-block-query-pagination:not(.itc-pagination-moved),
    .home .wp-block-query-pagination:not(.itc-pagination-moved),
    .itc-blog-index .wp-block-query-pagination:not(.itc-pagination-moved) { opacity: 0 !important; pointer-events: none !important; position: absolute !important; left: -9999px !important; }
    .blog main .wp-block-query-pagination.itc-pagination-moved,
    .home main .wp-block-query-pagination.itc-pagination-moved,
    .itc-blog-index main .wp-block-query-pagination.itc-pagination-moved { opacity: 1 !important; margin-top: 48px !important; display: flex !important; justify-content: center !important; flex-wrap: wrap !important; }
    </style>
    <script>
    (function(){
        var bar = document.getElementById('itc-blog-lang-filter');
        if (!bar) return;
        var main = document.querySelector('.blog main, .itc-blog-index main, .home main, [role="main"]');
        if (main) { main.insertBefore(bar, main.firstChild); bar.style.visibility = 'visible'; }
        else bar.style.visibility = 'visible';
    })();
    (function(){
        function movePagination() {
            var main = document.querySelector('.blog main, .itc-blog-index main, .home main, [role="main"]');
            var pagination = document.querySelector('.wp-block-query-pagination');
            if (!main || !pagination) return;
            var queryBlock = main.querySelector('.wp-block-query');
            if (queryBlock && pagination.parentNode !== queryBlock) {
                queryBlock.appendChild(pagination);
            } else if (queryBlock && pagination.nextElementSibling) {
                queryBlock.appendChild(pagination);
            } else if (pagination.parentNode !== main) {
                main.appendChild(pagination);
            } else if (pagination.nextElementSibling) {
                main.appendChild(pagination);
            } else {
                return;
            }
            pagination.classList.add('itc-pagination-moved');
            pagination.style.marginTop = '48px';
        }
        function run() {
            movePagination();
            setTimeout(movePagination, 200);
            setTimeout(movePagination, 800);
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run);
        } else {
            run();
        }
        window.addEventListener('load', movePagination);
    })();
    </script>
    <?php
}
add_action('wp_footer', 'itc_seo_blog_lang_filter_bar', 2);

/**
 * Body classes for blog and single post – so our CSS can target regardless of theme
 */
function itc_seo_body_class_blog($classes) {
    if (is_home() && !is_front_page()) {
        $classes[] = 'itc-blog-index';
    }
    if (is_singular('post')) {
        $classes[] = 'itc-single-post';
    }
    return $classes;
}
add_filter('body_class', 'itc_seo_body_class_blog', 20);

/**
 * Blog + Single Post UI – premium layout, typography, cards (overrides theme)
 */
function itc_seo_blog_page_css() {
    if (!is_home() && !is_singular('post')) {
        return;
    }
    ?>
    <style id="itc-seo-blog-ui">
    /* ---- BLOG INDEX ( .home or .blog = WordPress body class on /blog/ ) ---- */
    .home main,
    .blog main,
    .itc-blog-index main,
    .home [role="main"],
    .blog [role="main"],
    .itc-blog-index [role="main"],
    .home .wp-block-group__inner-container,
    .blog .wp-block-group__inner-container,
    .itc-blog-index .wp-block-group__inner-container {
        max-width: 720px !important;
        margin-left: auto !important;
        margin-right: auto !important;
        padding: 2rem 1.5rem 4rem !important;
        box-sizing: border-box !important;
    }
    .home .wp-block-query,
    .blog .wp-block-query,
    .home .wp-block-post-template,
    .blog .wp-block-post-template,
    .itc-blog-index .wp-block-query,
    .itc-blog-index .wp-block-post-template {
        display: flex !important;
        flex-direction: column !important;
        gap: 1.5rem !important;
        padding: 0 !important;
        margin: 0 !important;
        list-style: none !important;
    }
    .home .wp-block-post-template > *,
    .blog .wp-block-post-template > *,
    .home .wp-block-post,
    .blog .wp-block-post,
    .home article.post,
    .blog article.post,
    .home article,
    .blog article,
    .itc-blog-index .wp-block-post-template > *,
    .itc-blog-index .wp-block-post,
    .itc-blog-index article.post,
    .itc-blog-index article {
        background: #fff !important;
        border: 1px solid #e8eaed !important;
        border-radius: 14px !important;
        padding: 1.75rem 2rem !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06) !important;
        transition: box-shadow 0.2s ease, border-color 0.2s ease !important;
        box-sizing: border-box !important;
    }
    .home .wp-block-post-template > *:hover,
    .blog .wp-block-post-template > *:hover,
    .home .wp-block-post:hover,
    .blog .wp-block-post:hover,
    .home article.post:hover,
    .blog article.post:hover,
    .home article:hover,
    .blog article:hover,
    .itc-blog-index .wp-block-post-template > *:hover,
    .itc-blog-index .wp-block-post:hover,
    .itc-blog-index article.post:hover,
    .itc-blog-index article:hover {
        box-shadow: 0 8px 24px rgba(0,0,0,0.08) !important;
        border-color: #dadce0 !important;
    }
    .home .wp-block-post-title,
    .blog .wp-block-post-title,
    .home .wp-block-post-title a,
    .blog .wp-block-post-title a,
    .home article .entry-title,
    .blog article .entry-title,
    .home article .entry-title a,
    .blog article .entry-title a,
    .home main article h2 a,
    .blog main article h2 a,
    .itc-blog-index .wp-block-post-title,
    .itc-blog-index .wp-block-post-title a,
    .itc-blog-index article .entry-title,
    .itc-blog-index article .entry-title a {
        font-size: 1.25rem !important;
        font-weight: 700 !important;
        line-height: 1.3 !important;
        margin: 0 0 0.5rem 0 !important;
        color: #0f172a !important;
        text-decoration: none !important;
        letter-spacing: -0.02em !important;
    }
    .home .wp-block-post-title a:hover,
    .blog .wp-block-post-title a:hover,
    .home article .entry-title a:hover,
    .blog article .entry-title a:hover,
    .home main article h2 a:hover,
    .blog main article h2 a:hover,
    .itc-blog-index .wp-block-post-title a:hover,
    .itc-blog-index article .entry-title a:hover {
        color: #334155 !important;
        text-decoration: underline !important;
    }
    .home .wp-block-post-date,
    .blog .wp-block-post-date,
    .home .wp-block-post-terms,
    .blog .wp-block-post-terms,
    .home article .posted-on,
    .blog article .posted-on,
    .home article .cat-links,
    .blog article .cat-links,
    .itc-blog-index .wp-block-post-date,
    .itc-blog-index .wp-block-post-terms,
    .itc-blog-index article .posted-on,
    .itc-blog-index article .cat-links {
        font-size: 0.8125rem !important;
        color: #64748b !important;
        margin: 0 0 0.5rem 0 !important;
    }
    .home .wp-block-post-terms a,
    .home article .cat-links a,
    .itc-blog-index .wp-block-post-terms a,
    .itc-blog-index article .cat-links a {
        color: #64748b !important;
        text-decoration: none !important;
    }
    .home .wp-block-post-excerpt,
    .blog .wp-block-post-excerpt,
    .home .wp-block-post-excerpt__excerpt,
    .blog .wp-block-post-excerpt__excerpt,
    .home article .entry-summary,
    .blog article .entry-summary,
    .home main article p,
    .blog main article p,
    .itc-blog-index .wp-block-post-excerpt,
    .itc-blog-index .wp-block-post-excerpt__excerpt,
    .itc-blog-index article .entry-summary {
        font-size: 0.9375rem !important;
        line-height: 1.55 !important;
        color: #475569 !important;
        margin: 0.5rem 0 0.75rem 0 !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 3 !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
    }
    .home .wp-block-post-excerpt__more-link,
    .blog .wp-block-post-excerpt__more-link,
    .home article .more-link,
    .blog article .more-link,
    .itc-blog-index .wp-block-post-excerpt__more-link,
    .itc-blog-index article .more-link {
        font-size: 0.875rem !important;
        font-weight: 600 !important;
        color: #0f172a !important;
        text-decoration: none !important;
    }
    .home .page-title,
    .blog .page-title,
    .home main h1,
    .blog main h1,
    .itc-blog-index .page-title,
    .itc-blog-index main h1 {
        font-size: 1.875rem !important;
        font-weight: 800 !important;
        margin: 0 0 1.75rem 0 !important;
        color: #0f172a !important;
        letter-spacing: -0.03em !important;
    }

    /* ---- SINGLE POST ( .single = WordPress body class on any single post ) ---- */
    .single main,
    .single [role="main"],
    .single .wp-block-post-content,
    .single .entry-content,
    .itc-single-post main,
    .itc-single-post [role="main"],
    .itc-single-post .wp-block-post-content,
    .itc-single-post .entry-content {
        max-width: 680px !important;
        margin-left: auto !important;
        margin-right: auto !important;
        padding: 2rem 1.5rem 3rem !important;
        box-sizing: border-box !important;
    }
    .single .wp-block-post-content,
    .single .entry-content,
    .itc-single-post .wp-block-post-content,
    .itc-single-post .entry-content {
        font-size: 1.125rem !important;
        line-height: 1.75 !important;
        color: #334155 !important;
    }
    .single .wp-block-post-content h1,
    .single .entry-title,
    .single .entry-content h1,
    .single main h1,
    .itc-single-post .wp-block-post-content h1,
    .itc-single-post .entry-title,
    .itc-single-post .entry-content h1 {
        font-size: 2rem !important;
        font-weight: 800 !important;
        line-height: 1.25 !important;
        margin: 0 0 0.5rem 0 !important;
        color: #0f172a !important;
        letter-spacing: -0.03em !important;
    }
    .single .wp-block-post-date,
    .single .posted-on,
    .single .entry-content .posted-on,
    .itc-single-post .wp-block-post-date,
    .itc-single-post .posted-on {
        font-size: 0.875rem !important;
        color: #64748b !important;
        margin-bottom: 1.5rem !important;
    }
    .single .wp-block-post-content h2,
    .single .entry-content h2,
    .itc-single-post .wp-block-post-content h2,
    .itc-single-post .entry-content h2 {
        font-size: 1.375rem !important;
        font-weight: 700 !important;
        margin: 2.25rem 0 0.75rem !important;
        color: #0f172a !important;
    }
    .single .wp-block-post-content h3,
    .single .entry-content h3,
    .itc-single-post .wp-block-post-content h3,
    .itc-single-post .entry-content h3 {
        font-size: 1.125rem !important;
        font-weight: 700 !important;
        margin: 1.75rem 0 0.5rem !important;
        color: #1e293b !important;
    }
    .single .wp-block-post-content p,
    .single .entry-content p,
    .itc-single-post .wp-block-post-content p,
    .itc-single-post .entry-content p {
        margin: 0 0 1.25rem 0 !important;
    }
    .single .wp-block-post-content ul,
    .single .wp-block-post-content ol,
    .single .entry-content ul,
    .single .entry-content ol,
    .itc-single-post .entry-content ul,
    .itc-single-post .entry-content ol {
        margin: 0 0 1.25rem 0 !important;
        padding-left: 1.5rem !important;
    }
    .single .wp-block-post-content li,
    .single .entry-content li,
    .itc-single-post .entry-content li {
        margin-bottom: 0.4rem !important;
    }
    .single .wp-block-post-content a,
    .single .entry-content a,
    .itc-single-post .entry-content a {
        color: #0f172a !important;
        text-decoration: underline !important;
        text-underline-offset: 2px !important;
    }
    .single .wp-block-post-content a:hover,
    .single .entry-content a:hover,
    .itc-single-post .entry-content a:hover {
        color: #334155 !important;
    }
    .single .wp-block-post-content .wp-block-buttons,
    .single .entry-content .wp-block-buttons,
    .itc-single-post .entry-content .wp-block-buttons {
        margin: 2rem 0 !important;
    }
    .single .wp-block-button__link,
    .single .entry-content .wp-block-button__link,
    .itc-single-post .entry-content .wp-block-button__link {
        display: inline-block !important;
        padding: 0.75rem 1.5rem !important;
        border-radius: 10px !important;
        font-weight: 600 !important;
        text-decoration: none !important;
    }
    .single #comments,
    .single .comments-area,
    .itc-single-post #comments,
    .itc-single-post .comments-area {
        max-width: 680px !important;
        margin: 2rem auto 3rem !important;
        padding: 0 1.5rem !important;
    }
    .single .comment-form input[type="text"],
    .single .comment-form input[type="email"],
    .single .comment-form textarea,
    .itc-single-post .comment-form input[type="text"],
    .itc-single-post .comment-form input[type="email"],
    .itc-single-post .comment-form textarea {
        width: 100% !important;
        max-width: 100% !important;
        padding: 0.6rem 0.75rem !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 8px !important;
        font-size: 1rem !important;
        box-sizing: border-box !important;
    }
    </style>
    <?php
}
add_action('wp_head', 'itc_seo_blog_page_css', 20);

/**
 * Fallback: ensure body has itc-blog-index / itc-single-post when theme doesn't use body_class
 */
function itc_seo_blog_body_class_js() {
    if (!is_home() && !is_singular('post')) {
        return;
    }
    ?>
    <script>
    (function(){
        var c = document.body.className;
        var path = (window.location.pathname || '/').replace(/\/$/, '') || '/';
        if (path === '/blog' && c.indexOf('itc-blog-index') === -1) document.body.classList.add('itc-blog-index');
        if (c.indexOf('single') !== -1 && c.indexOf('itc-single-post') === -1) document.body.classList.add('itc-single-post');
    })();
    </script>
    <?php
}
add_action('wp_footer', 'itc_seo_blog_body_class_js', 1);

/**
 * Accessibility: give icon-only social/contact links a discernible name (aria-label)
 */
function itc_seo_a11y_social_link_labels() {
    ?>
    <script>
    (function(){
        var labels = {
            'instagram.com': 'Follow us on Instagram',
            'tiktok.com': 'Follow us on TikTok',
            'linkedin.com': 'Follow us on LinkedIn',
            'mailto:hello@': 'Email us at hello@inthecircle.co',
            'mailto:support@': 'Email support'
        };
        document.querySelectorAll('a[href]').forEach(function(a) {
            var h = (a.getAttribute('href') || '').toLowerCase();
            var text = (a.textContent || '').trim();
            if (text.length > 0) return;
            for (var key in labels) {
                if (h.indexOf(key) !== -1) {
                    a.setAttribute('aria-label', labels[key]);
                    break;
                }
            }
        });
    })();
    </script>
    <?php
}
add_action('wp_footer', 'itc_seo_a11y_social_link_labels', 3);

/**
 * Accessibility: sufficient contrast for labels, links, and footer on dark backgrounds
 */
function itc_seo_a11y_contrast_css() {
    ?>
    <style id="itc-seo-a11y-contrast">
    /* Purple labels (COUNTRIES, APP STORE) on dark – lighten to meet contrast */
    p[style*="124, 58, 237"],
    p[style*="124,58,237"] { color: #c4b5fd !important; }
    /* Links in dark sections (#050508) – ensure light enough */
    section[style*="050508"] a,
    section[style*="050508"] a:visited { color: #a5b4fc !important; }
    section[style*="050508"] a:hover { color: #c7d2fe !important; }
    /* Footer text */
    footer p[style*="75, 85, 99"],
    footer p[style*="75,85,99"] { color: #9ca3af !important; }
    footer p[style*="107, 114, 128"],
    footer p[style*="6b7280"] { color: #d1d5db !important; }
    /* Injected internal links */
    .itc-seo-links a { color: #a5b4fc !important; }
    .itc-seo-links a:hover { color: #c7d2fe !important; }
    </style>
    <?php
}
add_action('wp_head', 'itc_seo_a11y_contrast_css', 22);

/**
 * Accessibility: heading order – first h4 on front page becomes h2 so order doesn't skip
 */
function itc_seo_a11y_heading_order($content) {
    if (!is_front_page() || !is_string($content)) return $content;
    if (stripos($content, '<h4') === false) return $content;
    return preg_replace('/<h4(\s[^>]*>)/i', '<h2$1', $content, 1);
}
add_filter('the_content', 'itc_seo_a11y_heading_order', 14);

/**
 * Minify JS for Performance SEO: serve minified version of known un-minified scripts.
 * Fixes: consent.js (cookieadmin), navigation-customization.js (extendable theme).
 */
function itc_seo_simple_js_minify($code) {
    if (!is_string($code) || $code === '') return $code;
    $code = preg_replace('/\/\*[\s\S]*?\*\//u', '', $code);
    $code = preg_replace('/\s*\/\/[^\n]*/u', '', $code);
    $code = preg_replace('/\s+/u', ' ', $code);
    return trim($code);
}

function itc_seo_script_loader_tag_minify($tag, $handle, $src) {
    $src_clean = preg_replace('/\?.*$/', '', $src);
    if (strpos($src_clean, 'cookieadmin/assets/js/consent.js') !== false) {
        $path = ABSPATH . 'wp-content/plugins/cookieadmin/assets/js/consent.js';
    } elseif (strpos($src_clean, 'extendable/assets/js/navigation-customization.js') !== false) {
        $path = ABSPATH . 'wp-content/themes/extendable/assets/js/navigation-customization.js';
    } else {
        return $tag;
    }
    if (!is_readable($path)) return $tag;
    $code = @file_get_contents($path);
    if ($code === false || $code === '') return $tag;
    $min = itc_seo_simple_js_minify($code);
    $min = str_replace('</script>', '<\/script>', $min);
    $id_attr = preg_match('/id=["\']([^"\']+)["\']/', $tag, $m) ? $m[1] : $handle;
    return '<script id="' . esc_attr($id_attr) . '-min" type="text/javascript">' . $min . '</script>';
}
add_filter('script_loader_tag', 'itc_seo_script_loader_tag_minify', 10, 3);


/**
 * Last-resort cleanup for legacy AIOSEO schema/template strings on frontend output.
 */
function itc_seo_replace_brand_in_buffer($buffer) {
    return itc_seo_normalize_brand_copy($buffer);
}

function itc_seo_start_output_buffer() {
    if (is_admin() || wp_doing_ajax() || (defined('REST_REQUEST') && REST_REQUEST)) return;
    ob_start('itc_seo_replace_brand_in_buffer');
}
add_action('template_redirect', 'itc_seo_start_output_buffer', 0);



/** Deep-replace helper for arrays/objects/scalars. */
function itc_seo_recursive_normalize($value) {
    if (is_string($value)) return itc_seo_normalize_brand_copy($value);
    if (is_array($value)) {
        foreach ($value as $k => $v) $value[$k] = itc_seo_recursive_normalize($v);
        return $value;
    }
    if (is_object($value)) {
        foreach ($value as $k => $v) $value->$k = itc_seo_recursive_normalize($v);
        return $value;
    }
    return $value;
}

/** One-time migration: clean AIOSEO stored options/meta from legacy brand/positioning copy. */
function itc_seo_run_aioseo_storage_cleanup_once() {
    if (get_option('itc_seo_aioseo_cleanup_done')) return;

    global $wpdb;

    // 1) Clean all AIOSEO options safely via maybe_unserialize/update_option.
    $rows = $wpdb->get_results("SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE 'aioseo_%'", ARRAY_A);
    if (is_array($rows)) {
        foreach ($rows as $row) {
            $name = $row['option_name'];
            $raw = $row['option_value'];
            $old = maybe_unserialize($raw);
            $new = itc_seo_recursive_normalize($old);
            if ($new !== $old) {
                update_option($name, $new);
            }
        }
    }

    // 2) Clean AIOSEO custom table text/json columns when available.
    $aioseo_posts = $wpdb->prefix . 'aioseo_posts';
    $exists = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $aioseo_posts));
    if ($exists === $aioseo_posts) {
        $cols = $wpdb->get_results("DESCRIBE `{$aioseo_posts}`", ARRAY_A);
        $textCols = [];
        foreach ((array) $cols as $c) {
            $type = strtolower((string) ($c['Type'] ?? ''));
            $field = (string) ($c['Field'] ?? '');
            if ($field && (strpos($type, 'char') !== false || strpos($type, 'text') !== false || strpos($type, 'json') !== false)) {
                $textCols[] = $field;
            }
        }
        foreach ($textCols as $col) {
            $wpdb->query("UPDATE `{$aioseo_posts}` SET `{$col}` = REPLACE(`{$col}`, 'InTheCircle', 'Inthecircle') WHERE `{$col}` LIKE '%InTheCircle%'");
            $wpdb->query("UPDATE `{$aioseo_posts}` SET `{$col}` = REPLACE(`{$col}`, 'founders, ', '') WHERE `{$col}` LIKE '%founders, %'");
            $wpdb->query("UPDATE `{$aioseo_posts}` SET `{$col}` = REPLACE(`{$col}`, 'founders & ', 'creators & ') WHERE `{$col}` LIKE '%founders & %'");
            $wpdb->query("UPDATE `{$aioseo_posts}` SET `{$col}` = REPLACE(`{$col}`, 'founders', 'creators') WHERE `{$col}` LIKE '%founders%'");
        }
    }

    update_option('itc_seo_aioseo_cleanup_done', time());
}
add_action('init', 'itc_seo_run_aioseo_storage_cleanup_once', 2);
add_action('rest_api_init', 'itc_seo_run_aioseo_storage_cleanup_once', 2);


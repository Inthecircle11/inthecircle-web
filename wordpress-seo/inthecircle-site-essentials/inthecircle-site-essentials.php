<?php
/**
 * Plugin Name: Inthecircle Site Essentials
 * Description: SEO helpers, AIOSEO tuning, schema, performance preloads, blog UX, and security headers. No promotional bars or sticky headers.
 * Version: 1.0.0
 * Author: Inthecircle
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('ITC_ESS_VERSION', '1.0.0');
define('ITC_ESS_BASE_URL', 'https://inthecircle.co');
define('ITC_ESS_OG_IMAGE', ITC_ESS_BASE_URL . '/wp-content/uploads/2026/02/email-logo-optimized.jpg');
define('ITC_ESS_LOGO_URL', ITC_ESS_BASE_URL . '/wp-content/uploads/2026/02/inthecircle-logo-header-optimized-1.png');
/** Same option key as the legacy plugin so App Store ID carries over after switching. */
define('ITC_ESS_OPTION_APP_STORE_ID', 'itc_seo_app_store_id');
define('ITC_ESS_KEYWORDS', 'inthecircle, in the circle app, creator networking app, networking app for creators, connect with creators, creator community, YouTuber network, streamer community, digital creator app, collaboration app, creator platform');

/**
 * Brand and copy normalization (titles, descriptions, OG text).
 */
function itc_ess_normalize_brand_copy($text) {
    if (!is_string($text) || $text === '') {
        return $text;
    }
    $text = str_replace('InTheCircle', 'Inthecircle', $text);
    $text = preg_replace('/\bfounders\b\s*,\s*/i', '', $text);
    $text = preg_replace('/\bfounders\b\s*&\s*/i', 'creators & ', $text);
    $text = preg_replace('/\bfounders\b/i', 'creators', $text);
    $text = preg_replace('/\bcreators\s*,\s*creators\b/i', 'creators', $text);
    return $text;
}

function itc_ess_get_app_store_id() {
    $id = get_option(ITC_ESS_OPTION_APP_STORE_ID, '');
    return preg_match('/^\d+$/', $id) ? $id : '6758384054';
}

function itc_ess_get_page_data() {
    return [
        'home' => [
            'title' => 'Inthecircle Networking App for Creators Community',
            'description' => 'Inthecircle is a networking app for creators. Connect with creators, collaborate on projects, and grow your circle in a creators-only iOS community.',
            'url' => ITC_ESS_BASE_URL . '/',
        ],
        'home-v2' => [
            'title' => 'Inthecircle Networking App for Creators Community',
            'description' => 'Inthecircle is a networking app for creators. Connect with creators, collaborate on projects, and grow your circle in a creators-only iOS community.',
            'url' => ITC_ESS_BASE_URL . '/',
        ],
        'about' => [
            'title' => 'About Inthecircle – Creator Networking Platform',
            'description' => 'In The Circle is the future of professional networking for creators. Quality connections, privacy-first, no ads. Learn our mission.',
            'url' => ITC_ESS_BASE_URL . '/about/',
        ],
        'faq' => [
            'title' => 'FAQ – Inthecircle Help Center',
            'description' => 'Find answers about profiles, connections, messaging & more. Get help with the Inthecircle creator networking app.',
            'url' => ITC_ESS_BASE_URL . '/faq/',
        ],
        'privacy-policy' => [
            'title' => 'Privacy Policy – Inthecircle',
            'description' => 'How Inthecircle collects, uses & protects your data. We never sell your information. Read our privacy policy.',
            'url' => ITC_ESS_BASE_URL . '/privacy-policy/',
        ],
        'terms' => [
            'title' => 'Terms of Service – Inthecircle',
            'description' => 'Inthecircle terms of service. Rules for using our creator networking app.',
            'url' => ITC_ESS_BASE_URL . '/terms/',
        ],
        'terms-of-service' => [
            'title' => 'Terms of Service – Inthecircle',
            'description' => 'Inthecircle terms of service. Rules for using our creator networking app.',
            'url' => ITC_ESS_BASE_URL . '/terms-of-service/',
        ],
    ];
}

function itc_ess_get_current_data() {
    $pages = itc_ess_get_page_data();
    if (is_404()) {
        return [
            'title' => 'Page Not Found – Inthecircle',
            'description' => 'The page you\'re looking for doesn\'t exist. Return to Inthecircle – the #1 networking app for creators.',
            'url' => ITC_ESS_BASE_URL . (isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '/'),
        ];
    }
    if (is_front_page()) {
        return $pages['home'];
    }
    $slug = get_post_field('post_name', get_queried_object_id());
    if ($slug && isset($pages[$slug])) {
        return $pages[$slug];
    }
    return [
        'title' => get_bloginfo('name') . ' – ' . get_bloginfo('description'),
        'description' => get_bloginfo('description') ?: 'Inthecircle – The #1 networking app for creators.',
        'url' => get_permalink(),
    ];
}

/**
 * Override AIOSEO only on front page and mapped static pages — never on blog posts.
 */
function itc_ess_should_override_aioseo_meta() {
    global $post;
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
    $pages = itc_ess_get_page_data();
    return $slug && isset($pages[$slug]);
}

/**
 * Head: performance + keywords only. Intentionally no UI promos or sticky bars.
 */
function itc_ess_output_head() {
    $host = parse_url(ITC_ESS_BASE_URL, PHP_URL_HOST);
    $scheme = parse_url(ITC_ESS_BASE_URL, PHP_URL_SCHEME) ?: 'https';
    echo '<!-- Inthecircle Site Essentials ' . esc_html(ITC_ESS_VERSION) . ' -->' . "\n";
    echo '<link rel="preconnect" href="' . esc_url($scheme . '://' . $host) . '">' . "\n";
    echo '<link rel="preload" href="' . esc_url(ITC_ESS_LOGO_URL) . '" as="image" fetchpriority="high">' . "\n";
    echo '<meta name="keywords" content="' . esc_attr(ITC_ESS_KEYWORDS) . '">' . "\n";
}
add_action('wp_head', 'itc_ess_output_head', 1);

function itc_ess_cookie_banner_contrast() {
    ?>
<style id="itc-ess-cookie-banner-contrast">
.cmplz-cookiebanner .cmplz-message,.cmplz-cookiebanner .cmplz-header,.cmplz-cookiebanner h1,.cmplz-cookiebanner h2,.cmplz-cookiebanner h3,.cmplz-cookiebanner p,.cmplz-cookiebanner .cmplz-body,.cmplz-cookiebanner .cmplz-text,.cmplz-cookiebanner .cmplz-categories .cmplz-category .cmplz-category-header .cmplz-category-title,.cmplz-cookiebanner .cmplz-categories .cmplz-category .cmplz-description,#cmplz-cookiebanner .cmplz-message,#cmplz-cookiebanner .cmplz-body,#cmplz-cookiebanner p,#cmplz-cookiebanner h1,#cmplz-cookiebanner h2,#cmplz-cookiebanner h3,[class*="cmplz"] .cmplz-message,[class*="cmplz"] .cmplz-body,[class*="cmplz"] p,[class*="cookie-banner"] h1,[class*="cookie-banner"] h2,[class*="cookie-banner"] h3,[class*="cookie-banner"] p,[class*="cookie-consent"] h1,[class*="cookie-consent"] h2,[class*="cookie-consent"] h3,[class*="cookie-consent"] p,[class*="cookieadmin"] h1,[class*="cookieadmin"] h2,[class*="cookieadmin"] h3,[class*="cookieadmin"] p,[id*="cookieadmin"] h1,[id*="cookieadmin"] h2,[id*="cookieadmin"] h3,[id*="cookieadmin"] p,[class*="consent-banner"] h1,[class*="consent-banner"] h2,[class*="consent-banner"] h3,[class*="consent-banner"] p,[class*="wpconsent"] .cmplz-message,[class*="wpconsent"] .cmplz-body,[class*="wpconsent"] p{color:#e5e7eb!important}
.cmplz-cookiebanner .cmplz-header,[class*="cookie-banner"] h1,[class*="cookie-banner"] h2,[class*="cookie-consent"] h1,[class*="cookie-consent"] h2,[class*="cookieadmin"] h1,[class*="cookieadmin"] h2,[id*="cookieadmin"] h1,[id*="cookieadmin"] h2{color:#f3f4f6!important}
</style>
    <?php
}
add_action('wp_head', 'itc_ess_cookie_banner_contrast', 25);

function itc_ess_output_schema() {
    $app_store_url = 'https://apps.apple.com/app/in-the-circle/id' . itc_ess_get_app_store_id();
    $schema = [
        '@context' => 'https://schema.org',
        '@graph' => [
            [
                '@type' => 'Organization',
                '@id' => ITC_ESS_BASE_URL . '/#organization',
                'name' => 'inthecircle',
                'url' => ITC_ESS_BASE_URL,
                'logo' => ['@type' => 'ImageObject', 'url' => ITC_ESS_OG_IMAGE],
                'sameAs' => ['https://www.instagram.com/inthecirclee'],
                'contactPoint' => [
                    '@type' => 'ContactPoint',
                    'email' => 'support@inthecircle.co',
                    'contactType' => 'customer support',
                ],
            ],
            [
                '@type' => 'WebSite',
                '@id' => ITC_ESS_BASE_URL . '/#website',
                'url' => ITC_ESS_BASE_URL,
                'name' => 'inthecircle',
                'description' => 'Inthecircle networking app for creators. Learn more on our About, FAQ, and Blog pages.',
                'publisher' => ['@id' => ITC_ESS_BASE_URL . '/#organization'],
                'potentialAction' => [
                    '@type' => 'SearchAction',
                    'target' => ['@type' => 'EntryPoint', 'urlTemplate' => ITC_ESS_BASE_URL . '/?s={search_term_string}'],
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
                'url' => ITC_ESS_BASE_URL,
                'applicationCategory' => 'SocialNetworkingApplication',
                'operatingSystem' => 'iOS',
                'offers' => ['@type' => 'Offer', 'price' => '0', 'priceCurrency' => 'USD'],
                'description' => 'Join inthecircle – the #1 networking app for creators. Connect with creators, YouTubers, streamers & digital professionals. Download free on iOS.',
                'screenshot' => ITC_ESS_OG_IMAGE,
            ],
        ],
    ];
    echo '<script type="application/ld+json">' . "\n" . wp_json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n</script>\n";
}
add_action('wp_head', 'itc_ess_output_schema', 5);

function itc_ess_output_faq_schema() {
    if (!is_page('faq') && !is_page('help-center')) {
        return;
    }
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
add_action('wp_head', 'itc_ess_output_faq_schema', 6);

function itc_ess_home_internal_links($content) {
    if (!is_front_page()) {
        return $content;
    }
    $about_url = home_url('/about/');
    $faq_url = home_url('/faq/');
    $blog_url = home_url('/blog/');
    $terms_url = home_url('/terms-of-service/');
    $privacy_url = home_url('/privacy-policy/');
    $links = '<p class="itc-ess-links" style="margin:1.25rem 0;font-size:0.95em;">'
        . '<a href="' . esc_url($about_url) . '" style="color:#a5b4fc;">About</a> &middot; '
        . '<a href="' . esc_url($faq_url) . '" style="color:#a5b4fc;">FAQ</a> &middot; '
        . '<a href="' . esc_url($blog_url) . '" style="color:#a5b4fc;">Blog</a> &middot; '
        . '<a href="' . esc_url($terms_url) . '" style="color:#a5b4fc;">Terms</a> &middot; '
        . '<a href="' . esc_url($privacy_url) . '" style="color:#a5b4fc;">Privacy</a>'
        . '</p>';
    if (preg_match('/(<h2[^>]*>)/i', $content, $m)) {
        return preg_replace('/(<h2[^>]*>)/i', $links . "\n$1", $content, 1);
    }
    return $links . $content;
}
add_filter('the_content', 'itc_ess_home_internal_links', 15);

function itc_ess_logo_alt($html) {
    if (empty($html)) {
        return $html;
    }
    $alt = 'Inthecircle – Creator networking app logo';
    if (strpos($html, 'alt=""') !== false || strpos($html, "alt=''") !== false) {
        $html = preg_replace('/alt=["\']?["\']?/', 'alt="' . esc_attr($alt) . '" ', $html);
    } elseif (preg_match('/<img[^>]+>/', $html) && !preg_match('/\salt=/', $html)) {
        $html = preg_replace('/<img /', '<img alt="' . esc_attr($alt) . '" ', $html);
    }
    if (strpos($html, 'fetchpriority') === false) {
        $html = preg_replace('/<img /', '<img fetchpriority="high" ', $html);
    }
    return $html;
}
add_filter('get_custom_logo', 'itc_ess_logo_alt', 20);

function itc_ess_content_image_alt($content) {
    $logo_pattern = 'email/logo';
    $alt = 'Inthecircle – Creator networking app logo';
    if (strpos($content, $logo_pattern) === false) {
        return $content;
    }
    return preg_replace_callback(
        '/<img([^>]*src=[^>]*' . preg_quote($logo_pattern, '/') . '[^>]*)>/i',
        function ($m) use ($alt) {
            $tag = $m[0];
            if (preg_match('/\salt\s*=\s*["\']?[^"\'>]*["\']?/i', $tag)) {
                return $tag;
            }
            return preg_replace('/<img /', '<img alt="' . esc_attr($alt) . '" ', $tag);
        },
        $content
    );
}
add_filter('the_content', 'itc_ess_content_image_alt', 10);

function itc_ess_app_store_url($content) {
    $placeholder = 'https://apps.apple.com/app/in-the-circle/id123456789';
    $real = 'https://apps.apple.com/app/in-the-circle/id' . itc_ess_get_app_store_id();
    if ($placeholder !== $real) {
        $content = str_replace($placeholder, $real, $content);
    }
    return $content;
}
add_filter('the_content', 'itc_ess_app_store_url', 5);

function itc_ess_aioseo_title($title) {
    if (itc_ess_should_override_aioseo_meta()) {
        $data = itc_ess_get_current_data();
        if (!empty($data['title'])) {
            $title = $data['title'];
        }
    }
    return itc_ess_normalize_brand_copy($title);
}
add_filter('aioseo_title', 'itc_ess_aioseo_title', 999);

function itc_ess_aioseo_description($description) {
    if (itc_ess_should_override_aioseo_meta()) {
        $data = itc_ess_get_current_data();
        if (!empty($data['description'])) {
            $description = $data['description'];
        }
    }
    return itc_ess_normalize_brand_copy($description);
}
add_filter('aioseo_description', 'itc_ess_aioseo_description', 999);

function itc_ess_aioseo_facebook_tags($tags) {
    if (!is_array($tags)) {
        $tags = [];
    }
    if (itc_ess_should_override_aioseo_meta()) {
        $data = itc_ess_get_current_data();
        if (!empty($data['title'])) {
            $tags['og:title'] = $data['title'];
        }
        if (!empty($data['description'])) {
            $tags['og:description'] = $data['description'];
        }
    }
    $tags['og:image'] = ITC_ESS_OG_IMAGE;
    $tags['og:site_name'] = 'Inthecircle';
    foreach ($tags as $k => $v) {
        if (is_string($v)) {
            $tags[$k] = itc_ess_normalize_brand_copy($v);
        }
    }
    return $tags;
}
add_filter('aioseo_facebook_tags', 'itc_ess_aioseo_facebook_tags', 999);

function itc_ess_aioseo_twitter_tags($tags) {
    if (!is_array($tags)) {
        $tags = [];
    }
    if (itc_ess_should_override_aioseo_meta()) {
        $data = itc_ess_get_current_data();
        if (!empty($data['title'])) {
            $tags['twitter:title'] = $data['title'];
        }
        if (!empty($data['description'])) {
            $tags['twitter:description'] = $data['description'];
        }
    }
    $tags['twitter:image'] = ITC_ESS_OG_IMAGE;
    foreach ($tags as $k => $v) {
        if (is_string($v)) {
            $tags[$k] = itc_ess_normalize_brand_copy($v);
        }
    }
    return $tags;
}
add_filter('aioseo_twitter_tags', 'itc_ess_aioseo_twitter_tags', 999);

function itc_ess_app_store_url_js() {
    $real_id = itc_ess_get_app_store_id();
    if ($real_id === '123456789') {
        return;
    }
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
add_action('wp_footer', 'itc_ess_app_store_url_js', 20);

function itc_ess_get_focus_keyphrase_map() {
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
        'creator-networking-collaboration-hub' => 'creator networking collaboration',
        'how-creators-work-together-playbook' => 'creator collaboration playbook',
        'mena-gcc-creators-hub' => 'MENA GCC creators',
    ];
}

function itc_ess_get_focus_keyphrase_for_post($post_id) {
    $post = get_post($post_id);
    if (!$post || $post->post_type !== 'post') {
        return '';
    }
    $slug = $post->post_name;
    $map = itc_ess_get_focus_keyphrase_map();
    if (isset($map[$slug])) {
        return $map[$slug];
    }
    $title = $post->post_title;
    if (strpos($title, 'مليار متابع') !== false || strpos($title, 'قمة مليار') !== false || strpos($title, 'برنامج مبدعي') !== false) {
        return 'قمة مليار متابع';
    }
    return (strpos($slug, 'ar') === 0) ? 'تطبيق تواصل للمبدعين' : 'creator networking';
}

function itc_ess_aioseo_get_post_supply_keyphrase($post) {
    if (!is_object($post)) {
        return $post;
    }
    $post_id = isset($post->post_id) ? (int) $post->post_id : 0;
    if (!$post_id) {
        return $post;
    }
    $keyphrase = itc_ess_get_focus_keyphrase_for_post($post_id);
    if ($keyphrase === '') {
        return $post;
    }
    $current = '';
    if (isset($post->keyphrases) && is_array($post->keyphrases) && !empty($post->keyphrases)) {
        $first = reset($post->keyphrases);
        $current = is_object($first) && isset($first->keyphrase) ? $first->keyphrase : (is_string($first) ? $first : '');
    }
    if (isset($post->focusKeyphrase)) {
        $current = $current ?: (string) $post->focusKeyphrase;
    }
    if ($current !== '') {
        return $post;
    }
    if (property_exists($post, 'focusKeyphrase')) {
        $post->focusKeyphrase = $keyphrase;
    }
    if (property_exists($post, 'keyphrases')) {
        $post->keyphrases = [(object) ['keyphrase' => $keyphrase]];
    }
    return $post;
}
add_filter('aioseo_get_post', 'itc_ess_aioseo_get_post_supply_keyphrase', 10, 1);

function itc_ess_aioseo_save_post_set_keyphrase($post) {
    if (!is_object($post)) {
        return $post;
    }
    $post_id = isset($post->post_id) ? (int) $post->post_id : 0;
    if (!$post_id) {
        return $post;
    }
    $keyphrase = itc_ess_get_focus_keyphrase_for_post($post_id);
    if ($keyphrase === '') {
        return $post;
    }
    $current = '';
    if (isset($post->keyphrases) && is_array($post->keyphrases) && !empty($post->keyphrases)) {
        $first = reset($post->keyphrases);
        $current = is_object($first) && isset($first->keyphrase) ? $first->keyphrase : (is_string($first) ? $first : '');
    }
    if (isset($post->focusKeyphrase)) {
        $current = $current ?: (string) $post->focusKeyphrase;
    }
    if ($current !== '') {
        return $post;
    }
    if (property_exists($post, 'focusKeyphrase')) {
        $post->focusKeyphrase = $keyphrase;
    }
    if (property_exists($post, 'keyphrases')) {
        $post->keyphrases = [(object) ['keyphrase' => $keyphrase]];
    }
    return $post;
}
add_filter('aioseo_save_post', 'itc_ess_aioseo_save_post_set_keyphrase', 10, 1);

function itc_ess_aioseo_direct_update_keyphrase($post_id, $keyphrase) {
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
        if ($updated !== false) {
            return true;
        }
        if ($wpdb->last_error) {
            return false;
        }
        $exists = $wpdb->get_var($wpdb->prepare("SELECT 1 FROM `{$table}` WHERE post_id = %d", $post_id));
        if (!$exists) {
            return $wpdb->insert($table, ['post_id' => $post_id, 'keyphrases' => $keyphrases_json]) !== false;
        }
        return false;
    }
    if (in_array('keyphrase', $col_names, true)) {
        $updated = $wpdb->update($table, ['keyphrase' => $keyphrase], ['post_id' => $post_id]);
        if ($updated !== false) {
            return true;
        }
        $exists = $wpdb->get_var($wpdb->prepare("SELECT 1 FROM `{$table}` WHERE post_id = %d", $post_id));
        if (!$exists) {
            return $wpdb->insert($table, ['post_id' => $post_id, 'keyphrase' => $keyphrase]) !== false;
        }
        return false;
    }
    return false;
}

function itc_ess_bulk_set_focus_keywords() {
    if (!current_user_can('manage_options')) {
        return;
    }
    if (!isset($_GET['itc_ess_bulk_keywords']) || $_GET['itc_ess_bulk_keywords'] !== '1') {
        return;
    }
    check_admin_referer('itc_ess_bulk_keywords');
    $posts = get_posts(['post_type' => 'post', 'post_status' => 'publish', 'numberposts' => -1, 'fields' => 'ids']);
    $count = 0;
    $direct = 0;
    foreach ($posts as $id) {
        $id = (int) $id;
        $keyphrase = itc_ess_get_focus_keyphrase_for_post($id);
        if ($keyphrase !== '' && itc_ess_aioseo_direct_update_keyphrase($id, $keyphrase)) {
            $direct++;
        }
        wp_update_post(['ID' => $id]);
        $count++;
    }
    wp_redirect(add_query_arg([
        'page' => 'itc-site-essentials',
        'itc_ess_keywords_done' => $count,
        'itc_ess_keywords_direct' => $direct,
    ], admin_url('options-general.php')));
    exit;
}
add_action('admin_init', 'itc_ess_bulk_set_focus_keywords');

function itc_ess_add_menu() {
    add_options_page('Inthecircle Site Essentials', 'Inthecircle Site', 'manage_options', 'itc-site-essentials', 'itc_ess_settings_page');
}
add_action('admin_menu', 'itc_ess_add_menu');

function itc_ess_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    if (isset($_POST['itc_ess_save']) && check_admin_referer('itc_ess_settings')) {
        $id = isset($_POST['itc_ess_app_store_id']) ? sanitize_text_field(wp_unslash($_POST['itc_ess_app_store_id'])) : '';
        if (preg_match('/^\d*$/', $id)) {
            update_option(ITC_ESS_OPTION_APP_STORE_ID, $id !== '' ? $id : '6758384054');
            echo '<div class="notice notice-success"><p>Settings saved.</p></div>';
        } else {
            echo '<div class="notice notice-error"><p>App Store ID must be numbers only.</p></div>';
        }
    }
    $current = itc_ess_get_app_store_id();
    ?>
    <div class="wrap">
        <h1>Inthecircle Site Essentials</h1>
        <p>This plugin replaces the old “Inthecircle SEO Enhancements” plugin. It does <strong>not</strong> output any top promo or sticky header.</p>
        <form method="post">
            <?php wp_nonce_field('itc_ess_settings'); ?>
            <table class="form-table">
                <tr>
                    <th><label for="itc_ess_app_store_id">App Store ID</label></th>
                    <td>
                        <input type="text" id="itc_ess_app_store_id" name="itc_ess_app_store_id" value="<?php echo esc_attr($current); ?>" class="regular-text" placeholder="6758384054">
                        <p class="description">Uses the same database option as the legacy plugin (<code>itc_seo_app_store_id</code>), so your ID is preserved when you switch.</p>
                        <p><a href="https://apps.apple.com/app/in-the-circle/id<?php echo esc_attr($current); ?>" target="_blank" rel="noopener">Open App Store link</a></p>
                    </td>
                </tr>
            </table>
            <p class="submit"><input type="submit" name="itc_ess_save" class="button button-primary" value="Save Settings"></p>
        </form>
        <hr>
        <h2>AIOSEO focus keywords (Lite)</h2>
        <p>Supplies focus keyphrases for TruSEO when empty. <a href="<?php echo esc_url(wp_nonce_url(admin_url('options-general.php?page=itc-site-essentials&itc_ess_bulk_keywords=1'), 'itc_ess_bulk_keywords')); ?>" class="button">Set focus keywords for all published posts</a></p>
        <?php
        if (isset($_GET['itc_ess_keywords_done'])) {
            $n = (int) $_GET['itc_ess_keywords_done'];
            $direct = isset($_GET['itc_ess_keywords_direct']) ? (int) $_GET['itc_ess_keywords_direct'] : 0;
            echo '<div class="notice notice-success"><p>Processed ' . (int) $n . ' posts';
            if ($direct > 0) {
                echo '; direct DB writes: ' . (int) $direct;
            }
            echo '. Refresh <a href="' . esc_url(admin_url('admin.php?page=aioseo')) . '">AIOSEO</a>.</p></div>';
        }
        ?>
    </div>
    <?php
}

function itc_ess_blog_setup_once() {
    if (get_option('itc_ess_blog_setup_done') || get_option('itc_seo_blog_setup_done')) {
        return;
    }
    $slug = 'blog';
    $page = get_page_by_path($slug, OBJECT, 'page');
    if (!$page) {
        $page_id = wp_insert_post([
            'post_title' => 'Blog',
            'post_name' => $slug,
            'post_status' => 'publish',
            'post_type' => 'page',
            'post_content' => '<p>Latest updates and articles from inthecircle.</p>',
        ]);
        if (is_wp_error($page_id)) {
            return;
        }
    } else {
        $page_id = (int) $page->ID;
    }
    update_option('page_for_posts', $page_id);
    update_option('itc_ess_blog_setup_done', 1);
}
add_action('init', 'itc_ess_blog_setup_once', 5);

function itc_ess_add_blog_menu_item($items, $args) {
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
    $blog_link = '<li class="menu-item menu-item-type-post_type menu-item-itc-ess-blog"><a href="' . esc_url($blog_url) . '">Blog</a></li>';
    return $items . $blog_link;
}
add_filter('wp_nav_menu_items', 'itc_ess_add_blog_menu_item', 10, 2);

function itc_ess_inject_blog_link_js() {
    $page_for_posts = get_option('page_for_posts');
    $blog_url = $page_for_posts ? get_permalink($page_for_posts) : home_url('/blog/');
    if (!$blog_url) {
        $blog_url = home_url('/');
    }
    ?>
    <script>
    (function(){
        var blogUrl = <?php echo wp_json_encode(esc_url($blog_url)); ?>;
        function inject() {
            if (document.querySelector('.itc-ess-blog-injected')) return;
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
                item.className = 'menu-item itc-ess-blog-injected';
                var a = document.createElement('a');
                a.href = blogUrl;
                a.textContent = 'Blog';
                item.appendChild(a);
                container.appendChild(item);
            }
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
        else inject();
        setTimeout(inject, 800);
    })();
    </script>
    <?php
}
add_action('wp_footer', 'itc_ess_inject_blog_link_js', 8);

function itc_ess_footer_internal_links() {
    if (!is_front_page()) {
        return;
    }
    $about = esc_url(home_url('/about/'));
    $faq = esc_url(home_url('/faq/'));
    ?>
    <script>
    (function(){
        if (document.querySelector('.itc-ess-links')) return;
        var firstH2 = document.querySelector('main h2, .entry-content h2, article h2, [role="main"] h2, body h2');
        if (!firstH2) return;
        var p = document.createElement('p');
        p.className = 'itc-ess-links';
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
add_action('wp_footer', 'itc_ess_footer_internal_links', 5);

function itc_ess_security_headers() {
    if (headers_sent()) {
        return;
    }
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');
    }
}
add_action('send_headers', 'itc_ess_security_headers');

function itc_ess_404_page() {
    if (!is_404()) {
        return;
    }
    $home = esc_url(home_url('/'));
    $faq = esc_url(home_url('/faq/'));
    $html = '<div class="itc-ess-404" style="text-align:center;padding:4rem 2rem;max-width:600px;margin:0 auto;font-family:system-ui,sans-serif;"><h1 style="font-size:2.5rem;margin-bottom:1rem;">Page Not Found</h1><p style="font-size:1.1rem;color:#666;margin-bottom:2rem;">The page you\'re looking for doesn\'t exist or has been moved.</p><p><a href="' . $home . '" style="display:inline-block;padding:0.75rem 1.5rem;background:#000;color:#fff;text-decoration:none;border-radius:6px;margin-right:0.5rem;">Back to Home</a> <a href="' . $faq . '" style="display:inline-block;padding:0.75rem 1.5rem;border:1px solid #000;color:#000;text-decoration:none;border-radius:6px;">See FAQ</a></p></div>';
    ?>
    <script>
    (function(){
        var main = document.querySelector('main, .content, .entry-content, #content, [role="main"], .site-main');
        if (main) main.innerHTML = <?php echo wp_json_encode($html); ?>;
    })();
    </script>
    <?php
}
add_action('wp_footer', 'itc_ess_404_page', 1);

function itc_ess_document_title_parts($parts) {
    if (is_404()) {
        return ['title' => 'Page Not Found', 'page' => '', 'tagline' => 'Inthecircle'];
    }
    if (!itc_ess_should_override_aioseo_meta()) {
        if (is_array($parts)) {
            foreach ($parts as $k => $v) {
                if (is_string($v)) {
                    $parts[$k] = itc_ess_normalize_brand_copy($v);
                }
            }
        }
        return $parts;
    }
    $data = itc_ess_get_current_data();
    if (!empty($data['title'])) {
        return ['title' => itc_ess_normalize_brand_copy($data['title']), 'page' => '', 'tagline' => ''];
    }
    return $parts;
}
add_filter('document_title_parts', 'itc_ess_document_title_parts', 999);

function itc_ess_ga4_conversions() {
    ?>
    <script>
    (function(){
        function fireEvent(name, params) {
            if (typeof gtag === 'function') gtag('event', name, params || {});
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
add_action('wp_footer', 'itc_ess_ga4_conversions', 25);

function itc_ess_blog_filter_by_lang($query) {
    if (!is_admin() && $query->is_main_query() && is_home()) {
        $lang = isset($_GET['lang']) ? sanitize_text_field(wp_unslash($_GET['lang'])) : '';
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
add_action('pre_get_posts', 'itc_ess_blog_filter_by_lang', 10, 1);

function itc_ess_blog_lang_filter_bar() {
    if (!is_home()) {
        return;
    }
    $blog_url = get_permalink(get_option('page_for_posts')) ?: home_url('/blog/');
    if (!$blog_url) {
        $blog_url = home_url('/');
    }
    $current = isset($_GET['lang']) ? sanitize_text_field(wp_unslash($_GET['lang'])) : 'all';
    ?>
    <div id="itc-ess-blog-lang-filter" class="itc-ess-blog-lang-filter" role="navigation" aria-label="<?php esc_attr_e('Filter by language', 'default'); ?>" style="visibility:hidden;">
        <a href="<?php echo esc_url($blog_url); ?>" class="<?php echo $current === 'all' ? 'active' : ''; ?>"><?php esc_html_e('All', 'default'); ?></a>
        <a href="<?php echo esc_url(add_query_arg('lang', 'ar', $blog_url)); ?>" class="<?php echo $current === 'ar' ? 'active' : ''; ?>">عربي</a>
        <a href="<?php echo esc_url(add_query_arg('lang', 'en', $blog_url)); ?>" class="<?php echo $current === 'en' ? 'active' : ''; ?>"><?php esc_html_e('English', 'default'); ?></a>
    </div>
    <style>
    .itc-ess-blog-lang-filter{display:flex;gap:0.5rem;flex-wrap:wrap;padding:1rem 0 1.25rem;margin-bottom:0.5rem;border-bottom:1px solid #e8eaed}
    .itc-ess-blog-lang-filter a{display:inline-block;padding:0.5rem 1rem;border-radius:9999px;font-size:0.875rem;font-weight:500;text-decoration:none;color:#64748b;background:#f1f5f9}
    .itc-ess-blog-lang-filter a.active{color:#fff;background:#0f172a}
    .blog .wp-block-query-pagination:not(.itc-ess-pagination-moved),.home .wp-block-query-pagination:not(.itc-ess-pagination-moved),.itc-blog-index .wp-block-query-pagination:not(.itc-ess-pagination-moved){opacity:0!important;pointer-events:none!important;position:absolute!important;left:-9999px!important}
    .blog main .wp-block-query-pagination.itc-ess-pagination-moved,.home main .wp-block-query-pagination.itc-ess-pagination-moved,.itc-blog-index main .wp-block-query-pagination.itc-ess-pagination-moved{opacity:1!important;margin-top:48px!important;display:flex!important;justify-content:center!important;flex-wrap:wrap!important}
    </style>
    <script>
    (function(){
        var bar = document.getElementById('itc-ess-blog-lang-filter');
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
            if (queryBlock && pagination.parentNode !== queryBlock) queryBlock.appendChild(pagination);
            else if (pagination.parentNode !== main) main.appendChild(pagination);
            pagination.classList.add('itc-ess-pagination-moved');
        }
        function run(){ movePagination(); setTimeout(movePagination, 200); setTimeout(movePagination, 800); }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
        else run();
        window.addEventListener('load', movePagination);
    })();
    </script>
    <?php
}
add_action('wp_footer', 'itc_ess_blog_lang_filter_bar', 2);

function itc_ess_body_class_blog($classes) {
    if (is_home() && !is_front_page()) {
        $classes[] = 'itc-blog-index';
    }
    if (is_singular('post')) {
        $classes[] = 'itc-single-post';
    }
    return $classes;
}
add_filter('body_class', 'itc_ess_body_class_blog', 20);

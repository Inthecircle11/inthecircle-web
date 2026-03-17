<?php
/**
 * Blog language filter – add this as a WPCode snippet (or paste into your theme/plugin).
 * In WPCode: Add Snippet → PHP Snippet → paste this entire file → Run everywhere → Activate.
 */

if (!defined('ABSPATH')) exit;

add_action('pre_get_posts', function ($query) {
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
}, 10, 1);

add_action('wp_footer', function () {
    if (!is_home()) return;
    $blog_url = get_permalink(get_option('page_for_posts')) ?: home_url('/blog/');
    if (!$blog_url) $blog_url = home_url('/');
    $current = isset($_GET['lang']) ? sanitize_text_field($_GET['lang']) : 'all';
    ?>
    <div id="itc-blog-lang-filter" class="itc-blog-lang-filter" role="navigation" aria-label="Filter by language" style="visibility:hidden;">
        <span class="itc-blog-lang-filter-label">Language</span>
        <div class="itc-blog-lang-filter-tabs">
            <a href="<?php echo esc_url($blog_url); ?>" class="itc-blog-lang-filter-tab <?php echo $current === 'all' ? 'active' : ''; ?>">All</a>
            <a href="<?php echo esc_url(add_query_arg('lang', 'ar', $blog_url)); ?>" class="itc-blog-lang-filter-tab <?php echo $current === 'ar' ? 'active' : ''; ?>">عربي</a>
            <a href="<?php echo esc_url(add_query_arg('lang', 'en', $blog_url)); ?>" class="itc-blog-lang-filter-tab <?php echo $current === 'en' ? 'active' : ''; ?>">English</a>
        </div>
    </div>
    <style id="itc-seo-lang-filter-css">
    .itc-blog-lang-filter { display: flex; align-items: center; justify-content: center; gap: 0.75rem; flex-wrap: wrap; padding: 1rem 0 1.5rem; margin-bottom: 0.5rem; border-bottom: 1px solid rgba(148,163,184,0.2); }
    .itc-blog-lang-filter-label { font-size: 0.8125rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; }
    .itc-blog-lang-filter-tabs { display: inline-flex; background: rgba(15,23,42,0.5); border-radius: 10px; padding: 4px; gap: 2px; border: 1px solid rgba(148,163,184,0.2); }
    .itc-blog-lang-filter-tab { display: inline-block; padding: 0.5rem 1.25rem; border-radius: 8px; font-size: 0.9375rem; font-weight: 500; text-decoration: none; color: #cbd5e1; transition: color 0.2s, background 0.2s; }
    .itc-blog-lang-filter-tab:hover { color: #f1f5f9; background: rgba(148,163,184,0.15); }
    .itc-blog-lang-filter-tab.active { color: #fff; background: #6366f1; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
    </style>
    <script>
    (function(){
        var bar = document.getElementById('itc-blog-lang-filter');
        if (!bar) return;
        var main = document.querySelector('.blog main, .itc-blog-index main, .home main, [role="main"]');
        if (main) { main.insertBefore(bar, main.firstChild); bar.style.visibility = 'visible'; }
        else bar.style.visibility = 'visible';
    })();
    </script>
    <?php
}, 2);

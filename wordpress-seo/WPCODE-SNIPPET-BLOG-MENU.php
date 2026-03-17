<?php
/**
 * WPCode snippet: Add "Blog" to the header menu.
 * In WordPress: WPCode → Add Snippet → PHP Snippet → paste this → Activate.
 * Or: Appearance → Theme File Editor / Plugin File Editor won't help; use WPCode or upload the updated inthecircle-seo plugin.
 */

add_action('wp_footer', function() {
    $blog_url = get_option('page_for_posts') ? get_permalink(get_option('page_for_posts')) : home_url('/blog/');
    if (! $blog_url) $blog_url = home_url('/');
    ?>
    <script>
    (function(){
        var blogUrl = <?php echo json_encode(esc_url($blog_url)); ?>;
        if (document.querySelector('.itc-blog-injected')) return;
        var nav = document.querySelector('header nav, header [class*="menu"], header [class*="nav"], .header nav, nav');
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
            a.textContent = 'BLOG';
            item.appendChild(a);
            container.appendChild(item);
        }
    })();
    </script>
    <?php
}, 8);

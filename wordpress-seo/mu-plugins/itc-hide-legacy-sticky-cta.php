<?php
/**
 * Plugin Name: ITC Hide legacy sticky CTA (mu-plugin)
 * Description: Ensures #itc-sticky-cta never shows even if the main SEO plugin file is OPcache-stale after deploy.
 * Version: 1.0.0
 */
if (!defined('ABSPATH')) {
    exit;
}

add_action(
    'wp_head',
    static function () {
        echo '<style id="itc-mu-hide-legacy-sticky-cta">#itc-sticky-cta{display:none!important;visibility:hidden!important;height:0!important;max-height:0!important;overflow:hidden!important;padding:0!important;margin:0!important;border:0!important;pointer-events:none!important;}</style>' . "\n";
    },
    0
);

add_action(
    'wp_footer',
    static function () {
        echo '<script id="itc-mu-remove-legacy-sticky-cta">(function(){var e=document.getElementById("itc-sticky-cta");if(e)e.remove();})();</script>' . "\n";
    },
    0
);

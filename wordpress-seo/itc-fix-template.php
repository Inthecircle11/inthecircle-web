<?php
/**
 * One-shot: delete the custom Front Page template from DB so WordPress uses
 * themes/extendable/templates/front-page.html. DELETE THIS FILE after running.
 */
if (!isset($_GET['token']) || $_GET['token'] !== 'itc2026fix') {
    die('Not found.');
}
define('ABSPATH_CHECK', true);
require_once dirname(__FILE__) . '/wp-load.php';
global $wpdb;
$ids = $wpdb->get_col(
    "SELECT ID FROM {$wpdb->posts} WHERE post_type = 'wp_template' AND (post_name LIKE '%front-page%' OR post_name LIKE '%front_page%')"
);
header('Content-Type: text/plain; charset=utf-8');
if (empty($ids)) {
    echo "No custom Front Page template in DB. Site should already use the theme file.\n";
    exit;
}
foreach ($ids as $id) {
    wp_delete_post((int) $id, true);
    echo "Deleted template ID $id. Front page will now use front-page.html from theme.\n";
}
echo "\nDone. Delete this file: public_html/itc-fix-template.php\n";

<?php
/**
 * Server-side fix: move pagination to end of query block (blog index only).
 * This runs in PHP before anything reaches the browser — no JS needed.
 */
add_filter( 'render_block', function ( $block_content, $block ) {
    if ( $block['blockName'] !== 'core/query' ) {
        return $block_content;
    }
    if ( ! is_home() && ! is_front_page() ) {
        return $block_content;
    }

    // Find the pagination element (WordPress renders it as a nav.wp-block-query-pagination)
    $pattern = '/(<(?:nav|div)[^>]*class="[^"]*wp-block-query-pagination[^"]*"[^>]*>[\s\S]*?<\/(?:nav|div)>)/i';
    if ( ! preg_match( $pattern, $block_content, $matches ) ) {
        return $block_content;
    }

    $pagination = $matches[0];

    // Remove pagination from where it currently is
    $content = str_replace( $pagination, '', $block_content );

    // Append pagination just before the last closing </div> of the query block
    $content = preg_replace( '/(<\/div>\s*)$/', "\n" . $pagination . "\n$1", $content );

    return $content ?: $block_content;
}, 10, 2 );

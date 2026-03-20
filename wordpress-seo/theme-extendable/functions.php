<?php
/**
 * Extendable theme: enqueue hide-chrome.css so default header/footer
 * are hidden on ITC custom pages (page-itc-landing template or .itc-page / .itc-legal).
 */
add_action( 'wp_enqueue_scripts', function () {
	$uri = get_stylesheet_directory_uri() . '/hide-chrome.css';
	$path = get_stylesheet_directory() . '/hide-chrome.css';
	if ( file_exists( $path ) ) {
		wp_enqueue_style( 'extendable-hide-chrome', $uri, array(), filemtime( $path ) );
	}
}, 10 );

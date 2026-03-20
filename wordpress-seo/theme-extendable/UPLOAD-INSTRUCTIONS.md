# Upload ITC Landing to Live WordPress

The "Home v2" page is already created and set as the front page. This is a **page template** (it uses your theme’s header/footer), so it must live inside your **active theme** folder, not in a separate “extendable” theme.

## 1. Find your active theme

In WordPress: **Appearance → Themes**. Note the **active theme name** (e.g. Twenty Twenty-Four, Astra, Kadence). The folder name is usually lowercase, no spaces (e.g. `twentytwentyfour`, `astra`).

## 2. On the server, upload into that theme

Target path: **`wp-content/themes/<your-active-theme>/`** (replace with your theme folder name).

1. **Template and assets**
   - **Local:** `page-itc-landing.php` → **Server:** `wp-content/themes/<your-active-theme>/page-itc-landing.php`
   - **Local:** `hide-chrome.css` → **Server:** `wp-content/themes/<your-active-theme>/hide-chrome.css`
   - **Local:** `functions.php` → **Server:** `wp-content/themes/<your-active-theme>/functions.php`  
     **If the theme already has a `functions.php`:** do not overwrite it; add this at the end of the existing file:
     ```php
     add_action( 'wp_enqueue_scripts', function () {
       $uri = get_stylesheet_directory_uri() . '/hide-chrome.css';
       $path = get_stylesheet_directory() . '/hide-chrome.css';
       if ( file_exists( $path ) ) {
         wp_enqueue_style( 'extendable-hide-chrome', $uri, array(), filemtime( $path ) );
       }
     }, 10 );
     ```

2. **One folder**
   - **Local:** `assets/images/` (all 9 PNGs)
   - **Server:** `wp-content/themes/<your-active-theme>/assets/images/`
   - Create `assets` and `assets/images` inside the theme folder if they don’t exist, then upload the 9 `itc-landing-*.png` files into `assets/images/`.

## How to upload

### Option A: Script (if you have SSH/SCP)

1. Copy `wordpress-seo/.env.sftp.example` to `wordpress-seo/.env.sftp`.
2. Set `WP_SFTP_HOST`, `WP_SFTP_USER`, and (if needed) `WP_SFTP_REMOTE_PATH`, `WP_SFTP_KEY`.
3. From project root:
   ```bash
   cd wordpress-seo && node scripts/upload-itc-landing-sftp.mjs
   ```

### Option B: SFTP client (FileZilla, Cyberduck, etc.)

1. Connect to your host.
2. Go to `wp-content/themes/<your-active-theme>/` (e.g. twentytwentyfour).
3. Upload `page-itc-landing.php` into that folder.
4. Create `assets/images/` under the theme folder if missing, then upload all files from local `theme-extendable/assets/images/` into `assets/images/`.

### Option C: Host File Manager / cPanel

1. Open File Manager and go to `wp-content/themes/`.
2. Open the folder of your **active theme** (the one shown in Appearance → Themes).
3. Upload `page-itc-landing.php` there.
4. Create folders `assets` and `assets/images` if needed, then upload the 9 PNGs into `assets/images/`.

## After uploading

- Hard refresh the homepage (Ctrl+F5 or Cmd+Shift+R), or open https://inthecircle.co/ in a private window.
- You should see the full ITC landing (hero, sections, styling). If not, confirm the template was uploaded into your **active theme** folder and that the page uses the **ITC Home v2** template.

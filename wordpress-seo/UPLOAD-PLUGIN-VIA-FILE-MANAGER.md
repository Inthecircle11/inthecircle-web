# Update the plugin via WordPress File Manager

Use your **WordPress File Manager** plugin to replace the SEO plugin file so the latest changes (e.g. LCP preload, `fetchpriority`) are live.

## Steps

1. **In WordPress admin** go to the File Manager (e.g. **WP File Manager** or **File Manager** in the sidebar).

2. **Navigate to the plugin folder:**
   - Open `wp-content` → `plugins` → **wordpress-seo**  
   - (If your plugin folder has a different name, open that one.)

3. **Replace the PHP file:**
   - Find **`inthecircle-seo-enhancements.php`**.
   - Either:
     - **Option A:** Delete the existing file, then use **Upload** and choose the file from your Mac:  
       `Inthecircle/wordpress-seo/inthecircle-seo-enhancements.php`
     - **Option B:** Click **Edit** on `inthecircle-seo-enhancements.php`, select all, delete, then paste the full contents of the updated file from your project and **Save**.

4. **Done.** The plugin is already active; no need to reactivate. Clear any cache (hosting/CDN/plugin) if you use one, then check the site.

## Path on server

```
wp-content/plugins/wordpress-seo/inthecircle-seo-enhancements.php
```

## Path on your Mac

```
Inthecircle/wordpress-seo/inthecircle-seo-enhancements.php
```

If your File Manager has an **Upload** that accepts a file from your computer, use Option A. If it only has an editor, use Option B and paste the contents of the file from your project.

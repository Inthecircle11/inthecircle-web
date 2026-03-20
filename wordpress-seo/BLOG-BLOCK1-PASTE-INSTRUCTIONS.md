# Paste Block 1 into the Blog template (pagination fix)

The Cursor browser was used but the WordPress block editor re-renders the code view, so the textarea ref went stale and the automated paste could not complete. Do this manually (takes ~1 minute):

## Steps

1. **Open the Blog template in WordPress**
   - Go to **Appearance → Editor** (Site Editor).
   - Open the template used for the blog (e.g. **Home** or **Blog**).
   - Switch to **Code editor** (three-dots menu → **Code editor**).

2. **Replace the first Custom HTML block**
   - In the code view you’ll see something like:
     ```
     <!-- wp:html -->
     ... first block content ...
     <!-- /wp:html -->

     <!-- wp:group ... -->
     ... rest of template ...
     ```
   - Select from the **first** `<!-- wp:html -->` through the first `<!-- /wp:html -->` (including those lines).

3. **Paste the new Block 1**
   - Open in your editor: **wordpress-seo/theme-extendable/templates/block1-for-blog-template.html** (in this repo)
   - Copy the entire file contents (Ctrl+A / Cmd+A, then Ctrl+C / Cmd+C).
   - In the WordPress code editor, paste over the selection from step 2 (so the first block is replaced by the new Block 1).

4. **Save**
   - Click **Save** (or **Update**).
   - Hard-refresh the blog: https://inthecircle.co/blog/

Pagination (1, 2, 3, 4 and “Next Page”) should then appear at the bottom of the posts, before the footer.

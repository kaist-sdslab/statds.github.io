# Statistical Data Science Lab website

KAIST SDS Lab website, built with Hugo and published by GitHub Actions.

- Website: https://kaist-sdslab.github.io/statds.github.io/
- Content manager: https://kaist-sdslab.github.io/statds.github.io/admin/

## Editing in the CMS

- **Pages → Home:** edit the introduction and research-button label, the photo slideshow, and the News list labels/count. The desktop photo and introduction areas use a 2:1 width ratio. The hero has a gap below the navigation and displays photos without a title/date overlay. The photo and introduction are separate areas with a gap; introduction text has an opaque white background. The research button opens About → Research Areas. The full-width list below the introduction shows up to 10 News posts by default, pinned first. Change the count (1–30) under Home → News list below introduction; the list has no fixed height or internal scrollbar. The slideshow automatically uses the newest published posts with cover images (five slides, five seconds per slide by default). Posts without images are still listed in News.
- **Pages → About:** edit the research descriptions, illustrations, colors, and related publication topics moved from Home. The visible page starts with Research Areas; the saved title and description are retained for browser/search metadata.
- **Students:** edit member profiles, portraits, Self-introduction text (available below Name for every profile), research-area tags, and optional LinkedIn, GitHub, and Website URLs. Compact member cards show research tags beside the photo and the introduction below the header. The email icon opens a floating address panel without changing card height. Leave a URL empty to hide its icon. The icon row reserves the same height even when all links are empty. Members, Interns, and Alumni remain separate categories.
- **News → New News post:** enter a title, date, and the article body. Choose a body image as the cover using its Cover checkbox. News posts do not use a separate summary. The visual body editor supports headings, links, lists, font settings, and inline images. Existing Markdown is imported on opening. Use **Pin to top** for announcements and **Show in home slideshow** to control cover-image inclusion. Posts are ordered newest first within pinned and regular groups.
- **Pages → News:** edit the list title, labels, and number of stories per page. The public list has pagination without a search field.
- **Site Settings → General & Navigation:** edit the header, footer, and navigation labels. Courses is no longer included in the navigation or CMS.

Save and publish an entry to commit it to this repository; GitHub Actions then updates the website. Drafts and future-dated posts are excluded from the published site. A future-dated post becomes visible on the next build after its date, so run the deployment workflow if no other edits trigger a build.

## News article formatting

The News **Body** is a direct visual editor. Type and select text in the document itself, then use Left/Center/Right/Justify in its toolbar. No nested text-input blocks are needed.

- Use **Image** to choose or upload a picture through the CMS Media Library.
- Select an image and check **Cover** to use it in News thumbnails and the Home slideshow. Only one body image can be the cover. Earlier separate cover images are imported into the body when opening older posts.
- Click an image to show Cover and width controls. Drag its corner handle to resize directly in the input area. Caption and Alt fields are not shown; existing alternative text is retained in stored images.
- Drag a picture (or its top-left grip on a touch screen). A blue drop guide shows the result: beside another picture creates/reorders an image row; the left/right edge of a paragraph wraps text beside the image; above/below a block creates a standalone image. Drag a picture out of a row to split it off. Escape cancels a drag.
- Row groups and text wrapping remain in place on mobile. Row images share the available width; resizing one redistributes the remaining space. Undo/Redo restores each drop. On the move grip, arrow up/down moves a picture and left/right groups it with a neighboring picture.
- Select text to set its size (10–72 px), color, heading level (1–6), alignment, or line spacing. Font size applies to the input and Preview as soon as a valid value is entered; with no text selected it formats the current paragraph. Font-family selection is omitted. Image percentage/pixel fields apply on blur; the slider and resize handle apply directly.
- **Link** opens URL and display-text fields. Applying with no selected text inserts a visible link immediately.
- Existing Markdown and the earlier image/alignment blocks are imported into the visual editor. The saved body uses a structured `news-content` shortcode so Hugo can render formatting without enabling arbitrary HTML.
- Existing unsupported shortcodes are preserved in a source fallback rather than silently discarded.

The editor is served locally from the repository. Rebuild the vendor bundle after changing `assets/editor/news-editor.js` with `npm ci && npm run build:news-editor` (Node 22.12+). Normal Hugo/Pages deployment uses the committed bundle and requires no npm install.

## Local build

Use Hugo Extended 0.135.0 (matching `.github/workflows/publish.yaml`):

```sh
hugo server
hugo --minify --gc --environment production
```

The production CMS uses the lab's Cloudflare Worker for GitHub OAuth. Its public configuration is in `integrations/cloudflare/wrangler.toml`; OAuth secrets belong only in Cloudflare Variables and Secrets.

The locally bundled editor uses Tiptap, ProseMirror and markdown-it under their open-source licenses; see `static/vendor/news-editor-LICENSE.txt`.

Public pages load one minified CSS bundle and one minified JavaScript bundle per page. Editor dependencies load only in `/admin/`. News photos use WebP and responsive source sizes; the first Home photo gets high fetch priority. Home entry and carousel transitions use opacity/transform only and respect reduced-motion preferences.

`node_modules/` contains local build/test dependencies (Tiptap, esbuild, jsdom, etc.). It is ignored by Git and excluded from the Hugo output. It can be regenerated with `npm ci`; normal Pages builds and site visitors use only the committed minified editor bundle, not this folder.

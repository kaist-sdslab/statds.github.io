# Statistical Data Science Lab website

KAIST SDS Lab website, built with Hugo and published by GitHub Actions.

- Website: https://kaist-sdslab.github.io/statds.github.io/
- Content manager: https://kaist-sdslab.github.io/statds.github.io/admin/

## Editing in the CMS

- **Pages → Home:** edit the introduction and research-button label, the background photo slideshow, and the News list labels. The desktop photo and introduction areas use a 2:1 width ratio. The hero starts directly beneath the navigation and displays photos without a title/date overlay. Photos fill the compact hero; the introduction occupies a full-height, 70%-opacity blue-gray panel flush with the right edge. The research button opens About → Research Areas. The list below the introduction shows only the top five News posts, including pinned posts first. The slideshow automatically uses the newest published posts with cover images (five slides, five seconds per slide by default). Posts without images are still listed in News.
- **Pages → About / Research Areas:** edit the research descriptions, illustrations, colors, and related publication topics moved from Home. The visible page starts with Research Areas; the saved title and description are retained for browser/search metadata.
- **Students:** edit member profiles, portraits, Self-introduction text (available below Name for every profile), and optional LinkedIn, GitHub, and Website URLs. Leave a URL empty to hide its icon. Members, Interns, and Alumni remain separate categories.
- **News → New News post:** enter a title, date, optional cover image, and the article body. News posts do not use a separate summary. The body editor supports Rich Text and Markdown, including headings, links, lists, and inline images. Use **Pin to top** for announcements and **Show in home slideshow** to control cover-image inclusion. Posts are ordered newest first within pinned and regular groups.
- **Pages → News page settings:** edit the list title, labels, and number of stories per page. The public list has pagination without a search field.
- **Site Settings → General & Navigation:** edit the header, footer, and navigation labels. Courses is no longer included in the navigation or CMS.

Save and publish an entry to commit it to this repository; GitHub Actions then updates the website. Drafts and future-dated posts are excluded from the published site. A future-dated post becomes visible on the next build after its date, so run the deployment workflow if no other edits trigger a build.

## News article formatting

- Set **Body alignment** to Left, Center, Right, or Justified for the whole article.
- In the Body editor's **+** menu, choose **Image with layout** to insert an image with width (10–100%), optional maximum pixel width, left/center/right position, and caption. Enable text wrapping to place article text beside left/right images on desktop; mobile places the text below the image.
- Choose **Aligned text** from the same menu to format individual text sections independently. The block supports normal Markdown formatting and standard images. Insert images needing their own layout as separate **Image with layout** blocks.
- Click an inserted component in Rich Text mode to edit its settings again. Existing plain Markdown text and images remain supported. These controls format inline article images; the News cover image remains a separate field.

Run the editor serialization checks with `node tests/news-editor.test.cjs`.

## Local build

Use Hugo Extended 0.135.0 (matching `.github/workflows/publish.yaml`):

```sh
hugo server
hugo --minify --gc --environment production
```

The production CMS uses the lab's Cloudflare Worker for GitHub OAuth. Its public configuration is in `integrations/cloudflare/wrangler.toml`; OAuth secrets belong only in Cloudflare Variables and Secrets.

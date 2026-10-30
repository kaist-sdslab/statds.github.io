# Statistical Data Science Lab website

Custom Hugo website for SDS Lab at KAIST. The public site uses local layouts,
CSS, and JavaScript, without a theme or Hugo module dependencies.

## Local development

Use Hugo Extended 0.135.0 (the version used by GitHub Actions):

```sh
hugo server --disableFastRender
```

A checkout-local executable, when available, can be used as
`.tools/hugo/hugo server --disableFastRender`. Open http://localhost:1313/.

## Structure

- `content/_index.md`: Home introduction, research areas, and footer address.
- `content/professors/`: professor profile, interests, education, experience, and editorial service.
- `content/publications/`: searchable publication index, individual records, and eight fictional demo papers.
- `content/people/`: page title using a shared preparation page.
- `data/publication_topics.yaml`: editable topic IDs and display names.
- `assets/media/people/`: professor photographs and source notes.
- `assets/media/research/`: original lab research illustrations and source notes.
- `assets/css/home.css`: shared site styles and responsive layouts.
- `assets/css/professors.css`, `layouts/_default/professors.html`: professor page styles and layout.
- `assets/js/home.js`: optional Home fade-in effects, with reduced-motion support.
- `assets/css/publications.css`, `assets/js/publications.js`: publication layout, search, filters and sorting.
- `layouts/partials/publications/`: shared record normalization and article presentation.
- `layouts/index.html`: Home layout.
- `layouts/partials/site/`: shared document, navigation, footer, and preparation page.
- `layouts/_default/`: fallback page layouts; `layouts/404.html`: missing-page layout.
- `config/_default/menus.yaml`: navigation links and ordering.
- `config/_default/hugo.yaml`: site URL, outputs, and image settings.
- `content/admin/`, `layouts/cms/`, `data/cms.yaml`: independent Decap CMS entry point
  and form definitions for the current content.

## CMS status

`/admin/` remains available. Its forms match Home, Professors and Publications.
People currently exposes only its title. Home image fields use resource paths
such as `media/research/transfer-learning.png`; professor photographs use
`media/people/jeongyoun-ahn.jpg`.

The existing Git Gateway authentication setup is retained. Hosted sign-in and
saving still require backend/authentication configuration; this cleanup does
not configure an authentication service. In development, the generated CMS
configuration enables the local backend, which requires a separate Decap proxy.
The public website does not require the CMS scripts to load.

## Build and deployment

```sh
hugo --minify
```

GitHub Actions builds `public/` and deploys it to GitHub Pages on pushes to
`main`. `.tools/`, `public/`, `resources/`, and editor databases are local or
generated files, excluded from version control. The configured default base URL
uses a repository subdirectory; Actions supplies the actual Pages base URL.

The original starter's MIT license notice is retained in `LICENSE.md`.

## Publications demo and editing

All eight `content/publications/demo-*.md` records are fictional. Each is visibly
marked as Demo on the index and its detail page. No real lab publications have
been imported. Remove the demo files when replacing the demonstration with real
records; new CMS entries default to `demo: false`.

In CMS, use **Publications** to add a record. Titles, ordered authors, type,
year, venue, volume/issue/pages or short notes, and optional resource links have
separate fields. Each record has its own detail page. Records use the year for
chronological sorting. The compact list does not include abstracts, submission
history, status badges, or selected-paper features.

Use **Settings → Publication Topics** to create topic IDs and display names.
Then select one or more topics on a publication. Display names can be changed
without changing the IDs already referenced by papers. IDs must be unique;
do not rename or remove an ID while papers still reference it. Topic filters
are generated from this registry on build.

Search matches all entered words across title, authors, venue and topic labels.
Type and year filters are combined with AND; multiple selected topics use OR.
Filter state is stored in URL parameters for sharing and restored on load.
Sorting supports newest/oldest year and title. Without JavaScript, every record
remains readable. All demo records are fictional and visibly labeled.

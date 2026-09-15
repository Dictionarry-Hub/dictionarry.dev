# SEO

Notes on how the site handles SEO through static generation.

## Pre-rendering

The entire site is pre-rendered via adapter-static. A single layout file enables this globally:

```ts
// src/routes/+layout.server.ts
export const prerender = true;
```

All data fetching and transformation happens in `+page.server.ts` load functions. These run at build
time, not in the browser. The output is plain HTML with all content baked in. No JavaScript is
required for crawlers to see the content.

The rule: if a crawler needs to see it, it goes in the server load function. Anything in `onMount`
or client-side fetch is invisible to crawlers.

### Navigation fetched at view time

The sidebar's PCD entity names are not in the prerendered HTML. The root layout fetches
`/pcd/{database}/nav.json` after mount and fills the groups in. Crawlers never saw those names as
links anyway (groups render collapsed), and every entity page is reachable through its list page,
which is prerendered with a link to each entity. Keeping the index out of page data saves about 55
KB on each of the 4,500 PCD pages. Without JavaScript the sidebar shows the seven group links and
the list pages still work.

### Locale-dependent text

Pre-rendered HTML carries whatever the build machine produced. Text that depends on the visitor's
locale, such as `DateTime` in its `numeric` format, is rendered once at build time with the build
machine's locale and then patched by Svelte during hydration to match the visitor. Crawlers see the
build machine's version, which is why any such element must also expose a locale-independent value:
`DateTime` always sets an ISO `datetime` attribute. Keep locale-dependent formatting out of titles,
descriptions, and other metadata, which are never re-rendered.

## Dynamic Routes

Routes with parameters (e.g. `/wiki/[slug]`) need SvelteKit to know which pages to generate. Two
options:

- If the pages are linked from a pre-rendered index page, SvelteKit's crawler discovers them
  automatically.
- If not linked from anywhere, export an `entries()` function in `+page.server.ts` that returns all
  valid parameter values.

Links rendered only after client interaction, such as items inside a collapsed navigation group, are
not visible to the prerender crawler. These routes must use explicit entries. CI compares the
compiled PCD navigation data with the generated HTML so missing pages fail lint.

## Meta Tags

All meta tags are rendered by the `SEO` component (`src/lib/client/ui/utils/SEO.svelte`). Every page
must use it. The component handles the canonical URL, `<title>`, description, theme-color, Open
Graph, and Twitter Card tags via `<svelte:head>`. Canonical URLs use the public site origin and the
current pathname, excluding query parameters and fragments.

The public origin comes from the build-time `PUBLIC_SITE_URL` environment variable. Development
defaults to `http://localhost:5173` and accepts the same variable as an override. Production builds
require the variable and reject values that are not plain HTTP or HTTPS origins.

```svelte
<SEO
	title="Installation"
	description="How to install Profilarr." />
```

| Prop          | Type     | Required | Default                      |
| ------------- | -------- | -------- | ---------------------------- |
| `title`       | `string` | yes      |                              |
| `description` | `string` | no       | Site-wide default            |
| `image`       | `string` | no       | GitHub-hosted `icon.png` URL |

`app.html` contains only structural head elements (charset, viewport, favicon links, manifest).
Social and SEO meta tags live exclusively in the `SEO` component to avoid duplicates.

The `og:image` and `twitter:image` must be absolute URLs.

For mdsvex content, frontmatter provides the title and description. The layout component should
handle rendering the `SEO` component automatically so content authors only write frontmatter.

## Sitemap

`/sitemap.xml` is a prerendered route (`src/routes/sitemap.xml/+server.ts`) listing every HTML page:
the static pages, dev logs and wiki articles with their publish date as `lastmod`, and every PCD
list and entity page. Entity pages take `lastmod` from the history replay, the date of the last
commit that touched the entity, so crawlers re-fetch pages that actually changed. Artifact routes
(`.md`, `.yaml`, `.json`) are alternate representations and are not listed. `robots.txt` is also a
route so its `Sitemap:` line carries the configured site origin. Entry building lives in
`src/lib/shared/utils/seo/sitemap.ts` and the XML rendering in `src/lib/shared/utils/seo/xml.ts`.

## Validation

The custom `require-seo` lint rule verifies that every route renders metadata through either the
`SEO` component directly or the approved `ListPage` composition. Run it with:

```bash
pnpm lint:seo
```

The complete custom lint framework and its other project-specific checks are documented in
[Linting](../tooling/lint.md).

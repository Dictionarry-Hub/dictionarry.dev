# Content

Notes on the site's content layers and how data flows into pages.

## Content Types

The site has four content layers:

### Profilarr Documentation

Setup guides and user-facing documentation. Written as mdsvex markdown. Authored by hand.

### PCD Entity Browser

Browsable reference pages for PCD entities: quality profiles, custom formats, regular expressions,
delay profiles, and media management configs (naming, media settings, quality definitions). These
pages are generated at build time from PCD repositories.

Users select a database (e.g. Dictionarry, TRaSH, Dumpstarr) and browse its entities by type. The
database is part of the URL path (`/pcd/[database]/[entity-type]/[name]`) so every page is
independently crawlable.

Regular expression and custom format pages always render a Description section. When the source
entity has no description, the server load deterministically selects a type-specific fallback from
the entity name so prerendered output remains stable.

Custom format pages also list the quality profiles that score them. References resolve shared and
application-specific scoring into effective Radarr and Sonarr scores and appear in both HTML and
Markdown representations.

Every detail page ends with a History section: one row per commit that touched the entity (commit
link, change title, date), expandable to the field-level diff and links to the other entities
changed in the same commit. History is compiled from the PCD repo's op log by the pipeline (see
[tooling/pcd.md](../tooling/pcd.md#history)) and appears in both HTML and Markdown representations.

The expanded diff is a list of one-line summaries, not raw fields.
`src/lib/shared/utils/pcd/history-view.ts` has a presenter per change shape that matters (profile
scoring, custom format conditions, regex patterns, profile qualities, tags, quality definition
tiers, and scalar fields), each writing a sentence like "Release Group coffee added" with entity
names as inline code, linked to their pages when they still exist. Plain text fields (regex
patterns, naming formats) carry a word-level inline diff when the edit is small, and a side-by-side
before and after when more than half the text changed, since a rewrite has nothing readable to diff.
Markdown fields (descriptions) are diffed block by block and rendered as markdown: unchanged
paragraphs render as they are, added and removed blocks are marked whole, and a paragraph edited in
place gets word-level highlights. Shapes without a presenter fall back to a line diff of the changed
subtree rendered as YAML, the same YAML the entity export view uses. Changes that display
identically before and after (a tier max size moving between two unlimited values) are hidden.

Seven entity types are browsable:

| Entity Type         | Route segment         | Arr-specific |
| ------------------- | --------------------- | ------------ |
| Quality Profiles    | `quality-profiles`    | No           |
| Custom Formats      | `custom-formats`      | No           |
| Regular Expressions | `regex`               | No           |
| Delay Profiles      | `delay-profiles`      | No           |
| Naming              | `naming`              | Yes          |
| Media Settings      | `media-settings`      | Yes          |
| Quality Definitions | `quality-definitions` | Yes          |

Arr-specific entities include the arr type in the URL: `/pcd/[database]/naming/[arrType]/[name]`.

### API Reference

Auto-generated API documentation for the Profilarr REST API. The OpenAPI 3.1.0 spec is fetched at
build time from the Profilarr repo (`pnpm compile:api`) and rendered as a single page at `/api/v1`.

The page groups endpoints by tag, renders parameters, request/response schemas as JSON examples, and
generates code snippets in curl, Python, JavaScript/TypeScript, and C#. Adding an endpoint to the
OpenAPI spec automatically adds it to the docs on next build.

The spec JSON is output to `src/lib/data/api/v1.json` (gitignored). For pipeline implementation
details, see [tooling/api.md](../tooling/api.md).

### Dev Logs and Wiki Articles

Site-specific content written as mdsvex markdown. Dev logs cover releases and development progress.
Wiki articles cover broader topics.

Both layers share the same article frontmatter and render through the same mdsvex layout
(`src/lib/layouts/Article.svelte`, registered as both the `dev-logs` and `wiki` layout keys):

| Field     | Notes                                                          |
| --------- | -------------------------------------------------------------- |
| `layout`  | `dev-logs` or `wiki`                                           |
| `title`   | Display title                                                  |
| `slug`    | Matches the route directory name (which is what routes derive) |
| `blurb`   | Short description; SEO meta, search blurb, artifact preamble   |
| `author`  | GitHub profile URL (or list); rendered with avatar and link    |
| `created` | Publish date, used for newest-first sorting                    |
| `tags`    | Displayed as chips and indexed as search keywords              |

Articles live at `src/routes/dev-logs/<slug>/+page.svx` and `src/routes/wiki/<slug>/+page.svx`. The
sidebar nav, search index, and markdown artifact routes all glob these paths and derive the slug
from the directory name.

## PCD Pipeline

The PCD pipeline is a pre-build step (`pnpm compile:pcd`) that fetches PCD repositories, compiles
their SQL operations into SQLite, and extracts entity state as JSON. For implementation details, see
[tooling/pcd.md](../tooling/pcd.md).

The pipeline outputs three things:

1. **Per-database JSON** (`src/lib/data/pcd/{id}.json`) containing full entity data, typed as
   `CompiledDatabase` from `src/lib/types/pcd.ts`. Consumed by `+page.server.ts` load functions.

2. **Nav index** (`src/lib/data/pcd/index.json`) containing entity names per database. Drives the
   prerender entries and is served per database as `/pcd/{database}/nav.json`, which the root layout
   fetches at view time to fill the sidebar. The prerendered HTML carries only the seven group
   links, not the entity names: the index is navigation, not content, and baking it into every page
   cost about 55 KB per page across 4,500 pages.

3. **Per-database history** (`src/lib/data/pcd/history/{id}.json`) containing each entity's change
   log. Consumed by `src/lib/shared/utils/pcd/history-data.ts` for the detail pages and markdown
   artifacts. Skipped with `pnpm compile:pcd -- --no-history`.

All outputs are gitignored. The build command is `pnpm compile:pcd && pnpm build`.

## Database Selection

The active database is determined by the URL when on PCD routes. A database selector dropdown in the
navbar lets users switch databases, which navigates to the equivalent page for the new database.

On non-PCD pages, the selector updates a localStorage preference. Visiting `/pcd/` redirects to
`/pcd/{preference}/` based on the stored value (defaulting to the first database in the config).

The database store lives at `src/lib/client/ui/database/database.svelte.ts` and follows the same
pattern as the theme store.

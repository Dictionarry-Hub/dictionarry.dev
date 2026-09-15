# UI

Notes on the component library, semantic token system, and theming.

## Component Library

All components are built from scratch. No headless libraries, no third-party UI kits. Full control
over markup, accessibility, and styling.

Components live in `src/lib/client/ui/` organized by purpose. Each component gets its own directory
(e.g., `button/Button.svelte`).

## Components

### Utils

#### `SEO`

`src/lib/client/ui/utils/SEO.svelte`

Renders `<title>`, Open Graph, Twitter Card, description, and theme-color meta tags via
`<svelte:head>`. Every page must use this component.

| Prop          | Type     | Required | Default                      |
| ------------- | -------- | -------- | ---------------------------- |
| `title`       | `string` | yes      |                              |
| `description` | `string` | no       | Site-wide default            |
| `image`       | `string` | no       | GitHub-hosted `icon.png` URL |

```svelte
<script lang="ts">
	import SEO from '$lib/client/ui/utils/SEO.svelte';
</script>

<SEO
	title="Installation"
	description="How to install Profilarr." />
```

### Button

#### `Button`

`src/lib/client/ui/button/Button.svelte`

Standard button component. Extends `HTMLButtonAttributes` so all native button props are supported.

| Prop           | Type                                                        | Required | Default     |
| -------------- | ----------------------------------------------------------- | -------- | ----------- |
| `variant`      | `'accent' \| 'default' \| 'danger' \| 'outline' \| 'ghost'` | no       | `'default'` |
| `size`         | `'sm' \| 'md' \| 'lg'`                                      | no       | `'md'`      |
| `icon`         | `Component`                                                 | no       |             |
| `iconPosition` | `'left' \| 'right'`                                         | no       | `'left'`    |
| `iconClass`    | `string`                                                    | no       | `''`        |
| `type`         | `'button' \| 'submit' \| 'reset'`                           | yes      |             |

Variant mapping:

- **accent**: accent background, white text
- **default**: surface background, border, standard text (default)
- **danger**: destructive action, red background
- **outline**: transparent with visible border, standard text
- **ghost**: no border, no background, subtle hover

```svelte
<script lang="ts">
	import Button from '$lib/client/ui/button/Button.svelte';
</script>

<Button
	type="button"
	variant="accent">Save</Button>
<Button
	type="button"
	variant="danger"
	size="sm">Delete</Button>
```

### Tooltip

#### `Tooltip`

`src/lib/client/ui/tooltip/Tooltip.svelte`

Wraps any element to show a tooltip on hover or when a focusable child receives keyboard focus.
Portals to `<body>` and clamps to the viewport.

| Prop       | Type                                     | Required | Default    |
| ---------- | ---------------------------------------- | -------- | ---------- |
| `text`     | `string`                                 | no       | `''`       |
| `position` | `'top' \| 'bottom' \| 'left' \| 'right'` | no       | `'bottom'` |
| `align`    | `'left' \| 'middle' \| 'right'`          | no       | `'middle'` |
| `class`    | `string` (applied to the inline wrapper) | no       | `''`       |

```svelte
<script lang="ts">
	import Tooltip from '$lib/client/ui/tooltip/Tooltip.svelte';
	import Button from '$lib/client/ui/button/Button.svelte';
</script>

<Tooltip
	text="Save changes"
	position="top">
	<Button type="button">Save</Button>
</Tooltip>
```

### Card

#### `Card`

`src/lib/client/ui/card/Card.svelte`

Surface primitive. Provides background, border, radius, and shadow. Used as the foundation for
panels, navbars, sidebars, modals, and any other bounded surface. Does not handle padding or
positioning - the consumer controls those via class passthrough.

| Prop      | Type                                     | Required | Default |
| --------- | ---------------------------------------- | -------- | ------- |
| `rounded` | `'none' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | no       | `'xl'`  |
| `as`      | `string`                                 | no       | `'div'` |

```svelte
<script lang="ts">
	import Card from '$lib/client/ui/card/Card.svelte';
</script>

<Card class="p-6">Content panel</Card>
<Card
	as="nav"
	rounded="none"
	class="fixed top-0 w-full px-4 py-2">Navbar</Card>
```

### AdaptiveList

#### `AdaptiveList`

`src/lib/client/ui/adaptive-list/AdaptiveList.svelte`

Responsive data list: renders a `Table` at `lg` and above, and a `Card` grid (one to three columns
by breakpoint) below. `view="cards"` skips the table and renders the card grid at every breakpoint
(for small datasets where a table is ceremony), capped at two columns; `columns` is then unused.
Generic over the row type, which must carry a string index signature. Used by the PCD entity detail
pages and the API reference.

| Prop       | Type                                   | Required           | Default      |
| ---------- | -------------------------------------- | ------------------ | ------------ |
| `data`     | `T[]`                                  | yes                |              |
| `columns`  | `Column<T>[]`                          | in `adaptive` view | `[]`         |
| `view`     | `'adaptive' \| 'cards'`                | no                 | `'adaptive'` |
| `href`     | `(row: T) => string \| undefined`      | no                 |              |
| `cell`     | `Snippet<[row: T, column: Column<T>]>` | no                 |              |
| `card`     | `Snippet<[row: T]>`                    | yes                |              |
| `expanded` | `Snippet<[row: T]>`                    | no                 |              |

`columns`, `href`, `cell`, and `expanded` pass through to `Table` (`Column` comes from
`src/lib/client/ui/table/types.ts`: key, header, icon, width, align, sortable). `icon` is an
optional `{ src, alt }` image rendered before the header text. Without `cell`, table cells render
`row[col.key]` directly. `card` renders each row's card-view content; when `href` returns a URL for
a row, both the table row and the card become links. `expanded` only reaches the table: cards never
expand, so a card should carry its own summary of whatever the expanded row shows. A row that has
expanded content and no `href` toggles open on click anywhere in the row, not only on its chevron.

```svelte
<script lang="ts">
	import AdaptiveList from '$lib/client/ui/adaptive-list/AdaptiveList.svelte';
	import type { Column } from '$lib/client/ui/table/types';
</script>

<AdaptiveList
	data={rows}
	{columns}>
	{#snippet cell(row, col)}
		{row[col.key]}
	{/snippet}
	{#snippet card(row)}
		<p class="text-sm font-medium">{row.name}</p>
	{/snippet}
</AdaptiveList>
```

### Carousel

#### `Carousel`

`src/lib/client/ui/carousel/Carousel.svelte`

Horizontal scroll-snap track with manual prev/next controls. Content-agnostic: each item renders
through the `item` snippet, which owns its own width and surface. Controls page by one viewport
width, only appear when the track overflows, and disable at each end. Scrolling is smooth only when
the user allows motion.

| Prop        | Type                                 | Required | Default      |
| ----------- | ------------------------------------ | -------- | ------------ |
| `items`     | `T[]`                                | yes      |              |
| `item`      | `Snippet<[item: T]>`                 | yes      |              |
| `label`     | `string` (aria-label)                | no       | `'Carousel'` |
| `itemClass` | `string` (applied to each snap item) | no       | `''`         |

Item width defaults to the snippet's content; pass `itemClass="w-full"` for one item per view.

```svelte
<Carousel
	items={featured}
	label="Featured posts">
	{#snippet item(entry)}
		<Card class="w-72 p-4">{entry.title}</Card>
	{/snippet}
</Carousel>
```

### ListPage

#### `ListPage`

`src/lib/client/ui/list-page/ListPage.svelte`

Page template for entity index pages (dev logs, wiki, PCD entity types). Composes `SEO`,
`PageHeader` (with an `AiMenu` when `artifactPath` is given), an optional intro, an optional
featured `Carousel`, and one `AdaptiveList` per group. Generic over the row type. Grouping happens
in `+page.server.ts` at build time; the component receives `ListGroup<T>[]`
(`{ title?, description?, data }` from `src/lib/client/ui/list-page/types.ts`) and stays dumb. Group
titles render as id'd `h2`s, so `TableOfContents` picks them up. Empty groups are skipped.

| Prop             | Type                                   | Required | Default      |
| ---------------- | -------------------------------------- | -------- | ------------ |
| `title`          | `string` (PageHeader + SEO)            | yes      |              |
| `seoDescription` | `string`                               | no       |              |
| `description`    | `Snippet` (rich intro under header)    | no       |              |
| `groups`         | `ListGroup<T>[]`                       | yes      |              |
| `columns`        | `Column<T>[]` (unused in `cards` view) | no       | `[]`         |
| `view`           | `'adaptive' \| 'cards'` (passthrough)  | no       | `'adaptive'` |
| `href`           | `(row: T) => string \| undefined`      | no       |              |
| `cell`           | `Snippet<[row: T, column: Column<T>]>` | no       |              |
| `card`           | `Snippet<[row: T]>`                    | yes      |              |
| `artifactPath`   | `string` (enables AiMenu)              | no       |              |
| `carousel`       | `number` (count; presence enables)     | no       |              |
| `carouselCard`   | `Snippet<[row: T]>`                    | no       | `card`       |

The carousel draws from all groups flattened. The pre-rendered HTML carries the first N entries
(deterministic, so no hydration mismatch); a client-side shuffle replaces them after mount.
`ListPage` shows one full-width item per view and wraps each in a linked `Card`, mirroring
`AdaptiveList`'s card view, so the list `card` snippet works as the fallback.

```svelte
<ListPage
	title="Dev Logs"
	groups={[{ data: logs }]}
	{columns}
	href={(row) => `/dev-logs/${row.slug}`}
	artifactPath="/dev-logs.md"
	carousel={4}>
	{#snippet card(row)}
		<p class="font-medium">{row.title}</p>
	{/snippet}
</ListPage>
```

### PageHeader

#### `PageHeader`

`src/lib/client/ui/header/PageHeader.svelte`

Page title with optional metadata, tags, supplementary badges, and actions. Supplementary badges
render in the same row as tags through the `badges` snippet.

| Prop      | Type       | Required | Default |
| --------- | ---------- | -------- | ------- |
| `title`   | `string`   | yes      |         |
| `tags`    | `string[]` | no       |         |
| `badges`  | `Snippet`  | no       |         |
| `meta`    | `Snippet`  | no       |         |
| `actions` | `Snippet`  | no       |         |

### Kbd

#### `Kbd`

`src/lib/client/ui/kbd/Kbd.svelte`

Semantic keyboard-key hint: renders a `<kbd>` element styled as a keycap in Badge's visual language
(border, mono font). Used for the search palette's footer hints (`default`) and the search trigger's
shortcut (`outline`, transparent over the trigger's own surface).

| Prop      | Type                     | Required | Default     |
| --------- | ------------------------ | -------- | ----------- |
| `variant` | `'default' \| 'outline'` | no       | `'default'` |
| `size`    | `'sm' \| 'md'`           | no       | `'sm'`      |
| `class`   | `string`                 | no       |             |

`default` fills with `bg-surface-muted`; `outline` is transparent with just the border, for use over
a surface that already has its own fill.

```svelte
<span class="flex items-center gap-1.5"><Kbd>⌘K</Kbd> open</span>
```

### Dialog

#### `Dialog`

`src/lib/client/ui/dialog/Dialog.svelte`

Minimal modal shell on the native `<dialog>` element: top-layer rendering, focus trap, and Escape
handling come from the browser. Provides the panel surface (border, radius, shadow, backdrop) and
nothing else. No chrome, no padding, no width: consumers compose those. Backdrop click closes, and
the page behind is scroll-locked while open (`showModal()` makes the background inert but not
scroll-proof).

| Prop        | Type                 | Required | Default |
| ----------- | -------------------- | -------- | ------- |
| `open`      | `boolean` (bindable) | no       | `false` |
| `onclose`   | `() => void`         | no       |         |
| `ariaLabel` | `string`             | no       |         |
| `class`     | `string`             | no       | `''`    |
| `header`    | `Snippet`            | no       |         |
| `footer`    | `Snippet`            | no       |         |

`header` and `footer` render as fixed regions above and below the content, separated by borders
(unpadded; the snippet provides its own padding). When height is constrained via `class` (e.g.
`max-h-[60vh]`), the children region scrolls between them.

Opens with a 150ms fade and rise (via `@starting-style`; browsers without support snap, and reduced
motion is respected). Close is instant by design.

Default position is centered. Override with margin utilities via `class` (margin longhands beat the
internal `m-auto` shorthand), e.g. `mt-[12svh]` for a command-palette position.

```svelte
<script lang="ts">
	import Dialog from '$lib/client/ui/dialog/Dialog.svelte';

	let open = $state(false);
</script>

<Dialog
	bind:open
	ariaLabel="Confirm deletion"
	class="w-full max-w-md">
	<div class="p-6">...</div>
</Dialog>
```

### PageActionsMenu

#### `PageActionsMenu`

`src/lib/client/ui/page-actions/PageActionsMenu.svelte`

Unified page-level menu for page views, machine-readable formats, and AI actions. Composes `Button`,
`Dropdown`, `DropdownHeader`, and `DropdownItem`. Entity pages provide copy or download format
actions plus their Markdown artifact and page paths. Setting `viewSwitcher` adds Rich view and YAML
view choices under Page view, with the active choice selected. Page formats contains the entity
format actions followed by Copy page as Markdown and View as Markdown; AI actions contains the
assistant links. Successful copies close the menu and replace the trigger with a green confirmation
for two seconds; failures use the same pattern with the danger state.

### Search

#### `SearchPalette`

`src/lib/client/ui/search/SearchPalette.svelte`

The command palette: a modal search box over the client-side scorer (see
[backend/search.md](../backend/search.md)). Composes `Dialog` (input row as `header`, keyboard hints
as `footer`), lazy-loads the core and active-database index files on first open, and renders a flat
ranked list with type `Badge`s, exactly the order the scorer returns. Empty query shows the global
most-popular entries. Arrow keys, Enter, and Escape navigate; clicks and Enter record a click event
(a no-op until the Elo store ships) and `goto` the result. Toggled globally by Ctrl+K / Cmd+K via
`svelte:window`. Mounted once in the root layout.

| Prop       | Type                 | Required | Default |
| ---------- | -------------------- | -------- | ------- |
| `open`     | `boolean` (bindable) | no       | `false` |
| `database` | `string`             | yes      |         |

#### `SearchTrigger`

`src/lib/client/ui/search/SearchTrigger.svelte`

A button dressed as an input: the sidebar search affordance. Search icon, "Search..." placeholder,
and a platform-aware kbd hint (⌘K on Apple platforms, Ctrl K elsewhere, resolved client-side).

| Prop      | Type         | Required | Default |
| --------- | ------------ | -------- | ------- |
| `onclick` | `() => void` | no       |         |
| `class`   | `string`     | no       | `''`    |

### Nav

#### `NavGroup`

`src/lib/client/ui/nav/NavGroup.svelte`

Collapsible navigation section with a split header. The left side is a link, the right side is a
chevron toggle. Both highlight on hover of either via group hover. Children render with a vertical
connector line and a slide transition.

| Prop    | Type                                                | Required | Default |
| ------- | --------------------------------------------------- | -------- | ------- |
| `label` | `string`                                            | yes      |         |
| `href`  | `string`                                            | yes      |         |
| `icon`  | `Component`                                         | no       |         |
| `badge` | `number`                                            | no       | `0`     |
| `open`  | `boolean`                                           | no       | `true`  |
| `class` | `string` (replaces the default `mb-4` root spacing) | no       |         |

Active state: exact match when children exist, prefix match otherwise. Active renders with
`bg-surface border-border shadow-control` (Button default treatment). Groups nested inside
`NavGroupSelect` pass `class="mb-1"` for tighter spacing.

#### `NavItem`

`src/lib/client/ui/nav/NavItem.svelte`

Child navigation link, used inside NavGroup.

| Prop            | Type               | Required | Default |
| --------------- | ------------------ | -------- | ------- |
| `label`         | `string`           | yes      |         |
| `href`          | `string`           | yes      |         |
| `icon`          | `Component`        | no       |         |
| `image`         | `string`           | no       |         |
| `badge`         | `number`           | no       | `0`     |
| `activePattern` | `string \| RegExp` | no       |         |

`image` renders an `<img>` element before the label. Used for arr-type icons on PCD media entities.

Active state derived from current pathname. If `activePattern` is provided, uses string includes or
regex test. Otherwise exact or prefix match against `href`.

#### `NavGroupSelect`

`src/lib/client/ui/nav/NavGroupSelect.svelte`

NavGroup's split-header language with the link side replaced by a select trigger: the left side
opens a dropdown to pick a context value, the right chevron collapses the children the context
scopes. The select affordance is deliberately quiet: no glyph, just a hover tooltip (and matching
`aria-label`). Used for the sidebar database picker, which roots the PCD subtree.

| Prop       | Type                                                                   | Required | Default           |
| ---------- | ---------------------------------------------------------------------- | -------- | ----------------- |
| `value`    | `string` (bindable)                                                    | yes      |                   |
| `options`  | `{ value: string; label: string; icon?: Component; emoji?: string }[]` | yes      |                   |
| `header`   | `string`                                                               | no       |                   |
| `tooltip`  | `string`                                                               | no       | `Click to switch` |
| `open`     | `boolean`                                                              | no       | `true`            |
| `onchange` | `(value: string) => void`                                              | no       |                   |

```svelte
<NavGroupSelect
	bind:value={databaseValue}
	options={databaseOptions}
	header="Database"
	onchange={onDatabaseChange}>
	<NavGroup
		label="Quality Profiles"
		href="/pcd/{databaseValue}/quality-profiles">
		<!-- ... -->
	</NavGroup>
</NavGroupSelect>
```

### Toc

#### `TableOfContents`

`src/lib/client/ui/toc/TableOfContents.svelte`

The floating "On This Page" panel. Mounted once in the root layout, keyed by pathname so the heading
scan reruns on every client-side navigation. On mount it reads the page's `<article>` element:
headings (`h1` to `h3`) with ids become entries, and the first `h1` (with or without an id) becomes
a title link back to `#top`. Renders nothing on pages without id'd headings. Headings carrying a
`data-method` attribute get a color-coded HTTP method label (used by the API reference).

No props. Positioning is owned by the root layout, not the component: floated to the right of the
content column, pinned to the viewport (`position: fixed`) with an internal scrollbar when taller
than the viewport. The content column is `max-w-3xl` for prose and `max-w-5xl` on PCD routes (tables
and diffs); the panel is hidden below 1280px for the prose column and below 1600px for the wide one,
where the pair would not fit beside the sidebar.

### Dropdown

#### `DropdownSelect`

`src/lib/client/ui/dropdown/DropdownSelect.svelte`

Select control backed by a dropdown menu. Wraps `Dropdown`, `DropdownHeader`, and `DropdownItem`.

| Prop          | Type                                                                   | Required | Default       |
| ------------- | ---------------------------------------------------------------------- | -------- | ------------- |
| `value`       | `string` (bindable)                                                    | yes      |               |
| `options`     | `{ value: string; label: string; icon?: Component; emoji?: string }[]` | yes      |               |
| `label`       | `string`                                                               | no       |               |
| `header`      | `string`                                                               | no       |               |
| `placeholder` | `string`                                                               | no       | `'Select...'` |
| `minWidth`    | `string`                                                               | no       | `'8rem'`      |
| `position`    | `'left' \| 'right' \| 'middle'`                                        | no       | `'left'`      |
| `placement`   | `'auto' \| 'bottom' \| 'top'`                                          | no       | `'auto'`      |
| `disabled`    | `boolean`                                                              | no       | `false`       |
| `iconOnly`    | `boolean`                                                              | no       | `false`       |
| `onchange`    | `(value: string) => void`                                              | no       |               |

`header` renders a `DropdownHeader` at the top of the menu (e.g. "Theme", "Database"). `iconOnly`
renders just the matched option's icon as the trigger button. An option `emoji` takes precedence
over its `icon`, in menu items and in the `iconOnly` trigger. Emoji rendering is platform-owned:
glyphs differ across operating systems.

### Badge

#### `Badge`

`src/lib/client/ui/badge/Badge.svelte`

Inline label for tags, statuses, and counts.

| Prop        | Type                                                                    | Required | Default     |
| ----------- | ----------------------------------------------------------------------- | -------- | ----------- |
| `variant`   | `'subtle' \| 'solid' \| 'outline'`                                      | no       | `'solid'`   |
| `color`     | `'neutral' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info'` | no       | `'neutral'` |
| `size`      | `'sm' \| 'md'`                                                          | no       | `'sm'`      |
| `pill`      | `boolean`                                                               | no       | `false`     |
| `icon`      | `Component`                                                             | no       |             |
| `iconColor` | `string`                                                                | no       |             |
| `link`      | `boolean`                                                               | no       | `false`     |

`iconColor` applies a custom class to the leading icon (e.g. `"text-info-icon"`). `link` appends an
`ExternalLink` icon on the right, signalling the badge is a clickable link.

```svelte
<Badge>Default</Badge>
<Badge
	color="success"
	pill>Published</Badge>
<Badge
	variant="outline"
	color="danger">Removed</Badge>
<a
	href="https://regex101.com/r/abc123"
	target="_blank"
	rel="noopener noreferrer">
	<Badge
		variant="outline"
		icon={FlaskConical}
		iconColor="text-info-icon"
		link
		pill>regex101</Badge>
</a>
```

### DateTime

#### `DateTime`

`src/lib/client/ui/datetime/DateTime.svelte`

Renders a formatted `<time>` element with a `datetime` attribute for SEO.

| Prop     | Type                             | Required | Default  |
| -------- | -------------------------------- | -------- | -------- |
| `date`   | `string`                         | yes      |          |
| `format` | `'short' \| 'long' \| 'numeric'` | no       | `'long'` |

Short format: "May 17". Long format: "May 17, 2026". Both are fixed to en-US. Numeric format is all
digits in the visitor's locale ("5/17/2026" or "17/05/2026"), for dense tables; the prerendered text
uses the build machine's locale and is patched on hydration (see the locale note in
[seo.md](./seo.md#locale-dependent-text)). The `datetime` attribute is always ISO. Accepts ISO date
strings and full ISO timestamps (as produced by YAML date parsing).

### Author

#### `Author`

`src/lib/client/ui/author/Author.svelte`

Pill-shaped author display with optional avatar and link. Shows a lucide `User` icon when no avatar
is provided. Linked variant uses subtle styling with an `ExternalLink` icon.

| Prop     | Type           | Required | Default |
| -------- | -------------- | -------- | ------- |
| `name`   | `string`       | yes      |         |
| `avatar` | `string`       | no       |         |
| `href`   | `string`       | no       |         |
| `size`   | `'sm' \| 'md'` | no       | `'sm'`  |

### CopyMarkdown

#### `CopyMarkdown`

`src/lib/client/ui/copy-markdown/CopyMarkdown.svelte`

Copies a markdown artifact to the clipboard for LLM consumption (see
[backend/llm.md](../backend/llm.md)). Fetches the given URL and writes the response text, with
copy-to-checkmark feedback matching `CodeBlock` and a brief alert-icon state if the fetch or
clipboard write fails. Content-agnostic by design: it takes a URL and nothing else.

| Prop        | Type                                | Required | Default            |
| ----------- | ----------------------------------- | -------- | ------------------ |
| `url`       | `string`                            | yes      |                    |
| `label`     | `string`                            | no       | none (icon-only)   |
| `ariaLabel` | `string`                            | no       | `Copy as Markdown` |
| `variant`   | `'default' \| 'outline' \| 'ghost'` | no       | `'outline'`        |
| `size`      | `'sm' \| 'md'`                      | no       | `'sm'`             |

Icon-only placements should be wrapped in a `Tooltip` at the call site. With several copy buttons on
one page, the tooltip and `ariaLabel` must state the copy scope, not just the format:

```svelte
<script lang="ts">
	import CopyMarkdown from '$lib/client/ui/copy-markdown/CopyMarkdown.svelte';
	import Tooltip from '$lib/client/ui/tooltip/Tooltip.svelte';
</script>

<CopyMarkdown
	url="/api/v1.md"
	label="Copy page"
	variant="default" />

<Tooltip text="Copy Databases as Markdown">
	<CopyMarkdown
		url="/api/v1/databases.md"
		ariaLabel="Copy Databases as Markdown" />
</Tooltip>
```

### AiMenu

#### `AiMenu`

`src/lib/client/ui/ai-menu/AiMenu.svelte`

Page-level AI actions menu: a sparkle icon button opening a dropdown with "Copy page as Markdown",
"View as Markdown", "Open in Claude", and "Open in ChatGPT". Composed from `Button`, `Dropdown`, and
`DropdownItem`. The copy item shares its fetch-and-copy logic with `CopyMarkdown`; assistant deep
links are built by `assistantLink` in `src/lib/shared/utils/llm/`. One per page, in the `PageHeader`
actions. See [backend/llm.md](../backend/llm.md).

| Prop           | Type     | Required | Default                                       |
| -------------- | -------- | -------- | --------------------------------------------- |
| `artifactPath` | `string` | yes      |                                               |
| `pagePath`     | `string` | yes      |                                               |
| `prompt`       | `string` | no       | `Read {url} so I can ask questions about it.` |

`prompt` is a template for the assistant links; the `{url}` token is replaced per assistant (Claude
gets the markdown artifact URL, ChatGPT the page URL). Pages with a clear task should override it,
e.g. the API reference uses `Read {url} and help me use this API.`

```svelte
<script lang="ts">
	import AiMenu from '$lib/client/ui/ai-menu/AiMenu.svelte';
</script>

<AiMenu
	artifactPath="/api/v1.md"
	pagePath="/api/v1"
	prompt={'Read {url} and help me use this API.'} />
```

### Markdown

Components for use inside mdsvex content (`.svx` files).

#### `CodeBlock`

`src/lib/client/ui/markdown/code/CodeBlock.svelte`

Renders code as pre-rendered plain HTML, then lazy-loads Shiki and the active tab's language grammar
after hydration. Inactive tab grammars load when selected. Plain-text and unsupported languages stay
unhighlighted, and highlighting failures leave the readable plain code in place.

#### `ThemeImage`

`src/lib/client/ui/markdown/image/ThemeImage.svelte`

Renders two images and uses CSS to show the correct one based on the active theme. No flash on load
because the inline script in `app.html` sets `data-theme` before first paint. Which image shows is
driven by the `--theme-image-*` tokens each theme declares; the component never enumerates themes.

| Prop    | Type     | Required | Default |
| ------- | -------- | -------- | ------- |
| `dark`  | `string` | yes      |         |
| `light` | `string` | yes      |         |
| `alt`   | `string` | yes      |         |

#### `Video`

`src/lib/client/ui/markdown/video/Video.svelte`

Video player powered by Plyr. Lazy-loads Plyr and its CSS on mount. Renders a `<figure>` with an
optional caption.

| Prop    | Type     | Required | Default |
| ------- | -------- | -------- | ------- |
| `src`   | `string` | yes      |         |
| `title` | `string` | no       |         |

```svelte
<Video
	src="/video/clip.mp4"
	title="Caption text" />
```

## Semantic Tokens

All tokens use the `--theme-*` prefix. Components never use raw color values. Tailwind utilities are
available via the `@theme inline` bridge in `layout.css` (e.g., `bg-bg`, `text-text-soft`,
`border-border`, `rounded-control`).

### Surface

| Token                         | Role                |
| ----------------------------- | ------------------- |
| `--theme-bg`                  | Page background     |
| `--theme-surface`             | Card / panel fill   |
| `--theme-surface-muted`       | Subdued surface     |
| `--theme-surface-hover`       | Surface hover state |
| `--theme-surface-hover-muted` | Subdued hover state |

### Text

| Token                 | Role                   |
| --------------------- | ---------------------- |
| `--theme-text`        | Primary body text      |
| `--theme-text-soft`   | Secondary text         |
| `--theme-text-muted`  | Tertiary / placeholder |
| `--theme-text-subtle` | Disabled / decorative  |

### Border

| Token                   | Role            |
| ----------------------- | --------------- |
| `--theme-border`        | Default borders |
| `--theme-border-muted`  | Soft dividers   |
| `--theme-border-subtle` | Faint dividers  |

### Accent

| Token                        | Role               |
| ---------------------------- | ------------------ |
| `--theme-accent-solid`       | Primary action     |
| `--theme-accent-solid-hover` | Primary hover      |
| `--theme-on-accent`          | Text on accent     |
| `--theme-danger-solid`       | Destructive action |
| `--theme-danger-solid-hover` | Destructive hover  |
| `--theme-on-danger`          | Text on danger     |

### Status

Each status (success, warning, danger, info) has four tokens:

| Suffix    | Role            |
| --------- | --------------- |
| `-bg`     | Background fill |
| `-text`   | Text color      |
| `-border` | Border color    |
| `-icon`   | Icon color      |

Example: `--theme-success-bg`, `--theme-warning-text`, `--theme-danger-border`.

### Component Variants

| Token                      | Role                    |
| -------------------------- | ----------------------- |
| `--theme-flush-bg`         | Flush button background |
| `--theme-flush-hover`      | Flush button hover      |
| `--theme-ghost-bg`         | Ghost button background |
| `--theme-ghost-border`     | Ghost button border     |
| `--theme-ghost-label-bg`   | Ghost label background  |
| `--theme-ghost-label-text` | Ghost label text        |

### Typography

| Token               | Role       |
| ------------------- | ---------- |
| `--theme-font-sans` | Sans-serif |
| `--theme-font-mono` | Monospace  |
| `--theme-link-text` | Link color |

### Shape

| Token                       | Role                 |
| --------------------------- | -------------------- |
| `--theme-radius-control-sm` | Small controls       |
| `--theme-radius-control`    | Standard controls    |
| `--theme-radius-card`       | Cards, panels        |
| `--theme-radius-pill`       | Pills, fully rounded |

### Shadows

| Token                           | Role            |
| ------------------------------- | --------------- |
| `--theme-shadow-card`           | Card elevation  |
| `--theme-shadow-control`        | Control resting |
| `--theme-shadow-control-active` | Control pressed |

### Scheme

Each theme declares its own light/dark identity; nothing else enumerates themes.

| Token                 | Role                                            |
| --------------------- | ----------------------------------------------- |
| `--theme-image-light` | `display` for light-variant `ThemeImage` images |
| `--theme-image-dark`  | `display` for dark-variant `ThemeImage` images  |

Themes also declare `color-scheme: light` or `color-scheme: dark` (a plain CSS property, not a
token) so native scrollbars and form controls match.

## Theming

Five themes, each defining the complete token set. No base+override layering. Theme files live in
`src/styles/themes/`.

```
src/styles/themes/
├── light.css      # :root selector (default)
├── dark.css       # [data-theme="dark"]
├── retro.css      # [data-theme="retro"]
├── roswell.css    # [data-theme="roswell"]
└── voyager.css    # [data-theme="voyager"]
```

### Switching

The active theme is set via `data-theme` on `<html>`. Light is the default (no attribute needed).

- **Persistence**: `localStorage` key `theme`.
- **Flash prevention**: an inline script in `app.html` reads localStorage and sets `data-theme`
  before first paint. The script is list-free: an unknown stored name falls back to `:root` (light)
  because no theme CSS matches it.
- **Store**: `src/lib/client/ui/theme/theme.svelte.ts` provides reactive state and a `set()` method
  for runtime switching.
- **Registry**: `src/lib/client/ui/theme/themes.ts` is the single source of truth for theme identity
  (id, label, icon). The `Theme` type, the `THEMES` array, and the switcher options all derive from
  it.

### Adding a theme

1. Create `src/styles/themes/<id>.css` defining the complete token set (`light.css` is the canonical
   contract), a `color-scheme` declaration, and the `--theme-image-*` tokens.
2. Add an entry to `THEME_DEFINITIONS` in `src/lib/client/ui/theme/themes.ts`.
3. Add the `@import` in `src/routes/layout.css`.

Nothing else: `app.html` and `ThemeImage` never change. The `theme-sync` lint rule (`pnpm lint:ui`)
enforces all of the above, including token-contract completeness.

### Tailwind Bridge

`layout.css` contains a `@theme inline` block that maps `--theme-*` variables to Tailwind's
namespace. This produces utility classes like `bg-bg`, `text-text-soft`, `border-border`,
`rounded-control`, `shadow-card`, etc. Components use these utilities instead of
`bg-[var(--theme-bg)]`.

### Dev Showcase

`/dev/ui` renders every component with all variants and a theme switcher. Not linked from
navigation. Use it to verify components across themes.

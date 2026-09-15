# PCD Pipeline

Build-time pipeline that fetches PCD repositories, compiles their SQL operations, and outputs
structured JSON for the website to consume: the current state of every entity, plus the change
history of every entity derived from the same replay.

## Source

```
tooling/pcd/
├── index.ts        # Entry point, orchestrates fetch -> replay -> extract
├── config.json     # Database registry
├── fetch.ts        # git clone and op file to commit mapping
├── build.ts        # In-memory SQLite creation and op execution
├── ops.ts          # Op file parser (batch header, per-op markers)
├── diff.ts         # Structural diff between two extracted entities
├── history.ts      # History replay fold (pure)
├── replay.ts       # SQLite adapter for the history replay
├── extract.ts      # Entity extraction via SQL queries
└── types.ts        # Pipeline-internal types
```

## Config

`tooling/pcd/config.json` defines which databases to compile. Array order determines display order
in the sidebar. First entry is the default.

```json
{
	"schema": { "repo": "Dictionarry-Hub/schema" },
	"databases": [
		{
			"id": "dictionarry",
			"name": "Dictionarry",
			"repo": "Dictionarry-Hub/database",
			"branch": "v2"
		}
	]
}
```

Each entry has:

| Field    | Purpose                      |
| -------- | ---------------------------- |
| `id`     | URL slug and output filename |
| `name`   | Display name in the UI       |
| `repo`   | GitHub `owner/repo`          |
| `branch` | Git ref to fetch             |

## Pipeline Flow

```
pnpm compile:pcd [-- --no-history]
  1. Read config.json
  2. For each database:
     a. Clone the repo at its branch (blobless clone, full commit history)
     b. Read pcd.json manifest from the checkout
     c. Resolve schema version from manifest dependencies
     d. Clone the schema at that version tag (cached if same version as previous database)
     e. Create in-memory SQLite with foreign keys enabled
     f. Execute schema ops in numeric filename order
     g. Map each base op file to the commit that added it (one git log)
     h. Replay base ops one file at a time, recording per-entity history
     i. Extract all entity data via SQL queries and assert it matches the replay
     j. Write {id}.json and history/{id}.json to src/lib/data/pcd/
  3. Write index.json (nav-only data for sidebar)
  4. Clean up temp directories
```

With `--no-history`, step g and the per-file bookkeeping in h are skipped: base ops execute in one
pass and only `{id}.json` is written. Pages and artifacts then show no History section.

## Fetching

Repos are cloned with `git clone --filter=blob:none --single-branch --branch {ref}` from
`https://github.com/{owner}/{repo}.git`. A blobless clone downloads the full commit history but only
the checked-out tree's file contents, so one clone serves both the op files and the commit lookup.
Git is required at build time. Schema clones are cached within a pipeline run since multiple
databases typically pin the same schema version.

Commit metadata comes from one `git log --name-only --diff-filter=A -- ops` per repo, mapping each
op file to the commit that added it (hash, author date, subject). An op file with no matching commit
falls back to its `@exportedAt` header and no commit link.

## Schema Resolution

Each PCD manifest pins its schema via a full GitHub URL key and exact version value:

```json
{ "dependencies": { "https://github.com/Dictionarry-Hub/schema": "1.1.0" } }
```

The pipeline parses the repo from the URL and fetches the tarball at the version tag.

## Compilation

Uses `better-sqlite3` (native, synchronous). Creates an in-memory database, executes schema ops
(DDL + seed data), then base ops (entity content). Ops are SQL files in an `ops/` folder, sorted by
numeric filename prefix (`0.schema.sql` before `1.languages.sql` before `10.something.sql`).

No custom SQLite functions are needed. Exported PCD ops use plain SQL with name-based WHERE clauses.

## History

A database repo's `ops/` folder is an append-only log. The first file is a bulk import with no
markers. Every later file is one Profilarr export batch (in practice one commit) with a header
(`-- @name:`, `-- @exportedAt:`, `-- @opIds:`) and each op wrapped in markers naming the entity it
touches:

```sql
-- --- BEGIN op 3587 ( update regular_expression "Special Edition" )
update "regular_expressions" set "pattern" = '...' where "name" = 'Special Edition';
-- --- END op 3587
```

`ops.ts` parses a file into its header, ops (verb, entity type, name, SQL) and, per op, the other
same-type names the SQL mentions (the old name in a rename's WHERE clause). Test entities
(`test_entity`, `test_release`) are ignored: the site does not extract them.

`history.ts` replays the files in order. After each file it re-reads only the entities the markers
touched, using the per-type extractors in `extract.ts` with a name filter, and diffs each against
its previous state (`diff.ts`, which matches array items by name so a changed condition reads as one
change). The kind of each entry comes from the state transition, not the marker verb: absent then
present is `created`, present then absent is `deleted`, both present is `updated`. An entity that
appeared while exactly one name its ops mention disappeared is a `renamed` entry, and the old name's
history moves under the new name; chains through temporary names inside one file resolve to the
original. When a regex or custom format disappears, the custom formats or profiles that referenced
it are re-read too, so cascades are attributed to the file that caused them. A file with no markers
(the bulk import) or an unlabeled op is diffed in full instead, with no related links.

After the last file, a full extraction must deep-equal the replayed state. A mismatch fails the
build naming the differing entities. This is what guarantees a page's History section can never
disagree with the entity it sits under. Entities that no longer exist are dropped from the output,
and related links only point at entities that still exist.

Per database the replay costs about one second on top of the normal compile.

## Extraction

After compilation, the pipeline queries the SQLite database for each entity type with appropriate
joins (e.g., custom formats with their conditions and condition-type data, quality profiles with
scoring and quality lists). Results are shaped into the `CompiledDatabase` interface defined in
`src/lib/types/pcd.ts`.

## Output

All output goes to `src/lib/data/pcd/` (gitignored).

**Per-database JSON** (`{id}.json`): Full entity data typed as `CompiledDatabase`. One file per
database. These are consumed by `+page.server.ts` load functions for entity detail pages.

**Nav index** (`index.json`): Entity names only, keyed by database ID. Drives the prerender entries
(`src/lib/shared/utils/pcd/prerender.ts`) and the per-database `/pcd/{database}/nav.json` endpoint
the sidebar fetches at view time. Kept separate to avoid shipping full entity data to every page.

**Per-database history** (`history/{id}.json`): `EntityHistory` from `src/lib/types/pcd.ts`, keyed
by `{entityType}:{name}` (entity types as they appear in op markers, e.g. `custom_format`,
`radarr_naming`), each a list of `HistoryEntry` in replay order. Lives in its own folder so the
routes' `pcd/*.json` database globs never see it. Loaded by
`src/lib/shared/utils/pcd/history-data.ts`, which tolerates the folder being absent.

## Shared Types

`src/lib/types/pcd.ts` defines the compiled data shape, used by both the pipeline and the SvelteKit
app. `CompiledDatabase` retains both the database manifest version and its pinned schema dependency
version. Key interfaces:

- `CompiledDatabase` - top-level container with metadata (including the source `repo` and `branch`,
  used for commit links) and all entity collections
- `EntityHistory`, `HistoryEntry`, `EntityChange` - the per-entity change log
- `CustomFormat` - name, description, tags, conditions (with discriminated union for condition data)
- `QualityProfile` - name, scoring, quality list with groups, languages
- `RegularExpression` - name, pattern, description, tags
- `DelayProfile` - protocol, delays, bypass settings
- `NamingConfig`, `MediaSettings`, `QualityDefinitionConfig` - media management entities

## Adding a Database

1. Add an entry to `tooling/pcd/config.json`
2. Run `pnpm compile:pcd` to verify it compiles
3. The database appears in the sidebar dropdown and nav automatically

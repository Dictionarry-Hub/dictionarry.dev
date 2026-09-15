# Development

This guide covers the branching model, CI, and deployment. For how to submit changes, see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Table of Contents

- [Branching Model](#branching-model)
- [CI](#ci)
- [Deployment](#deployment)

## Branching Model

All work happens on feature branches created off `develop`. When ready, the branch is squash merged
into `develop` via a pull request. The PR title becomes the commit message on `develop`.

Every merge to `develop` triggers a build and deploy to GitHub Pages. There is no staging
environment or soak period. The build either succeeds or it doesn't.

Nothing is committed directly to `develop`. All changes go through pull requests so CI runs before
merging.

## CI

Every pull request targeting `develop` runs these checks:

| Job        | Command                                | What it catches                   |
| ---------- | -------------------------------------- | --------------------------------- |
| Format     | `pnpm format:check`                    | Unformatted code                  |
| Test       | `pnpm test`                            | Failing unit tests (Vitest)       |
| Compile    | `pnpm compile:api`, `pnpm compile:pcd` | Upstream data that fails to build |
| Type Check | `pnpm check`                           | TypeScript and Svelte type errors |
| Build      | `pnpm build`                           | Build failures, broken routes     |
| Lint       | `pnpm lint`                            | ESLint and custom lint errors     |

Format and Test run on their own. Compile runs once and uploads `src/lib/data` as an artifact; Type
Check and Build download it, and Lint downloads both that and the `build` output because the custom
lint rules inspect prerendered HTML. All six must pass before a PR can be merged. Tests live in
`tests/` at the repository root. PR titles are validated against conventional commit format.

## Deployment

The site is built with `pnpm build`, which runs adapter-static and outputs plain HTML, CSS, and JS
to `build/`. Production builds require `PUBLIC_SITE_URL`; CI maps it from the `SITE_URL` GitHub
Actions variable. Deployment workflows must use the same mapping so generated links and canonical
metadata share one origin. This output is deployed to GitHub Pages.

There is no runtime, no server process, and no environment variables at serve time. Deployment is
copying files.

Search Elo ranking is controlled by the optional build-time `PUBLIC_SEARCH_ELO_ENABLED` variable. It
defaults to `false`; set it to `true` to blend Elo ratings into search results. The same variable
works in development and requires a development-server restart when changed.

# English Fork Upstream Integration

## Problem
The English conversion was made from a ZIP without Git history. Its edits are now preserved on the fork's `english-app` branch, but the original project has 26 newer commits, including a redesigned service console, separate text/image provider settings, and test routing.

## Requirement
Combine upstream version 0.9.0 with the saved English application on `english-upstream`, preserving both upstream behavior and the English production experience. Retain shared Git ancestry so later updates can be reviewed and merged.

## Acceptance Criteria
- [ ] The integration retains English commit e0d62bb and upstream commit d9005d4 as ancestors after a verified merge commit; the original edited folder and published english-app checkpoint remain available.
- [ ] Upstream's service console, shelf redesign, separate text/image provider configuration, credential clearing and selective redraw behavior remain functional.
- [ ] All active reader, provider settings, desktop/native/CLI surfaces and newly introduced runtime messages use English; obsolete desktop panes remain removed.
- [ ] Saved bounded English source translation, English discovery/generation/review/export contracts and migration 0021 remain intact through the composed production provider.
- [ ] New English test suites are registered with their real source coverage; typecheck, lint, impact-selected tests and applicable browser/native checks have recorded outcomes and explicit environment limitations.
- [ ] Current setup documentation explains the fork branches, original upstream, and tested local commands without claiming source import or automatic update support that does not exist.

## Constraints
Use pinned Node 24.22.1 and pnpm 11.25.0. Keep canonical source bytes/IDs, API identities, library format gates, migration journal ordering, signed WebP/archive compatibility and existing attribution. Never run migrations or destructive checks against the personal library or use live AI for verification. No desktop preparation, application build, bundle or installer. The user's English and pnpm instructions override newly introduced Chinese-comment/default-launcher guidelines. Publish only the reviewed result; do not force-push or alter upstream.

## Non-Goals
Adding online English story import, book uploads, new provider features beyond upstream, redesigning the upstream interface, translating historical engineering reports or bulk rewriting provenance-checked original books.

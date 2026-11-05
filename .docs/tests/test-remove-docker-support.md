# Remove Docker container support verification

1. Run applicable local-book, configuration, CLI and development tests against disposable fixtures. The unchanged `docker/seed.sql` must remain available and production initialization/upgrade/packaging paths must have no diff.
2. Run `tests/development-local.e2e.mjs` under pinned Node with disposable homes/checkouts and fake credentials. Saved Google config, explicit shell overrides, forced local shelf, private-file denial and clean shutdown must still pass.
3. Start `pnpm desktop:preview` on a free port, inspect the footer in the in-app browser, and verify it no longer advertises Docker. Stop the preview. No container or desktop package build.
4. Audit current source/guides/configuration for container commands and Docker-only variables. Retain historical records, the seed folder, persisted owner identifiers and transitive dependencies.

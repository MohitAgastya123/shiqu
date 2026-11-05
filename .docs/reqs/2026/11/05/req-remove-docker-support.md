# Remove Docker container support

Remove the obsolete container deployment route after development, desktop, CLI, and skills moved to shared native settings. The user explicitly permits keeping `docker/`; its production database seed and all existing consumers stay in place.

## Acceptance criteria

- [ ] Remove Dockerfile, Compose files, container healthcheck/ignore/build script, Docker-only environment variables, and the private `.env` if it still contains only the known Docker port.
- [ ] Keep `docker/seed.sql`, initializer/upgrade/packaging paths, persisted owner IDs, private/public package identities, library format, dependencies and historical records unchanged.
- [ ] Active setup/docs/UI no longer advertise container support; remove the obsolete Dockerfile-specific test assertion while retaining book provenance checks.
- [ ] Verify applicable local configuration, library, CLI and development startup regressions; inspect the desktop footer through the in-app preview. No real library migration, inference, container build or desktop packaging.

## Constraints

This is container-support removal, not a seed relocation or data migration. Keep historical changelog/delivery/evidence records and transitive dependencies whose names mention Docker. Preserve any newly introduced unrelated private `.env` settings if its contents changed before cleanup.

# Release 0.8.6 recovery scenarios

1. In an isolated production fixture, run a story until its review blocks, then change only the art style. Expect unchanged review history, no new review/image calls, failed child state and exactly one pending review fault owned by the child. Replaying the revision and restarting retain that fault.
2. Accept the child's review with its explicit fault ID and stable request ID. Expect completion with the new style, an overridden review and exactly the missing image calls. Replay acceptance after completion; expect no new generation and no parent changes.
3. Create an isolated 0.8.5-format library with a stranded failed blocked revision, then open it through ensureLibraryReady. Expect a verified whole-library backup, migration 0020 and one pending fault. Reopen and expect no duplicate; healthy/overridden records stay unchanged.
4. Run pnpm release:check and affected integration checks on the release commit using pinned Node/pnpm. Publish through the npm checks/build/smoke pipeline and existing native CI. Expect npm 0.8.6 plus both desktop installers and checksum file; release notes contain no DeepSeek or Claude announcement.

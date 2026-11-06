# Discovery reason E2E verification

- [x] Give the real production discovery workflow an isolated catalog and a matching provider returning a valid reason longer than 120 characters. The candidate reaches selection, including its exact explanation and verified source.
- [x] Repeat discovery against its saved cache. The result is unchanged, with zero additional extraction or matching calls.
- [x] Read that result through the production browser response parser and intake persistence. A 480-character explanation succeeds; 481 characters are rejected; old candidates without a reason remain valid.
- [x] Use only controlled providers and isolated data. After checks pass, inspect the live app status and guide the user to retry their preserved failed search explicitly.

Evidence: full-tier focused discovery/browser-parser tests 10/10; final selected full suite 181 files, 1492/1492; typecheck/lint; source-only native 24/24 plus formatting. Independent AR/CR passed. The running app's configured provider and retained failed intake were inspected read-only. The user is guided to explicitly retry; no live search or paid generation was run as a diagnostic probe.

# Story source append

Base: `21ba8a9440bd42505acfcb3fb83ca84b58e1ac29`.

Extend the existing `stories edit` / revisions request with optional `appendSource` alongside a complete script draft. Ordinary revisions retain their current restrictions. Append mode verifies the later source in the same local edition, merges real citation ranges, keeps the original script prefix and characters, and creates an ordinary revision with copied images. A preserved-prefix receipt prevents subsequent automatic review repairs from changing existing scenes; such findings stop with evidence instead. The existing production coordinator reviews and draws the additional scenes. No new model adapter or planning state machine.

- [x] Add append-only input validation, accurate reuse impact, and a prefix guard in shared revisions.
- [x] Resolve and save combined originals in server revision creation, before copying media; retain idempotency and family CAS.
- [x] Guard automatic script/structural repairs, document CLI input, and add isolated source/replay/prefix/media/production tests.
- [ ] Run typecheck, lint, applicable unit/integration suites; independently review the complete diff.
- [ ] Submit the Wusong draft through the running production endpoint, monitor audit and image completion, and verify original/prefix/image hashes.

Runtime feasibility: source checkout is running watched Vite/REST on ports 3000/3002. First SS probe: verify a source edit hot-reloads the backend and GET remains available; if not, use a controlled restart only after checking no active production. CLI has an exclusive library lock, so do not bypass it to open the live library; the shared REST revision entry is the safe live equivalent. All actual story mutations use that entry. HTTP reads require the environment's local-network sandbox escalation. No saved credentials are printed or changed.

AR risk: non-low — extends persisted revision/source semantics.
AR review round: 1; reviewer: new.
AR passed: no blocking architecture flaws.

SS probe passed: watched REST stayed readable with all 38 original frames after source changes. The continuation uses the existing edit input with a manually authored draft and verified appendSource; existing characters remain verbatim, with optional continuation-stage notes appended after two newlines. Prefix reuse uses explicit index mapping, including duplicate prompts. Strict media checks stop append if any preserved image is unreadable. Prefix checks precede automatic repair assignment.

CR passed: no major findings.
CR risk: non-low — extends persisted source and revision semantics.
CR review round: 1; reviewer: reused.

Typecheck and lint passed. Targeted suites passed: reader-revisions 17/17, headless-cli 7/7. Full suite requires localhost permissions; sandboxed run failed on port binding and was rerun with those permissions. Actual draft submitted paused through shared REST, id `85a80a35-9df6-4851-9e0f-efd04065c421`, 38 preserved + 28 appended = 66 frames. Prefix page content, SHA-256 and readable image bytes verified against original. Combined source ends at `shuihu-031-014`. Formal production resumed after verification, no review override.

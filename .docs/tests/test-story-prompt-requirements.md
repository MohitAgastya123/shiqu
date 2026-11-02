# Story prompt requirements E2E

Use an isolated local fixture and actual UI in the in-app browser; never call paid providers or alter user stories.

1. Given a story awaiting production confirmation, open its flow. Both requirement links appear at the same level. Edit each independently; close/reopen and reload. Both values persist. Expand current rules and copy text; labels distinguish previews from saved calls.
2. Given a completed fixture story with captured production/review calls and criterion results, open both links. Actual stage records include instructions, text inputs and output contract. Acceptance shows per-criterion result, evidence and page references. Missing historical records show an explicit no-record state.
3. Change only acceptance requirements and submit a new version. Existing script/images remain initially, review becomes pending, original version remains unchanged. A controlled failed criterion triggers repair; passed re-audit permits drawing/completion.
4. Given a paused story before the full script exists, both links are available; edits stay paused until explicit resume. No third prompt entry appears.

Capture screenshots and observable outcomes. Automated integration tests establish provider request equality, persistence and strict gate behavior; browser observations establish navigation, edit/copy and legibility.

5. Given unknown or conflicting criteria, the review stops with a visible reason, creates no automatic repair request and permits editing acceptance requirements. No drawing starts.

## Execution evidence

- IAB, loopback fixture on 3140, actual Reader UI: scenarios 1, 2 and 4 passed. Edited both confirmation requirements, saved and reloaded; both values persisted. Paused pre-plan editor retained pause and required explicit resume.
- Scenario 2: expanded actual review receipt and verified system instructions/text input/output schema. Copy feedback appeared; UI paste into a temporary draft confirmed the full prompt text, then the draft was discarded. Historical story showed 0 records and explicit “未留存”.
- Scenario 3: IAB submitted acceptance-only revision, showed 3 reused / 0 redraw; child audit completed with changed criteria/results and a new review record. Integration additionally proves failed criterion repair followed by fresh audit before drawing, original isolation and copied-image byte equality inherited from the revision suite.
- Scenario 5: real REST/SQLite/queue integration verifies unknown evidence, requirements stop reason, no repair/drawing, retry rejection. Real shared UI rendering verifies the edit-acceptance route without fabricated frame issues; shared timeline and desktop summary parity verify failed/skipped/pending states and explicit reason.
- Screenshot: [acceptance requirements and results](evidence/story-prompt-requirements/acceptance.jpg).
- No live model semantic quality claim: test replies are controlled. Default-concurrency timeout and successful bounded-concurrency full-suite rerun are recorded in AP.

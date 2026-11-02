# Story prompt requirements E2E

Use an isolated local fixture and actual UI in the in-app browser; never call paid providers or alter user stories.

1. Given a story awaiting production confirmation, open its flow. Both requirement links appear at the same level. Edit each independently; close/reopen and reload. Both values persist. Expand current rules and copy text; labels distinguish previews from saved calls.
2. Given a completed fixture story with captured production/review calls and criterion results, open both links. Actual stage records include instructions, text inputs and output contract. Acceptance shows per-criterion result, evidence and page references. Missing historical records show an explicit no-record state.
3. Change only acceptance requirements and submit a new version. Existing script/images remain initially, review becomes pending, original version remains unchanged. A controlled failed criterion triggers repair; passed re-audit permits drawing/completion.
4. Given a paused story before the full script exists, both links are available; edits stay paused until explicit resume. No third prompt entry appears.

Capture screenshots and observable outcomes. Automated integration tests establish provider request equality, persistence and strict gate behavior; browser observations establish navigation, edit/copy and legibility.

5. Given unknown or conflicting criteria, the review stops with a visible reason, creates no automatic repair request and permits editing acceptance requirements. No drawing starts.

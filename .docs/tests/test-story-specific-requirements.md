# Story-specific requirements scenarios

1. In a new isolated library, select a story and prepare it using a controlled production provider. Both fields receive story-specific suggestions, the synopsis remains separate, and no script/image is generated before confirmation. Restart and inspect the same draft.
2. Edit both fields, including clearing one; save/restart/confirm. Generation receives the production field only. Review receives the acceptance list and production context. Failed checks create targeted repairs; repairs see findings without the acceptance list; drawing follows a passing recheck.
3. Hold preparation in flight, save a paused draft, then resume/release. The authored draft, including empty fields, survives the worker checkpoint. Switch stories; unchanged automatic guidance is replaced while authored changes survive.
4. At the provider boundary, exercise Codex, Gemini and OpenAI recommendation, full/batched generation, reflection, frame review, full review and repair. Check original facts, schema bounds and requirement routing. Historical defaults/captures remain compatible.
5. Open a controlled preview in the in-app browser. Inspect both populated editors, edit/save/reopen, and verify the existing confirmation gate remains available. Browser verification touches only the disposable fixture library.

Automated cases live in the existing production-backed test suites plus `tests/story-specific-requirements.test.mjs`; browser uses the production fixture preview. No live inference is required.

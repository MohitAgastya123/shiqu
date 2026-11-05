# Claude CLI adapter and comparison

Git base: `c030ca0970d5b9372ff2712c48dbcb8ed1aee7e1`.
Existing unrelated changes: `server/reader-commands.ts`, `tests/story-flow-control.test.mjs`; preserve them.

Risk: non-low — new subprocess authentication/integration with production cancellation and provider identity.

Use an invocation-only `claude` provider, like DeepSeek, leaving saved desktop settings untouched. Reuse the existing CLI text provider implementation and storyboardGenerator; keep Codex native image handling unchanged. Claude runner implements the same structural job/result contract, uses print/JSON mode, explicit model and task effort, subscription-only auth checks, safe mode, no tools, strict empty MCP config and no persistence. JSON schema outputs pass existing production parsing. Disable API/third-party auth environment overrides; reject unsupported image jobs before spawn. Bound process output/time and terminate child groups on CLI/server/desktop shutdown.

1. [x] First SS probe: inspect auth and CLI options; establish subscription availability, model receipt and structured output format with a bounded no-tool call if authenticated. No production generation until runner safety/output checks pass. If auth unavailable, continue offline implementation/tests and retain an explicit live-run blocker.
2. [x] Add runner and shared production routing, provider status/error identity, invocation-only CLI readiness, shutdown cleanup and configuration documentation.
3. [x] Add fake-process tests for auth/billing isolation, protocol/structured output, model/effort receipts, timeout, cancellation, no tools/images, and production reviewed boundary.
4. [x] Run Node 24 typecheck, lint and applicable unit/integration suites; review the final integration independently.
5. [ ] Create an isolated comparison via CLI using preserved selection; prepare, confirm and run to reviewed; inspect checkpoints on failure rather than blindly rerunning. Validate selected-source/context hashes against saved inputs, zero images and passed production review.
6. [x] Save snapshots, prompts, review history, runtime/model metadata and evidence-based four-way comparison report. If live authentication/service blocks completion, record exact limits and continuation state.

Validation: `.docs/tests/test-claude-cli-comparison.md`; production CLI boundary plus fake runner tests. No Docker/desktop packaging. Live run may require network/keychain access outside the sandbox. Do not expose credentials or private account fields.

AR passed: no blocking architecture flaws.
AR risk: non-low — subscription-auth subprocess integration affects production routing and shutdown.
AR review round: 1; reviewer: new (`claude_review`). Claude matching must use its own model; auth helpers must not enable API billing; effort metadata is requested, not claimed CLI-confirmed.

SS first probe: Claude Code 2.1.318 supports safe-mode, empty tool selection, strict MCP configuration, print/JSON schema and effort flags. `auth status` reports loggedIn=false even outside sandbox after user sign-in; live inference is blocked until auth becomes visible. Continue offline implementation per task 1. Installed skill update check failed; use the already-read skill and source CLI 0.8.5 without updating.

SS probe resolved: subscription login became visible after user sign-in. The clean child environment must retain OS USER/LOGNAME/SHELL for macOS Keychain access. A no-tool structured-output call succeeded with actual `claude-opus-5-5`; the comparison pins that complete model ID. Auth commands exclude variadic MCP flags so subcommands are not consumed as filenames.

TT: Node 24.22.1 / pnpm 11.25.0 typecheck, scoped ESLint and diff whitespace checks pass. 169 applicable integration checks pass in `/tmp/shiqu-claude-checks-unsandboxed.log`; after diagnostic repair, 18 Claude/diagnostic/Gemini/DeepSeek checks pass in `/tmp/shiqu-claude-diagnostics-unsandboxed.log`. Initial sandbox-only socket EPERM failures were rerun outside sandbox. No Docker or desktop build.

CR fixed: Claude diagnostic events and finite error codes now survive persistence/export while arbitrary codes and private fields are removed; rerun result passed.
CR risk: non-low — subscription subprocess integration affects production routing and shutdown.
CR review round: 2; reviewer: reused (`claude_review`).

Live run: `.data/comparisons/huoyanshan-claude-2026-11-05T13-21-32.932Z`, story `ada313b9-9c00-4d2b-a1f6-7d15730ac01f`, public `pnpm cli run --until reviewed` with no-intake selection matching prior independent runs. This already-selected source needs no new discovery/confirmation step. Saved source JSON hashes match selected text `9343ce896671e37839be659bc9b1971601c0b8f03cba763d4e19e5518f1199f0` and chapter context `7d6d382fd8fa2782853f8a87458a6e59a174363eb3f41dea69f99615f3f1ea79`.

Implementation milestone: local commit `17a00d5` (tested provider, diagnostics, documentation; no push). Unrelated working changes remain outside the milestone.

Live outcome: blocked by the subscription's five-hour usage limit, not an editorial stop. CLI reported reset `2026-11-05 13:20 America/Toronto`. Initial recommendation 42, outline 78, structural repairs 78→78→73→67. Fourth count audit proposes 65; that repair did not execute. Four count audits, three structural repairs, no full-story audit, no override, 0 images. Runtime to block ~18 minutes. Original/context hashes and selection equal the preserved inputs. All successful calls report `claude-opus-5-5`.

Runtime repair: Claude service-error assistants use model `<synthetic>` and error `rate_limit`. Handle that before successful model validation; save `RATE_LIMITED` with safe user guidance, never accept it as a model receipt or fall back to API billing. 18 focused quota/diagnostic checks, final typecheck and scoped lint pass. No paid whole-story retry while quota is exhausted.

Evidence collection repair: the temporary task program concatenated UTF-8 Buffers individually, corrupting some captured stdout. This did not affect the production source or model inputs. Final session/source/prompts/history were re-read through public CLI with streaming UTF-8 decoding; both original hashes verified. Removed corrupt captured run JSON. Private `summary-final.json`, `quota-probe.json`, `resume-input.json`, `resume.md` preserve the actual block and fixed recovery identity. Report: `.docs/reports/2026/11/05/model-comparison-huoyanshan.md`.

Task 5 remains incomplete: no reviewed Claude result exists yet. Resume the saved current fault after quota reset, then run the same story to reviewed and revalidate; do not recreate, change providers, bypass review or generate images.

Quota-handling milestone: local commit `837862e`; no push.

CR passed: no major findings.
CR risk: non-low — subscription subprocess integration affects production routing and shutdown.
CR review round: 3; reviewer: reused (`claude_review`).

VR incomplete: the Claude story has not reached `reviewed`. The remaining requirement is the passed live review boundary; the 67-frame checkpoint and report are explicitly unfinished. Complete criterion-by-criterion VR evidence is preserved in `.docs/done/2026/11/05/claude-cli-comparison.md`. Verification logs are copied under the private comparison directory's `verification/`.

Follow-up user instruction (2026-11-05): comparison reports consolidated into `model-comparison-huoyanshan.md`; Claude and DeepSeek drafts saved as separate paused desktop-library copies. User explicitly requested both stories remain paused. Do not resume generation automatically when quota resets; wait for an explicit resume request. Exact copy/pause evidence is recorded in `plan-copy-comparison-drafts.md` and the consolidated report.

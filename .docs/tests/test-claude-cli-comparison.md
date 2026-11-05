# Claude CLI integration scenarios

1. With a fake Claude executable and isolated library, select `SHIQU_AI_PROVIDER=claude` through the ordinary headless CLI. Run a source-backed story to reviewed. Expect shared generation/review checkpoints, provider/model identity, saved revisions when needed, and zero image calls.
2. With absent or API-only auth, run status and generation. Expect a safe login/subscription error before inference, with no fallback API/network provider.
3. A fake executable returns structured JSON/model usage, invalid output, tool attempts, nonzero result, oversized output or hangs. Expect valid receipts only for success; reject unsafe/invalid output and kill timed-out or cancelled process groups without logging raw content.
4. With the user's authenticated CLI, create an independent fire-mountain story using preserved source ranges/settings, prepare and confirm through production CLI, then run to reviewed. Expect source/context hashes equal the earlier comparison, all passed review checkpoints, readable text result and no image generation. Authentication/service failures are a blocked live scenario, not a pass.

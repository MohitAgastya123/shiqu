# Display valid discovery match reasons

## Problem

Live comic creation stops before story selection despite successful Codex extraction and matching. The final story-picker schema rejects valid match explanations longer than 120 characters, although the matching contract allows 480. Cached retries repeat the same failure without new inference. The generic Codex error incorrectly suggests a login or usage problem.

## Requirement

Return every valid matching explanation through the discovery response, saved intake and browser parser without shortening it or repeating paid work. Preserve the established maximum of 480 characters and reject invalid over-limit output.

## Acceptance Criteria

- [x] Valid explanations through 480 characters pass the suggestion boundary unchanged; 481 characters are rejected.
- [x] Cold production discovery returns a matched story with a valid explanation longer than 120 characters.
- [x] Warm cached discovery returns the same story/reason without extraction or matching calls.
- [x] The production intake and browser response contract accept that candidate and retain verified source metadata.
- [x] Relevant regression checks, typecheck/lint and review pass; the existing user search can retry using retained cache.

## Constraints

Continue the RPD live-usability verification on `feature/comic-bubbles`. No schema migration, cache deletion, user-library test writes, new model calls for verification, dependency changes or weakened source checks. Use the existing production discovery implementation with isolated providers/data.

## Non-Goals

Changing models, login, subscription settings, theme matching decisions, explanation wording, source selection, inference policies or the error-reporting framework.

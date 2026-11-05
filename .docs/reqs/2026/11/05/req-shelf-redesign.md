# Shelf (书架) redesign

With a real library (54 items: 43 readable stories, 11 unfinished productions, 16 book groups of which 9 hold one story), the reader shelf is about 11,400px tall on a phone. Unfinished productions are mixed into the reading grid and sorted ahead of readable stories, each showing a large placeholder and the same multi-line explanation (one sentence appears 8 times). Single-story groups render as full-width cards. Readers cannot quickly find something to read, and operators cannot quickly see which productions need them.

## Acceptance criteria

- [x] The shelf separates **unfinished productions** (items that cannot be read yet: no first-page image) from **readable stories**. Unfinished productions appear in their own region above readable stories, with a visible count.
- [x] Each unfinished production is a compact row showing title, book, theme and art style, a status label, and at most one primary action for its current state (choose story, confirm, choose frame count, resume, pause, retry, or view progress). Favorite and delete stay available.
- [x] Productions that need the user (待提取故事, 待选故事, 待制作确认, 待选画幅数, 生成失败) are listed before running, queued and paused work. Order within a status follows the existing shelf order.
- [x] Long status explanations are not repeated as body text on every row. Failure messages that carry specific information (the session error) remain visible. Full explanations stay available to assistive technology.
- [x] The production region can be collapsed; the choice persists per browser like existing group disclosure.
- [x] A long production list does not push readable stories far down: only a few rows show by default, with a control to show all. Items that need the user are always visible, and a search shows every match.
- [x] Readable stories keep their cover, title, theme/style tags, revision marker, and reading progress. A story read to its last frame shows a finished state ("已读完") instead of "接着看". Readable stories whose generation is still incomplete keep their generation status and pause/resume/retry control on the card.
- [x] All readable cards in a grid have the same size; a group with one story no longer renders a full-width card.
- [x] Without a saved grouping preference the shelf opens ungrouped (不分组); a saved preference is kept.
- [x] Search, the 全部/收藏 tabs, grouping (book/theme/art style/status/none), refresh and 新建故事 keep working and apply to both regions. Result counts stay consistent with the 我的 page counts.
- [x] Existing behavior is preserved: opening, favoriting, deleting, retrying, pausing and resuming call the same handlers with the same arguments; busy states disable conflicting actions as today; renamed source-only productions remain searchable.
- [x] The page works at 320–480px widths with no horizontal scroll and keeps the existing visual language of the reader (colors, serif headings, card radius).
- [x] Empty states remain: no stories at all, no search match, empty favorites, and a library containing only unfinished productions.

## Scope

Reader shelf (`client/ui/ReaderShelf.tsx` and its styles) and pure helpers in `lib/` it uses. No change to the production workflow, session model, server APIs, storage, or the desktop app's library pane (it only shares search helpers, which stay compatible). No CLI or skill changes. The 发现 page's "继续阅读" wording for finished stories is a separate small fix.

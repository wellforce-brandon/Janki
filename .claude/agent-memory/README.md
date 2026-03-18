# Agent Memory

Version-controlled, shared knowledge that agents accumulate during work. Unlike CLAUDE.md (static rules), agent memory captures discovered patterns, debugging insights, and project-specific knowledge that emerges over time.

## Files

| File | Purpose |
|------|---------|
| `decisions.md` | Key architectural decisions and their rationale |
| `debugging.md` | Known gotchas and failed approaches -- prevents repeating dead ends |
| `patterns.md` | Discovered code patterns and conventions |

## How to Use

- **Before starting work:** Read relevant memory files to understand existing decisions and known pitfalls.
- **After completing work:** Update memory files when you discover new patterns, make decisions, or hit non-obvious bugs.
- **Keep entries concise and actionable.** Remove entries that no longer apply.
- **No session-specific information.** Memory persists across sessions -- only write things that will be useful in future conversations.

## Relationship to Other Files

- `CLAUDE.md` has rules. Agent memory has discovered knowledge.
- `tasks/` has plans. Agent memory has decisions and lessons from executing those plans.
- LL-G (external) has cross-repo lessons. Agent memory has project-specific lessons.

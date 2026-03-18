---
description: Enforce LL-G knowledge base check before writing code
globs: ["src/**", "src-tauri/**", "lib/**", "app/**", "scripts/**", "data/**"]
alwaysApply: false
---

# RULE 1 Enforcement: Check LL-G Before Writing Code

Before writing or editing any file matching the paths above, you MUST consult the LL-G knowledge base to avoid known failure patterns.

## Required Steps

1. **Fetch the master index:**
   ```
   WebFetch https://raw.githubusercontent.com/wellforce-brandon/LL-G/main/llms.txt
   ```

2. **Identify relevant technologies** from the file you're about to write. For Janki, the relevant technologies are:
   - **TypeScript** -- always check (all frontend code)
   - **Tailwind CSS** -- when editing styles or components
   - **Svelte** -- when editing `.svelte` files (check if index exists)
   - **Tauri** -- when editing `src-tauri/` or Tauri config (check if index exists)
   - **Bash** -- when writing shell scripts

3. **Fetch each relevant tech index:**
   ```
   WebFetch https://raw.githubusercontent.com/wellforce-brandon/LL-G/main/kb/<tech>/llms.txt
   ```

4. **Read ALL HIGH-severity entries** for matched technologies.

5. **Read MEDIUM entries** whose title matches the specific task.

## Do NOT skip this check

- Even for small edits -- HIGH-severity gotchas cause silent wrong output.
- If you already checked LL-G earlier in this conversation for the same tech, you do not need to re-fetch.
- If a tech sub-index does not exist yet (404), proceed -- but note it for future contribution.
- If no entries are relevant, proceed -- but you must have looked first.

## Contributing Back

After completing work, if you encountered a non-obvious gotcha or failure pattern:

1. Run `/add-lesson` to submit it to LL-G via GitHub API.
2. Include: technology, title, problem, wrong pattern, right pattern, severity, tags.
3. New Janki-relevant technologies to contribute to: `tauri`, `svelte`, `fsrs`.

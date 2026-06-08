# Private files — do not publish

The following files contain personal information or internal notes and should be
**excluded before making the repo public**.

## Action required before making the repo public

Either:
- Add these paths to `.gitignore` and remove them from git tracking (`git rm --cached <file>`), OR
- Move them outside the repository

## Files to exclude

| File | Why |
|------|-----|
| `CLAUDE.md` | Internal AI assistant instructions — contains personal project context, real client names, and workflow notes that are not for public consumption |
| `.env.local` | Already in `.gitignore` — double-check it was never committed |
| `.claude/` | Claude Code settings directory — already in `.gitignore` |

## How to remove CLAUDE.md from git tracking

```bash
# Add to .gitignore
echo "CLAUDE.md" >> .gitignore

# Remove from git index (keeps the file locally)
git rm --cached CLAUDE.md

# Commit
git add .gitignore
git commit -m "chore: exclude CLAUDE.md from public repo"
```

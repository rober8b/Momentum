# Contributing

This is a personal project that I opened to the world. PRs are welcome but evaluated case by case.

## Before opening a PR

1. Open an issue first describing the change
2. Wait for feedback before writing code
3. Large changes without prior discussion will probably be rejected

## Good scope for a PR

- Bug fixes
- Documentation improvements
- Performance improvements
- Translations (add a language to `lib/strings.ts`)
- Better empty states
- Accessibility improvements

## Probably rejected

- Large features without prior discussion
- Stack changes
- Refactors that don't solve a concrete problem
- Code style "improvements"

## Local setup

See [README.md → Quick Start](README.md#quick-start-self-host).

## Code style

- TypeScript strict mode
- Conventional commits in English (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`)
- Tailwind classes (Prettier handles ordering)
- Server Components by default — `"use client"` only when real interactivity is needed
- Server Actions for all mutations — no API routes for data mutations

## License

By contributing, you agree that your code is licensed under the MIT license.

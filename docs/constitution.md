# Constitution — ez-life

1. **Stack**: TypeScript, React, Next.js, Supabase. Every new runtime dependency requires justification in the spec.
2. **Spec → Code**: Every feature MUST have a spec in `docs/specs/` BEFORE writing code. Code without spec is unauthorized.
3. **Logic ≠ UI**: Business rules live in pure functions/hooks with zero UI imports. Components only render and delegate.
4. **Tests**: Every use case has at least one unit test. Pure logic: Vitest. UI behavior: Testing Library. No e2e until spec requires it.
5. **Persistence**: Offline-first — IndexedDB is the local source of truth. Supabase syncs to the cloud via a custom sync layer. The app MUST work fully without connectivity. Persistence is behind a repository interface.
6. **Language**: Code, types, variables, and commits in English. UI copy in Spanish (i18n-ready from day one). README and docs in Spanish.
7. **Simplicity**: If a library adds less than 50 lines of value, write it by hand. Fewer dependencies, fewer problems.
8. **Money**: All monetary values stored as integers (céntimos). Never floats. v1 operates in PEN only.

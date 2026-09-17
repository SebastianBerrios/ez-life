# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ez-life: an offline-first personal/family finance app. IndexedDB (via Dexie) is
the local source of truth; a custom sync layer pushes/pulls to Supabase
(last-write-wins by `updated_at`). Stack: TypeScript, React, Next.js 14 (App
Router), Supabase.

## Commands

- `pnpm dev` — start dev server
- `pnpm build` — production build
- `pnpm lint` — ESLint (`next/core-web-vitals` + `next/typescript`)
- `pnpm test` — run the full Vitest suite once
- `pnpm test -- src/path/to/file.test.ts` — run a single test file
- `pnpm test -- -t "test name"` — run tests matching a name

Vitest runs in `jsdom` with `fake-indexeddb/auto` and `@testing-library/jest-dom`
loaded globally (`vitest.setup.ts`), so Dexie-backed repositories/hooks can be
tested without a real browser or mocks.

## Spec-driven workflow

Feature specs live in `specs/<NNN>-<slug>/` (e.g. `specs/003-onboarding-wizard-and-categories/spec.md`),
not `docs/specs/` as `AGENTS.md` states — check `specs/` for the current
numbering. `docs/constitution.md` is the project's binding rule set (spec
required before code, logic/UI separation, offline-first requirement, money as
integer cents, dependency budget). Read the active spec and the constitution
before non-trivial changes; code without a spec is considered unauthorized by
this project's own convention.

## Architecture: layered (domain / infrastructure / presentation)

`src/core` holds framework-free business logic:
- `core/domain/models/types.ts` — the entity shapes (`Profile`, `Movement`,
  `DistributionCategory`, `ExpenseCategory`/`ExpenseSubcategory`,
  `SavingsGoal`, `IncomeSource`), all money fields stored as integer cents.
- `core/domain/repositories/IRepositories.ts` — repository interfaces
  (`IProfileRepository`, `ICategoryRepository`, `IMovementRepository`, etc.)
  that `core/use-cases/*` and presentation code depend on instead of a
  concrete store.
- `core/use-cases/*` — pure functions (budget calculation, monthly-cycle
  calculation, recurrence evaluation, deletion validation), each with a
  colocated `.test.ts`.

`src/infrastructure` implements those interfaces against IndexedDB:
- `infrastructure/db/db.ts` — the Dexie schema (`EzLifeDB`). Every synced
  table gets `creating`/`updating` hooks that mirror the write into a
  `sync_queue` table.
- `infrastructure/repositories/local/Local*Repository.ts` — Dexie-backed
  implementations of the `core/domain/repositories` interfaces. This is the
  only layer allowed to touch `db` directly.
- `infrastructure/sync/CustomSyncLayer.ts` — pulls remote rows newer than the
  last sync timestamp (remote wins on conflict), then drains `sync_queue` by
  upserting to Supabase. Invoked from `presentation/hooks/useSyncManager`
  (on mount, on `online`, and every 5 minutes while online).
- `infrastructure/supabase/client.ts` — browser Supabase client factory
  (`getSupabaseBrowserClient`), reads `NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

`src/presentation` is the only layer allowed to import React/Next:
- `presentation/components/MainFlow.tsx` is the app's de facto router — a
  single client component holding a `step` state machine
  (`loading → login → onboarding-wizard → app`) and a `currentRoute` string
  switched inside `Layout`/`BottomNav`. There is no Next.js file-based routing
  beyond the single `src/app/page.tsx` entry point.
- `presentation/hooks/` — background jobs (`useSyncManager`,
  `useRecurrenceEvaluator`) wired into `MainFlow`, not into individual screens.

`src/components/ui/*` are shadcn-generated primitives (`components.json`
config); `src/components/theme-provider.tsx` wraps `next-themes`, mounted once
in `src/app/layout.tsx`.

Path alias: `@/*` → `src/*` (both `tsconfig.json` and `vitest.config.ts`).

## Conventions from AGENTS.md / constitution.md

- Code (vars, functions, types, components, commits) in English; UI copy in
  Spanish, meant to go through i18n rather than being hardcoded.
- No business logic inside React components — it belongs in `core/use-cases`
  or a hook, not the component body.
- Money is always an integer number of cents — never a float. v1 is PEN-only.
- New runtime dependencies need justification in the relevant spec; prefer
  hand-written code under ~50 lines over a new dependency.

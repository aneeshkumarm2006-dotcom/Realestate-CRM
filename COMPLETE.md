# COMPLETE.md — build progress tracker

> What's **done** vs **remaining** for the Real-Estate CRM. Companion to
> [PLAN.md](PLAN.md) (strategy + roadmap) and [FEATURES.md](FEATURES.md)
> (per-feature spec). Status legend: ✅ done · 🟡 partial · 🔴 not started ·
> ⛔ dropped.
>
> Last updated: 2026-06-07.

---

## ✅ Done

### Deployment & infrastructure
- ✅ **Frontend on Vercel** (`realestate-crm-flame.vercel.app`) — fixed 404 (Root
  Directory `client`, Framework = Vite, output `dist`).
- ✅ **Server on Render** (`realestate-crm-q8jk.onrender.com`).
- ✅ **Google OAuth login working end-to-end** — corrected `GOOGLE_CALLBACK_URL`,
  `CLIENT_URL`, client id/secret match, and Google Console redirect URIs.
- ✅ Env-var mapping documented (Render server vars vs Vercel `VITE_API_BASE_URL`).

### Plan accuracy (codebase audit, 2026-06-07)
- ✅ **Verified the §4 inventory against real code.** Engine + comms (email Gmail/
  MS/IMAP, SMS, WhatsApp, webhooks) confirmed genuinely built; calendar, subitems,
  workspaces/permissions, saved views confirmed ✅.
- ✅ **Corrected three inventory claims:** AI lead scoring → **⛔ dropped** (no
  Anthropic dependency exists); Filters → **🔴** (was 🟡); Saved Views → **✅**
  (view-tab switcher already shipped).
- ⛔ **Anthropic AI features removed from scope** (PLAN.md §2.5 / §6). Deterministic
  lead intake (round-robin / geo / fixed) covers assignment.

### Phase 0 — De-task-tracker (reframe) — ✅ COMPLETE
- ✅ **i18n foundation** (`react-i18next`) — **EN + FR (Québec)**, browser
  detection, persisted choice, `<html lang>` sync, **adding any language = 1 JSON
  file + 1 line in `client/src/i18n/languages.js`**. Switcher in the avatar menu.
- ✅ **0.3 Nav relabel** → Dashboard · Boards · My Leads · Calendar · Members ·
  Reports (Productivity dropped from nav).
- ✅ **0.2 Productivity page shelved** (off nav, code retained).
- ✅ **0.1 My Tasks → My Leads** — assigned-to-me leads grouped by board
  (`client/src/pages/MyTasksPage.jsx`); personal-task concept retired.
- ✅ **0.5 Dashboard & onboarding reframe** — greeting, "leads waiting", quick
  actions, stat cards (Open/Completed Leads), activity/boards headings, onboarding.
- ✅ **0.4 Terminology sweep (full)** — Task→Lead across **~40 files**, **892
  namespaced keys × 2 locales**, validated EN/FR parity, **0 missing keys** at
  build time.

### Board UX improvements (2026-06-07)
- ✅ **New boards start blank** — only the primary **Lead** column; add columns on
  the spot via "+ Add column" (no preset Status/Priority/Owner/Due). Existing
  legacy boards untouched. (`buildPrimaryOnlyColumns` in `boardTemplates.js`,
  `boardController.createBoard`.)
- ✅ **Frozen Lead column** — primary column (+ drag handle + checkbox) is
  sticky/pinned-left; other columns scroll horizontally underneath, hover/highlight
  synced. (`client/src/components/board/DataGrid.jsx`.)

### Filters — quick (column-aware) — ✅ DONE
- ✅ **Board filter bar now reads the board's real columns** (Lead Status, Assigned
  To, etc.) instead of fixed legacy task fields. Status/dropdown/tags/person/
  checkbox columns each become a filter chip. Uses the canonical
  `[{columnId, op, value}]` shape via new `client/src/utils/columnFilter.js`;
  evaluated through `taskFilters.js`. Legacy boards keep the classic chips.

### Phase 1 — Core CRM parity (in progress)
- ✅ **1.1 RE pipeline template** — template engine now seeds **pipeline-stage
  GROUPS** + columns. New **"Real Estate CRM"** template (Rakotta-style leasing):
  groups `New Lead → Contacted → Follow-up → Visit Booked → Application → Lease to
  Sign → Lease Signed → Blacklisted → Archived`; columns Lead, Lead Status,
  Building, Agent, Visit Type, Language (FR/EN), Inscription/Visit/Move-in dates,
  Phone, Email, Notes. (`boardTemplates.js`, `boardController.createBoard` seeds
  `TaskGroup`s.)
- ✅ **1.2 Listings / Inventory template** — buildings as groups, units as rows,
  with Availability, Bedrooms, Bathrooms, Sqft, Price, Floor, Notes.
- ✅ **1.4 View-tab switcher** — already shipped (verified in audit).
- ✅ Templates picker shows a **stages** line; templates API exposes `groups`.

---

## 🔴 Remaining

### Phase 1 — Core CRM parity (finish)
- 🔴 **1.3 Starter RE automation recipes** — form→create lead+assign agent,
  status→notify, visit-date→reminder. Extend `server/src/seeds/automationRecipes.js`.
- 🔴 **1.5 Advanced filter builder** — Monday-style `Where [Column][Condition]
  [Value]` + **AND/OR groups** + nested groups + live count + Save-to-view +
  "Switch to quick filters" toggle. Per-type operator sets + group-tree shape.
  Spec detailed in [FEATURES.md §1.5](FEATURES.md). (Quick filters already ✅.)
  ⛔ No "Filter with AI".
- 🟡 **1.6 Group summaries** — numeric SUM/AVG footer + status battery bar per group.
- 🟡 **1.7 Form branding** — logo, cover, colors on public intake forms.
- 🟡 **1.1 (remainder)** — bilingual public intake form + starter automations wired
  to the CRM template seed.

### Phase 1b — Automations Hub & general-purpose library — 🔴
- 🔴 Automations Hub page (Health · Usage · Workflows · Connections), general
  triggers/conditions/actions, usage/observability dashboard, custom composer.
  *(Recommend trimming to the automations Rakotta actually uses — see analysis.)*

### Phase 2 — Reporting & dashboards — 🔴
- 🔴 Multi-section dashboard builder · more chart types · marketing/ROI analytics ·
  per-widget permissions.

### Phase 3 — Org structure & differentiator — 🔴
- 🔴 **3.0 Workspaces under the Organisation** — real Org → **Workspace** → Folder →
  Board hierarchy (today `Workspace` is an alias for `Organisation`). Sidebar
  becomes a workspace switcher. **Added to plan 2026-06-07; not built; existing
  data left as-is for now.** (FEATURES.md §3.0 / PLAN.md §3.3.)
- 🔴 Teams + team dashboards · roles/folders/workspace home.
- 🔴 **Agent performance + commission/salary module** (the differentiator —
  recommend pulling forward).

### Phase 4 — Comms & sales tooling — 🔴
- 🔴 Email sequences (drip cadences) · mass email tracking · quotes & invoices.

### Phase 5 — Knowledge base — 🔴
- 🔴 Docs / Workdocs (Tiptap).

### Phase 6 — Internal deployment & onboarding — 🔴
- 🔴 Signup/invites (email+password) · template gallery/onboarding · deployment
  runbook. ⛔ Stripe billing dropped.

### Later / Optional — PM integration — 🔴
- 🔴 CSV import · connector framework (Building Stack / Yardi / Buildium).

---

## Notes & deferred decisions
- **Date/number filter chips** in the quick filter bar are deferred to the Phase
  1.5 advanced builder (the `between` UI).
- **Advanced filter shape:** extend the canonical `[{columnId,op,value}]` shape
  everywhere vs. board-only — decide at 1.5 build time.
- **Workspace migration:** existing orgs → workspaces under one org, deferred to
  Phase 3 (no migration yet).
- Orphaned after Phase 0: `PersonalTaskModal.jsx` (safe to delete).

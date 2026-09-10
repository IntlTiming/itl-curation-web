# ITL Curation Web - Design & Context

Status: design phase. No application code written yet. The only artifact so far is
`prisma/schema.prisma`, which validates but has not been migrated against a real database.

This document covers **two** related projects, because they were designed together:

| Project | Role | Git host |
| --- | --- | --- |
| `itl-online-2027-pack` | ETL pipeline + chart asset storage for the 2027 season | private Gogs server |
| `itl-curation-web` | Web app replacing the Google Sheet review process (owns the DB) | GitHub |

Reference implementation for the pipeline: `itl-online-2026-pack` (existing, working).

---

## 1. What these projects do

ITL Online is an annual ITG (rhythm game) event. Community members submit stepcharts
through a Google Form; a panel of reviewers rates them; the best are selected and built
into a song pack that ships with the game.

**Today (2026):** `itl-online-2026-pack/scripts/main.py` is an ETL pipeline that reads form
responses from Google Sheets, downloads the attached `.zip` chart files from Google Drive,
parses them with the `simfile` library to extract metadata and hashes, and writes computed
chart data back into the same spreadsheet. Reviewers then work inside that spreadsheet,
each on their own personal tab. The 2026 repo **also stores the chart files themselves**
(`Songs-Submissions/`, `Songs-Selections/`).

**Planned:** the 2027 pipeline writes to a Postgres database instead of Google Sheets, and
`itl-curation-web` replaces the spreadsheet as the review interface.

---

## 2. Repo architecture (decided)

- **Two independent sibling repos.** No monorepo, no git submodules. They sit next to each
  other under `~/Documents/GitHub/` and are connected by a data contract - a version-controlled
  JSON export from the pack repo, imported by a script in this repo (see section 5) - not by
  code coupling or a shared live DB connection.
- **`itl-curation-web` is long-lived.** It has an `Event` table, so a new season is a new
  row, not a new deployment or repo.
- **`itl-online-*-pack` gets a fresh repo per season.** This was questioned and deliberately
  kept. The reason is asset hosting, not pipeline logic: the pack repo stores the actual
  chart files (audio, graphics, simfiles) for every submission (1409 submissions in 2026).
  A single persistent repo across many seasons would grow forever, since git never shrinks
  and binary re-syncs/patches accumulate in history. A fresh repo per season caps that and
  lets old seasons be archived independently.
- **Why Gogs for the pack, GitHub for the web app.** Self-hosting the binary-heavy repo
  sidesteps GitHub's storage and LFS limits. The web app is ordinary source code and is
  fine on GitHub.
- **Dependency direction:** pipeline writes (a file), web app owns the schema, imports that
  file, and reads/serves. See "The ETL to DB write contract" in section 5 for the mechanism.

> Naming collision warning: the 2026 spreadsheet has a tab literally named `GOGS`. It is a
> chart-analytics table (crossover/footswitch/jack counts, stream measures, weighted NPS)
> and has nothing to do with Gogs the git server.

---

## 3. The 2026 spreadsheet (research findings)

Spreadsheet ID: `1ven4U_oRfT4M_nZ2C7Zc6jnzRsSja_MuEctE6f6EdZw` (37 tabs).

Credentials for reading it live at `itl-online-2026-pack/scripts/services/credentials.json`
and `token.json`. The stored token has a valid refresh token and refreshes silently, so no
interactive login is needed. Scopes are `drive` and `youtube.force-ssl`; there is no
explicit Sheets scope, but the full `drive` scope covers Sheets access.

### 3.1 Tabs grouped by concern

**Intake (raw form data)**
- `Responses`, `Internal Responses` - the submission form. Submitter Discord ID,
  stepartist, pack, playstyle, difficulty slot, chart focus, tech represented, CMOD
  preference, year, theme, notes, Drive upload link, file ID.
- `Suggestions` - a separate, lighter "suggest someone else's chart" flow.

**Chart metadata (pipeline output)**
- `MASTER` - full computed metadata for every submission. This is `Chart.to_dict()` in
  `models.py`.
- `Selections` - identical schema, filtered to the finally-chosen charts.
- `chart_to_hash` - lookup feeding the sheet's dropdowns.

**Review process (what the web app replaces)**
- `TEMPLATE` plus 14 per-reviewer tabs: `Ele`, `Evan`, `Sudzi`, `Tommy`, `Vincent`,
  `Ricky`, `Valex`, `Cmmf`, `Tev`, `Hubert`, `Chino`, `Telperion`, `teejusb`, `Rynker`.
- `ALL_REVIEWS` - flattened union of the reviewer tabs. Effectively a normalized reviews
  table already.
- `Ratings` - per-chart aggregate stats (count, avg, min, max, stdev, avg passing/scoring,
  concatenated reviewer comments). Derived, not source data.
- `REVIEW_AGGREGATES` - per-reviewer DQ decisions (chart, DQ'er, reason), final selections,
  summary counts.

**Post-selection / release pipeline (deferred, not modelled)**
- `GOGS` - measured pattern analytics per chart. Output of a separate analyzer, not
  `main.py`.
- `Final Pointing` (+ dated backup) - hand-tuned scoring/balance sheet (passing points,
  scoring points, tech buffs, stamina nerf, manual overrides).
- `SQL-Release` - release-ready rows matching the production game DB insert format.
- `YouTube-Links`, `Original Hashes`, `nine-or-null change sheet` - supporting metadata.

**Game meta-content (unrelated to review)**
- `Unlocks`, `UnlockIds`, `Titles`, `Achievements`, `the stamina chain.`

**Org tooling**
- `TODO`

### 3.2 Emergent behaviour found by reading cell formulas

These are not visible from the `TEMPLATE` header row and drove most of the schema
decisions. Found by inspecting the `Vincent` and `Ricky` tabs with
`valueRenderOption=FORMULA`.

1. **`Passes basic checks?` is not a boolean.** It is a failure-reason enum typed by hand.
   Observed values: `✅`, `Beat 0`, `Profanity`, `Used before`. New values appear as
   reviewers discover new failure classes, which is why the schema uses a lookup table.
2. **`Auto DQ'd?` is a cross-sheet formula, not a manual flag.** It scans
   `REVIEW_AGGREGATES` for a DQ on the same chart raised by *someone else*, and flags TRUE.
   So one reviewer's DQ propagates automatically into every other reviewer's row, excluding
   the DQ'er's own row. It relies on a custom `getCurrentSheetName()` Apps Script function.
3. **`Duplicate?` is a formula** (`COUNTIF` over the reviewer's own hash column) that
   detects the same hash appearing twice within one reviewer's own list.
4. **`Focus` and `Tech Description` are not reviewer input.** They are `XLOOKUP`s into
   `MASTER`. Reviewers only ever type: basic check result, rating, passing, scoring, notes.
5. **`Submitter Notes` is a `TEXTJOIN` rollup that can merge multiple submitters** for one
   hash. Confirmed live. This proves **a chart hash is not 1:1 with a submission** - the
   same chart can arrive from two different people.
6. **Column A (the human-readable chart label) is the real key reviewers interact with.**
   Hash and File ID are `VLOOKUP`s off it, sourced from `chart_to_hash`.
7. **Copy-drift is real.** The `Vincent` tab's header cell A1 is a literal space instead of
   `Chart`, from repeated copy-pasting of `TEMPLATE`. There is no schema enforcement today.
8. **Passing/scoring vs basic-check failure is reviewer discretion, not a rule.** Ricky's
   `BROOKLYN` row has `Profanity` *and* a full 2.5/2/2 score; his `Mood` row has `Profanity`
   with them blank. Do not encode this as a DB constraint.
9. **Ratings use half-points** (1.5, 2.5). Passing and scoring are separate integer axes,
   not derived from rating.
10. **Independent scoring confirmed.** "Colourful Mane" scored 2/2/4 from Vincent and 0/2/4
    from Ricky.

---

## 4. Schema decisions and rationale

The schema lives in `prisma/schema.prisma` (Postgres). Key decisions:

**Identity: Google Drive `fileId` is the primary key for a submission.**
It is guaranteed present (every submission has an upload) and guaranteed unique. Critically,
it is *stable across chart revisions*, which the hash is not.

**Chart data lives on a nullable `Chart` table, 1:1 with `Submission` - no version history.**
*(Supersedes the original `ChartVersion` design below - kept for the record, not because it's
still current.)*

Originally modeled as `ChartVersion`: one row per hash the submission has ever had, plus
`currentChartVersionId` on `Submission` pointing at the current one, specifically so a
stepartist's resync/patch never silently overwrote what a reviewer had already seen.
Revisited: the only thing actually needed is knowing *that* the chart changed since it was
last reviewed, not reconstructing *what* changed or replaying a timeline. Collapsing to a
single nullable `Chart` row per submission (mutated in place on change) removes a whole
table's worth of version bookkeeping for a capability that isn't required.

`Chart` is nullable because parsing can fail, and it fails as a unit - either every field
populates together (parse succeeded) or the row doesn't exist (parse failed / hasn't run
yet). That's the reason it stays a separate table rather than ~15 individually-nullable
columns inlined on `Submission`: a satellite table makes "did parsing succeed" a structural
fact (row exists or not), not something inferred from which of several columns happen to be
null.

Explicitly accepted trade-off, in exchange for the simpler schema: no "show what changed"
diff view, and no way to reconstruct *when* two submissions' hashes started matching
(relevant to a plagiarism-timing dispute). Both still recoverable later without a schema
rewrite - add a lightweight append-only `(submissionId, hash, changedAt)` log alongside
`Chart` if that forensic capability turns out to matter; `Chart` itself doesn't need to
change shape for that.

Correction to an earlier draft of this note: `Disqualification.status = POSSIBLY_RESOLVED`
auto-detection is **not** lost. It never actually needed the full historical row - comparing
`disqualification.chartHash != submission.chart?.hash` gives the same "has this changed
since the DQ was raised" signal a version-ID comparison did. Same reasoning applies to
`Review` staleness: `review.chartHash != submission.chart?.hash`.

Bonus simplification this unlocks: the old `Submission` <-> `ChartVersion` relation was
circular purely because `ChartVersion` also needed a `submissionId` FK back for the
1-to-many `chartVersions` collection, so `Submission` needed its own separate
`currentChartVersionId` pointer to say *which* of the many was current. A genuinely 1:1
`Chart` doesn't have that ambiguity - `Chart.submissionId` (now `@unique`, keeping the same
FK direction and `onDelete: Cascade` `ChartVersion` already had) is sufficient on its own,
and `Submission.chart` is just a virtual back-relation with no column. The
`currentChartVersionId` pointer and its `onDelete: NoAction` workaround are gone entirely,
not just the history rows.

**Implemented in `schema.prisma`.** `Chart` (was `ChartVersion`), `Submission.chart`,
`Review.chartHash`, `ReviewRevision.chartHash`, and `Disqualification.chartHash` all reflect
the design above. Validated with `npx prisma@6 validate`.

**Reviews update in place, with an append-only audit log.**
`@@unique([submissionId, reviewerId])` keeps one live review per reviewer. `ReviewRevision`
preserves each superseded `(chart version, score)` pairing so "rated 1.5 before the resync,
3 after" stays answerable.

**Disqualifications are chart-level and can be multiple per submission.**
No unique constraint. Stored once and surfaced to every reviewer, replacing the sheet's
propagation formula. Each DQ snapshots its chart version and carries a
`status` of `ACTIVE` / `POSSIBLY_RESOLVED` / `CLEARED`, so a DQ can go stale when the
stepartist fixes the problem, rather than silently applying forever.

**Auth is Discord OAuth.** `User.discordId` is the external identity. This also upgrades the
form's free-text "Your Discord ID" field into a verified account reference.

**Access is per-event.** A reviewer sees an event only if they hold an `EventRole` on it.
The single bypass is `User.isGlobalAdmin`, so the effective check is
`isGlobalAdmin OR exists(EventRole ...)`. Keep that OR in one authorization helper; writing
it by hand at each call site is how you get an access-control bug.

**Reason vocabularies are lookup tables, not enums.** `BasicCheckReason` and
`DisqualificationReason`, both optionally scoped to an event (`eventId` null = global), so
admins can add a reason mid-season without a migration and deploy.

**Tech tags are normalized** into `TechTag` + `SubmissionTechTag`, replacing the 18 flat
`has_*` columns the spreadsheet needed for filtering. Note the distinction between
*submitter-claimed* tech (from the form, on the submission) and *measured* pattern counts
(computed from the chart, would belong on `Chart`).

**`Submission.songDir` is nullable, not required.** It's the pipeline's downloaded/extracted
directory - known as soon as an attachment downloads successfully, before chart parsing ever
runs, which is why it lives on `Submission` rather than the nullable `Chart` row (a later,
separate pipeline stage). It's nullable because a submission can still get a row with
`processingError` set and no `songDir` yet - see below.

**`Submission.processingError` gives curators visibility into pipeline failures instead of a
silent drop.** Mirrors the ETL pipeline's `status` field: `null` means the pipeline's
`"Success"`, non-null is the pipeline's raw `"Error: <message>"` text (e.g. "Could not fetch
Drive metadata for this file"). A failed submission still gets a `Submission` row so curators
can see it and act on it (e.g. ask the stepartist to re-upload), rather than the row simply not
existing. `songDir`/`bannerSlug` are nullable for the same reason - they depend on the
pipeline's download/extraction step succeeding, which a `processingError` row hasn't done.
`driveMd5` is the one exception and stays required: the Google Form itself enforces a file
upload, so Drive's checksum is always fetched regardless of what happens afterward.

**`Submission.consentToPublicReview`** follows the same pattern as `CmodPreference`: nullable
to represent "left unanswered" rather than inventing a fourth enum value for it.

**`Submission.releaseYear`** is a nullable `String`, deliberately not `Int` - the source form
field is free text and often blank, not guaranteed to be a clean year.

**`Submission.bannerSlug`** is an opaque `md5(salt + songDir)` digest used only to locate
banner image assets externally - not a foreign key, not derivable from other stored columns
without also knowing the pipeline's (not stored here) salt.

**`Submission.singleTechTagId` / `singleTechTag`** models the pipeline's
`tech_represented_single` (the single-tech companion to `focus == "Tech/Timing - single
tech"`) as a nullable FK into `TechTag` rather than a raw string duplicate, so curators can
actually filter/join on a submission's single-tech focus instead of just displaying it. Matched
against `TechTag.label` (now `@unique`) at import time, the same join key `tech_represented`
uses. Needs an explicit relation name (`SubmissionSingleTechFocus`) since `TechTag` already has
one relation to `Submission` via `SubmissionTechTag`.

**`Chart.playstyle` / `Chart.difficulty`** are parsed from the chart file itself, independent
of (and occasionally divergent from) the submitter-claimed `Submission.playstyle`/`difficulty`.
Reuses the existing enums. Not building submitted-vs-actual mismatch detection now, but this is
what would enable it later.

**GOGS measured pattern analytics are implemented on `Chart`, not deferred.** The techcount
engine (`itl-online-2027-pack/scripts/techcount`) computes these for every parsed chart, so
persisting them now avoids throwing the data away. Two nullability tiers: `totalJumps`,
`lengthSeconds`, `totalMeasures`, `totalBreakMeasures`, `totalStreamMeasures`,
`totalTrueStreamMeasures`, `weightedNps`, and `hasSignificantTimingChanges` are always populated
whenever a chart parses at all; the ten tech-count fields (`bracketCount`,
`crossoverCount`, etc.) are individually nullable, because the underlying foot-placement parity
solver can fail to converge for a specific chart without failing the rest of the row (confirmed
by reading `techcount`'s `compute_chart_stats` directly - non-convergence is caught internally,
not raised). The engine's own docs also list non-dance-single/dance-double charts as a null
case for those fields, but that's unreachable for this pipeline: both projects only ever deal
with "dance" (ITG/DDR-style) charts, never "pump" or any other game, and `chart_metadata.py`
only ever selects a chart matching the submission's own single/double playstyle.

`hasSignificantTimingChanges` is a deliberate rename of the pipeline's `disqualified` JSON
field. That field is a port of ITGmania's `Steps::HasSignificantTimingChanges()` (stops/delays/
warps/speed-or-scroll changes, or a >3 BPM display-range spread) - an engine-level
pattern-analysis heuristic, not a curation decision. Keeping the source name would have
collided in meaning with the existing `Disqualification` model, which records an actual
reviewer DQ ruling; a chart can trip the engine flag with zero `Disqualification` rows, or the
reverse.

### Working with the schema

The default `npx prisma` now resolves to Prisma's new platform CLI (8.x), which restructured
commands and does not have `validate`. Pin the classic line:

```sh
DATABASE_URL="postgresql://user:pass@localhost:5432/db" \
  npx prisma@6 validate --schema prisma/schema.prisma
```

Migrated to the simplified nullable 1:1 `Chart` model described in "Schema decisions" above.
The old circular relation (`currentChartVersionId` / `submissionId`, pinned to
`onDelete: NoAction, onUpdate: NoAction` on the current-version side) is gone - `Chart` now
holds a single `@unique submissionId` FK with `onDelete: Cascade`, and `Submission.chart` is
a plain virtual back-relation. Don't reintroduce a `currentChartId`-style pointer on
`Submission`; it's redundant once `Chart` is genuinely 1:1.

---

## 5. Open items

**Decided**
- **`GOGS` measured pattern analytics are implemented, not deferred.** Previously listed below
  under "Deferred by decision" - the pipeline's techcount engine already computes these fields
  for every parsed chart, so they were added to `Chart` rather than thrown away. See "Schema
  decisions and rationale" above for the field list and nullability rules, and the TechTag
  reference table below for the unrelated tech-tag seed data also confirmed this round.
- **The ETL to DB write contract is batch/file-based, not a live API.**
  `itl-online-2027-pack` emits a JSON export per run - submission form fields, plus parsed
  `Chart` fields if parsing succeeded or an explicit "parsing failed" marker if not - and
  version-controls that export in the pack repo the same way `submissions.json` already is.
  A Prisma-based import script living in `itl-curation-web` (not yet written) reads that
  export and does the actual write: upsert `Submission` by `fileId`, upsert-or-null `Chart`,
  comparing the incoming hash against `submission.chart.hash` before touching anything so a
  rerun with no real changes is a no-op.

  Chosen over a live HTTP API because `itl-curation-web` has no hosting/deployment decided
  yet (see below), and there's a single operator running both repos locally - no network
  round-trip is needed to get value now. Still keeps "web app owns the schema" intact:
  only Prisma-backed code in this repo ever writes to Postgres, and the pipeline never
  holds a DB credential, only ever writes a plain JSON file it already knows how to write
  (same pattern as `submissions.json`). Expected to evolve into calling an HTTP API later
  once the web app actually has somewhere to run, without changing the ingest contract or
  upsert logic - only the transport changes.

**Not yet designed**
- **Selections / final pack build.** What `--build-pack` consumes, and how a selection
  decision is recorded (who selects, when, per-event slot targets).
- **The import script itself.** Not yet written - needs the actual upsert logic described
  above, plus a decision on partial-failure behavior (crash partway through applying one
  export - retry the whole file, or resume from where it stopped?).
- **Web app framework.** Only Prisma + Postgres are chosen. No framework, hosting, or
  frontend decisions made.

**Deferred by decision (later phase, deliberately out of v1)**
- `Final Pointing` scoring/balance model.
- `SQL-Release` output generation.
- `Unlocks` / `Titles` / `Achievements` game meta-content.

---

## 6. TechTag reference table

Confirmed 2026-09-09, sourced from `itl-online-2027-pack/scripts/models.py`'s `bxf_list` /
`tech_list` / `notech_list` (the exact "tech represented" checkbox labels the pipeline
classifies, checked directly - 2027 dropped the shorthand-code layer 2026 needed). Codes below
reuse 2026's `tech_shorthand_map` where a precedent existed, plus 2 newly confirmed codes for
the 2 labels that had none. Reference data for the seed script that will exist once an import
script is written - not seeded yet.

| Label | Category | Code |
| --- | --- | --- |
| Brackets (includes Bracket Taps) | BXF | `BR` |
| Crossovers | BXF | `XO` |
| Footswitches | BXF | `FS` |
| Jacks | TECH | `JA` |
| Sideswitches | TECH | `SS` |
| Doublesteps w/ Mines | TECH | `Mine-DS` |
| Holds/Rolls (Wadatsumis; Footswitching holds; Holdstream) | TECH | `Holds-Rolls` |
| Center-tech | TECH | `CT` |
| Mine dodge | TECH | `MD` |
| Kickswitches | TECH | `KS` |
| Bursts (includes Drills) | NOTECH | `BU` |
| Rhythms (Swing) | NOTECH | `RH-SW` |
| Rhythms (Skittles) | NOTECH | `RH-SK` |
| Stepjumps | NOTECH | `SJ` |
| Flams | NOTECH | `FL` |
| Doublesteps w/ Holds | NOTECH | `Hold-DS` |
| (Doubles) Stretch | NOTECH | `ST` |
| (Doubles) Movement | NOTECH | `MV` |
| (Doubles) Center/Transitions | NOTECH | `DUB-CT` (new, no 2026 precedent) |
| (Doubles) Half-Doubles | NOTECH | `DUB-HD` (new, no 2026 precedent) |

**Decided by me, never explicitly confirmed - challenge these first**
- Normalizing tech tags into `TechTag` + `SubmissionTechTag`.
- Two separate reason tables rather than one table with a `kind` discriminator. Justified by
  2026's vocabularies not overlapping (`Beat 0` / `Profanity` / `Used before` for basic
  checks vs `Unauthorized` for DQ), but they are structurally identical.
- `Event.name` is not unique. Only `slug` is.

---

## 7. Notes for the 2027 pipeline

Candidate improvements, **not yet agreed**:

- **Write to Postgres instead of Google Sheets.** This is the whole point of the split. The
  pipeline itself doesn't write to Postgres at all - it emits a version-controlled JSON
  export (see section 5, "The ETL to DB write contract"), which a script in `itl-curation-web`
  imports.
- **Fix the silent-refresh gap in `services/google.py`.** `get_credentials()` checks
  `if not creds or not creds.valid` and immediately falls back to a full interactive
  `InstalledAppFlow` browser login. It imports `Request` but never calls
  `creds.refresh(Request())` first, so an expired access token forces a browser login even
  though a perfectly good refresh token is sitting in `token.json`. Verified this session:
  the stored 2026 token was months expired and refreshed silently in one call.
- **Consider separating chart assets from pipeline code.** The current repo bundles both.
  Splitting them would let pipeline code be persistent and event-parameterized while assets
  stay season-scoped, but this was explicitly *not* adopted - see section 2.

### 2026 pipeline shape, for reference

`main.py` flow: authenticate to Google, read form responses from two sheet ranges (public +
internal), delete local songs no longer present in the responses, download and extract new
or updated `.zip` attachments from Drive (detecting updates by Drive `md5Checksum`), parse
each simfile to build `Chart` objects, enforce a per-submitter cap on restricted charts
(`MAX_SUBMISSIONS_SINGLES = 10` for singles at meter >= 9), sort, write local
`songs.json` / `charts.json`, push to the `MASTER` and `chart_to_hash` sheets, prune unused
simfiles from each song folder, and optionally zip the whole songs folder.

Supporting modules: `models.py` (`FormResponse`, `Chart`, `SongMetadata`, `Selection`,
plus the tech shorthand map and focus-bucketing logic), `constants.py` (sheet IDs and
ranges, difficulty prefix maps, filename sanitizing), `services/google.py` (auth and
service builders), `gshash.py` (chart hashing).

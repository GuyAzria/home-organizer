# HOME ORGANIZER — NON-NEGOTIABLE DEVELOPMENT CONTRACT

These rules apply to EVERY code, database, frontend, AI, translation, configuration, test, and documentation change in this repository.

They are mandatory. Do not weaken, bypass, reinterpret, or ignore them for convenience.

The objective is to preserve security, correctness, Home Assistant compatibility, HACS compatibility, user data, backward compatibility, maintainability, and the existing project architecture.

---

# RULE 1 — UNDERSTAND BEFORE MODIFYING

Before changing anything:

- Inspect the existing implementation.
- Inspect callers, imports, data flow, APIs, database usage, frontend usage, configuration flow, translations, and tests.
- Determine all affected files.
- Do not assume something does not exist.
- Do not replace existing architecture unless explicitly required.
- Prefer the smallest safe change.

Never modify only the file mentioned by the user without checking its dependencies and consumers.

---

# RULE 2 — NEVER INVENT COMPLETION

Never claim that something was:

- changed
- fixed
- tested
- validated
- verified
- HACS compatible
- Home Assistant compatible

unless it was actually performed and the result is available.

Never hide failures, warnings, skipped tests, or unresolved issues.

---

# RULE 3 — VALIDATE EVERY MEANINGFUL CHANGE

After every meaningful change, run the appropriate existing validation.

Use the project's established checks, including when applicable:

```text
python tools\check_blocking_io.py custom_components/
python tools\check_call_arity.py custom_components/
python tools\check_frontend_escaping.py custom_components/
python tools\check_versions.py
python -m ruff check custom_components/
python -m bandit -r custom_components/ -ll -c pyproject.toml
python -m compileall -q custom_components\home_organizer
ha_full_check
```

Also run relevant project tests.

The full gate actually used on this project, in this order:

```bash
# 1. clear caches first - stale __pycache__ and .ruff_cache produce false results
rm -rf custom_components/home_organizer/.ruff_cache
find . -name __pycache__ -type d -exec rm -rf {} + 2>/dev/null

# 2. every regression suite (st2..stNN). A new suite is added per feature and
#    NEVER removed - they are the record of what has already broken once.
for t in mig st2 st3 st4 st5 st7 st8 st9 st10 st11 st12 st13 st14 st15 \
         st16 st17 st18 st19 st20 st21 st22; do
  python3 /tmp/$t.py >/dev/null 2>&1 || echo "SUITE FAIL: $t"
done

# 3. every JS file must parse (excluding vendored bundles)
for f in $(find custom_components -name "*.js" ! -name "barcode-detector.umd.js"); do
  node --check "$f" || echo "PARSE FAIL: $f"
done

# 4. lint and compile
python3 -m ruff check custom_components/home_organizer --select=E9,F,B --ignore=E501
python3 -m compileall -q custom_components/home_organizer

# 5. the project gate - must end BLOCKER 0, ERROR 0, HOT_WARN 0
python3 tools/ha_full_check.py --root .
```

For a release, also run the gate with the tag set, so the manifest version and
the git tag are checked against each other:

```bash
GITHUB_REF_NAME=v2026.9.13 python3 tools/ha_full_check.py --root .
```

Frontend behaviour that `node --check` cannot reach — rendering, event
handlers, state transitions — is tested with a small fake DOM in Node. This is
not optional: most defects in this project were in that layer and were found
only this way. See RULE 3a before trusting a failure from one of these.

For Home Assistant integration changes, run Home Assistant/HACS validation, including hassfest or the project's established equivalent, when available.

Never replace a failing validation with a weaker validation.

A task is not complete while required validation is failing.

## 3a — A FAILING TEST IS A CLAIM, NOT A VERDICT

When a check fails, the first question is ALWAYS: is the CODE wrong, or is the
TEST wrong? Answer that before changing anything.

In practice the harness is wrong at least as often as the code. Real cases from
this project:

- A fake DOM returned a NEW context object from every `getContext()` call, so
  the assertions inspected a different object than the handler had drawn into.
- A fake DOM had no `getBoundingClientRect`, so canvas sizing crashed.
- `recipeList` was left undefined, so the view took its first-load branch and
  rendered a placeholder instead of the screen under test.
- A `_t` stub returned the English default for every key, so a test asserting
  "the Hebrew phrase is sent" was testing the stub, not the code.
- An assertion searched for a raw `>` in HTML that `escapeHtml` had correctly
  turned into `&gt;` — the escaping was right and the test was wrong.
- Node 22 defines a READ-ONLY global `navigator`. `global.navigator = {...}`
  is silently ignored; use `Object.defineProperty`.
- Tool output is JSON-encoded, so every backslash appears doubled. Never
  "fix" an escaping problem based on how a string LOOKS in terminal output —
  count the characters, or test the behaviour.

When a test fails, fix the harness and re-run BEFORE touching working code.
Never weaken an assertion to make it pass. If an assertion turns out to
describe the wrong behaviour, replace it with one that describes the right
behaviour — often the inverse, e.g. asserting that raw `>` is NOT emitted.

---

# RULE 4 — HOME ASSISTANT AND HACS COMPATIBILITY

The integration must remain valid for the declared Home Assistant version and HACS.

- Do not use APIs unavailable on the declared minimum version.
- Do not silently change the minimum supported Home Assistant version.
- If the minimum version changes, update all required metadata and validation.
- Validate manifest, config flow, translations, frontend resources, integration structure, and dependencies.
- Never assume local execution means HACS compatibility.

---

# RULE 5 — DATABASE DATA IS SACRED

Never:

- delete existing user data
- reset existing data
- recreate a database destructively
- overwrite user data with defaults
- silently destroy historical data
- silently delete receipts, inventory, categories, or purchase history

Existing user-created data must survive updates.

Use safe, backward-compatible database mechanisms.

`CREATE TABLE IF NOT EXISTS` or an equivalent safe migration mechanism must be used where appropriate.

Default/seed data may only be inserted according to the established project migration design.

---

# RULE 6 — DATABASE MIGRATIONS

Before changing a schema, verify:

1. Fresh installation behavior.
2. Upgrade when the table does not exist.
3. Upgrade when the table already exists.
4. Restart behavior.
5. Existing records referencing old values.
6. User-created values.

Every migration must be idempotent.

Repeated execution must not duplicate, reset, or destroy data.

---

# RULE 7 — LLM ISOLATION

The LLM must NEVER choose executable Home Assistant:

- domain
- service
- entity_id

The LLM may produce only a constrained intent.

The backend must deterministically map that intent to a static, vetted allow-list.

Never pass arbitrary model-generated domain/service/entity_id to:

```text
hass.services.async_call
```

The LLM output is untrusted input.

Prompt instructions are NOT a security control.

Security must exist in deterministic backend code at the final execution boundary.

---

# RULE 8 — ENTITY RESOLUTION

Entity IDs must NEVER come directly from model output.

Entity resolution must use:

- a server-side allow-list, or
- an explicitly configured Home Assistant exposure/permission mechanism.

If deterministic resolution fails:

DO NOT EXECUTE.

Never fall back to a model-supplied entity_id.

---

# RULE 9 — SENSITIVE ACTIONS

Locks, alarms, covers, garage doors, gates, and other security-sensitive or physically consequential devices require deterministic authorization.

Where required by the established architecture, they also require explicit confirmation from the same authenticated user.

Confirmation must be a separate execution request.

A model-generated statement is never proof that an action occurred.

---

# RULE 10 — EXECUTION STATUS

The system must distinguish:

- requested
- authorized
- executed
- failed
- current Home Assistant state

Only backend-confirmed execution may be reported as successful.

The LLM must never invent execution success.

---

# RULE 11 — UNTRUSTED CONTEXT

The following are untrusted:

- calendars
- shopping lists
- notes
- receipts
- OCR
- external documents
- web content
- user-provided text
- other integrations
- LLM output

They may be analyzed by the LLM.

They must NEVER independently authorize or execute an action.

Prompt injection from any such source must not bypass:

- authorization
- allow-lists
- confirmation
- permissions
- security controls

Only an explicit authenticated user request may initiate an executable action.

---

# RULE 12 — HOME ASSISTANT AUTHORIZATION

Never bypass Home Assistant authorization.

When invoking services directly, explicitly verify the authenticated user's authorization using the actual supported Home Assistant API for the repository's target version.

Do not invent permission APIs.

If authorization cannot be verified:

FAIL CLOSED.

---

# RULE 13 — NON-BLOCKING ASYNC

Never perform blocking I/O directly inside async Home Assistant code.

Do not directly use blocking:

- `open()`
- `remove()`
- `rmtree()`
- blocking network calls
- equivalent blocking operations

Use asynchronous APIs or Home Assistant's supported executor mechanisms.

Review every new async function for blocking operations.

---

# RULE 14 — SECRET PROTECTION

Never expose API keys, tokens, passwords, or secrets in:

- URLs
- query parameters
- frontend JavaScript
- logs
- exceptions
- user-visible errors
- Git
- source-controlled configuration

Use secure credential mechanisms such as headers where supported.

Use the correct Home Assistant password/secret selector.

Never log a URL containing credentials.

Sanitize errors before logging.

---

# RULE 15 — FRONTEND SECURITY

Treat all frontend input as untrusted.

This includes:

- user input
- LLM output
- OCR
- database content
- external content

Never inject untrusted data using `innerHTML` or equivalent unsafe mechanisms.

Prefer:

```text
textContent
```

and safe DOM APIs.

If HTML is genuinely required, sanitize it using an appropriate trusted mechanism.

Never construct executable JavaScript from untrusted data.

---

# RULE 16 — LOCAL FRONTEND ASSETS

No external CDN dependencies.

Required JavaScript, CSS, fonts, images, and other frontend assets must be locally packaged and served by the integration.

---

# RULE 17 — ENGLISH-ONLY CODEBASE

ENGLISH IS THE ONLY LANGUAGE ALLOWED INSIDE THE CODEBASE.

All of the following must be written in English:

- Python code
- JavaScript code
- HTML
- CSS
- SQL
- variable names
- function names
- class names
- constants
- database identifiers
- API identifiers
- comments
- docstrings
- log messages
- developer-facing errors
- internal AI prompts
- AI schemas
- internal configuration
- test names
- test descriptions
- code documentation

Do not add Hebrew, Russian, Arabic, Spanish, or any other natural language directly into code.

English is the canonical internal language.

---

# RULE 18 — UI TRANSLATION

User-visible UI text must NEVER be hardcoded directly in a non-English language.

Every user-visible string must use the project's established translation mechanism.

The English translation is the canonical source.

Whenever UI text is added, changed, removed, or corrected:

1. Update the appropriate translation structure.
2. Update the project's translation Excel file.
3. Keep the Excel translation data synchronized with the application.
4. Preserve existing translation keys and structure.
5. Validate the translation through the project's established validation process.

Never create arbitrary Home Assistant translation keys.

Before modifying Home Assistant translation files, inspect the actual schema and current Home Assistant requirements.

A JSON file that looks valid is not necessarily a valid Home Assistant translation file.

---

# RULE 19 — TRANSLATION QUALITY AND AI TRANSLATION ERRORS

AI-generated translations are untrusted and must be reviewed.

Never assume an AI-generated translation is correct.

For every translation change:

- verify meaning
- verify context
- verify placeholders
- verify variables
- verify pluralization where applicable
- verify UI terminology consistency
- verify formatting
- verify that no English technical identifier was translated accidentally
- verify that no user-visible text remains untranslated

If an AI previously created an incorrect translation:

1. Identify the incorrect translation.
2. Correct the application translation.
3. Correct the translation Excel file.
4. Keep the translation key consistent.
5. Verify all affected languages.
6. Run the relevant translation/Home Assistant validation.

Never silently leave a known translation error.

---

# RULE 20 — USER LANGUAGE ↔ ENGLISH AI PIPELINE

The application's internal AI communication language is ENGLISH.

When the user selects a non-English interface language:

```text
User language
    ↓
Translate user command to English
    ↓
AI receives English
    ↓
AI returns English
    ↓
Backend validates/processes English result
    ↓
Translate final user-visible response to selected UI language
    ↓
User
```

The AI must NOT receive mixed-language internal instructions.

The backend must not depend on the user's language to perform security decisions.

Security, authorization, intent validation, entity resolution, and execution must operate on the canonical English/internal representation.

Translations must never alter executable identifiers such as:

- domain
- service
- entity_id
- database identifiers
- API fields
- security tokens
- internal enum values

---

# RULE 21 — SINGLE SOURCE OF TRUTH

Do not duplicate persistent data across frontend files.

Categories, sub-categories, entities, configuration, and other persistent data must have one authoritative source.

Persistent user data must not exist only inside HACS-delivered JavaScript.

HACS updates must never overwrite user-created data.

---

# RULE 22 — USER-CREATED CATEGORIES

User-created categories and sub-categories are persistent database data.

They must not be stored only in HACS-delivered files.

Default categories may be seeded during initial database creation according to the established ordering.

AI must not automatically create a new top-level category.

New top-level categories require explicit user action.

Never automatically delete categories or sub-categories.

A newly created top-level category must receive the required default `General` sub-category when required by the existing two-stage selector architecture.

---

# RULE 23 — RECEIPTS AND PURCHASE HISTORY

AI-extracted receipt data is untrusted until user confirmation.

Do not write purchase history merely because AI extracted an item.

Use the user's edited values when confirming.

Rejected items must not enter purchase history.

Do not delete existing receipt records merely because items were rejected.

Keep draft and confirmed receipt states distinguishable.

---

# RULE 24 — MULTI-PAGE RECEIPTS

Never assume every receipt image is a new receipt.

Continuation pages may lack headers.

Use deterministic evidence and explicit state.

Do not silently merge unrelated receipts.

Do not silently delete possible duplicate products.

The same product appearing twice may represent legitimate multiple purchases.

---

# RULE 25 — BACKWARD COMPATIBILITY

Existing users must continue to access existing data after updates.

Preserve:

- categories
- sub-categories
- receipts
- inventory
- barcode history
- purchase history
- settings
- user-created values

If a representation changes, provide a safe compatibility path.

Do not introduce destructive changes without explicit approval.

---

# RULE 26 — CODE CHANGE EXPLANATION

Every completed coding task must be explained in the final chat at CODE LEVEL.

For every modified file report:

1. Exact file path.
2. Exact function/class/method/component/handler/DB section changed.
3. What changed.
4. Why it changed.
5. How it works now.
6. Security implications.
7. Home Assistant/HACS implications.
8. Database/frontend/compatibility implications where applicable.
9. Tests and validation performed.

Do not give only a high-level statement such as "fixed the issue".

The explanation must allow the developer to understand the actual implementation change.

---

# RULE 27 — FILE MODIFICATION VERSION HISTORY

Whenever a source/code file is actually modified, update its existing modification-history comment.

First inspect the file and follow its EXISTING project/file convention.

Do not invent a new versioning format.

For example, if the file uses:

```text
# [MODIFIED v2026.9.16 | 2026-09-16] Purpose: <short description>
```

continue using that format.

The version/date must represent the actual change.

Only files actually modified receive a new modification-history entry.

---

# RULE 28 — KEEP ONLY TWO FILE HISTORY ENTRIES

For each modified source file:

- Keep only the TWO most recent modification-history entries.
- Remove older modification-history entries.
- Preserve the existing format.

Do NOT remove:

- license information
- copyright information
- permanent architectural comments
- permanent security comments
- required implementation documentation
- Home Assistant/HACS explanatory comments

Do not rewrite historical entries merely to change their appearance.

---

# RULE 29 — FILE VERSION ≠ INTEGRATION RELEASE VERSION

Per-file modification history is separate from the integration release version.

Changing a source file does NOT automatically require changing `manifest.json`.

Only change the integration release version when the release process requires it.

When changing the integration release version, keep:

- `manifest.json`
- release/tag information
- release notes
- project version checks

consistent.

Never invent a release version.

---

# RULE 30 — NO UNREQUESTED ARCHITECTURAL CHANGES

Do not refactor unrelated code.

Do not change:

- database architecture
- API architecture
- UI architecture
- AI routing
- security architecture
- persistent data semantics
- public behavior

unless required for the requested task or explicitly approved.

If an improvement is discovered but is not required, report it separately.

---

# RULE 31 — FAIL CLOSED

If security, authorization, entity resolution, data integrity, schema validity, translation validity, or execution status cannot be established:

DO NOT GUESS.

DO NOT EXECUTE.

DO NOT DELETE.

DO NOT MODIFY USER DATA.

DO NOT BYPASS A SECURITY CONTROL.

Inspect the actual code/API or ask for clarification.

---

# RULE 32 — NEGATIVE SECURITY TESTS

Security-sensitive changes must include negative tests where applicable.

At minimum verify relevant cases such as:

```text
Unauthorized user -> rejected
Unknown entity -> rejected
Arbitrary model service -> rejected
Arbitrary model entity_id -> rejected
Calendar prompt injection -> cannot execute
Shopping-list prompt injection -> cannot execute
Sensitive action without confirmation -> rejected
Failed HA service -> never reported as successful
Existing database -> unchanged
User-created category -> survives restart/update
Invalid translation -> caught
Blocking I/O -> caught
```

Never weaken security controls to make a test pass.

Security controls must remain enforced at the final execution boundary.

---

# RULE 33 — STOP CONDITIONS

Stop and request approval before proceeding if a change would:

- delete or rewrite existing user data
- destructively change the database schema
- remove backward compatibility
- change the minimum Home Assistant version
- change authentication/authorization architecture
- allow a previously forbidden HA service
- allow the LLM to select an executable service/entity
- remove a security control
- introduce an external frontend dependency
- change persistent user-data semantics
- require a major architectural rewrite

---

# RULE 33a — BUG CLASSES THAT HAVE ALREADY HAPPENED

These are real defects from this project. Each one shipped, was reported by a
user, and cost a release. Check for them BY NAME before declaring a task done.

## 33a.1 — A new UI mode must be cleared everywhere

This bug shipped THREE times: `isReceiptsMode`, `isRecipesMode`, and
`isBarcodeMode`.

Adding `isFooMode` means updating the button that ENTERS it AND every other
entry point that must LEAVE it. Miss one and the new mode stays `true`
forever, wins every later render, and the user can only escape via Home.

Required check after adding or changing any view mode — every entry point must
leave exactly one mode set, and must explicitly clear all the others:

```javascript
const MODES=['isChatMode','isReviewMode','isReceiptsMode','isRecipesMode',
             'isShopMode','isSearch','isStylistMode','isBarcodeMode'];
for (const m of src.matchAll(/click\('(btn-fab-[a-z]+|btn-home)',\s*\(\)\s*=>\s*\{([\s\S]*?)\}\);/g)) {
  const st={}; for (const a of m[2].matchAll(/this\.(is[A-Za-z]+)\s*=\s*(true|false)/g)) st[a[1]]=a[2]==='true';
  const on=MODES.filter(k=>st[k]), missing=MODES.filter(k=>!(k in st));
  // btn-home: 0 modes on. Everything else: exactly 1. missing must be empty.
}
```

A single-line regex replacement will MISS multi-line handlers. Always re-run
the audit after the edit rather than trusting the replacement count.

## 33a.2 — Schema, handler and caller must agree

A websocket action was added to the handler but not to the `vol.In` list.
Voluptuous rejected it before the handler ran, so the button did nothing at
all and no error surfaced.

Cross-check all three sides whenever an action is added:

```python
allowed = set(re.findall(r'"([a-z_]+)"', schema_in_block))
handled = set(re.findall(r'if action == "([a-z_]+)"', backend))
sent    = set(re.findall(r"action:\s*'([a-z_]+)'", frontend))
assert not (sent - allowed) and not (sent - handled)
```

## 33a.3 — Positional arguments and positional columns

Two defects of the same shape:

- `_dispatch(hass, entry, ...)` was called where the signature is
  `_dispatch(domain_name, hass, ...)`. `hass` landed in `domain_name`,
  the lookup returned nothing, and the agent silently never ran. Syntactically
  valid, so ruff and every linter passed.
- `_row_to_dict` read `row[0]`..`row[12]`. Adding columns made the new ones
  invisible, and inserting one in the middle would have shifted every field.

Rules: read database columns BY NAME (`aiosqlite.Row`), and verify call sites
against the signature with an AST check, not by eye.

## 33a.4 — Truthiness traps

- `[]` is truthy. `if (cache[key]) return;` treated an empty cached array as
  "already loaded", so a receipt that was fetched before its items were linked
  stayed empty forever. Use `Array.isArray(x) && x.length`.
- A non-empty dict is truthy. Finishing a recipe wrote
  `{"steps": [], "current_idx": 0}` instead of clearing the state, so the agent
  believed a recipe was still running. Clear state; never blank it.
- `None != "All"` is true. Passing `date_filter=None` sent a query down the
  SEARCH branch instead of the browse branch.

## 33a.5 — `innerHTML =` destroys appended children

An empty-state message was assigned with `listContainer.innerHTML = ...` after
a panel had been appended to the same container. The panel was built and
immediately destroyed, so the screen looked as though nothing had happened.

Append elements; never assign `innerHTML` to a container that already holds
dynamically added children.

## 33a.6 — The same data is serialised in more than one place

`database.py` builds item rows in THREE separate blocks (location view, search,
shopping). Fields were added to two of them, so an item opened from a shelf
showed nothing.

Before adding a field, `grep` for EVERY construction site and fix them all.
Insert new keys as the FIRST entries of a dict literal — appending at the end
requires adding a comma to whatever the previous last line was, which is how a
syntax error was introduced.

## 33a.7 — Strings belong to one context

The recipe panel reused `scan_in_progress`, whose Hebrew reads "reading the
receipt". Correct for the scanner, wrong and confusing on a recipe screen.

Never borrow a translation key from another feature because the English
happens to fit. Every context gets its own key.

## 33a.8 — Do not clobber fields on re-save

An AI regenerating a recipe must not erase the user's handwritten notes, prep
time, or category. An UPDATE writes ONLY the columns it was actually given;
an omitted argument means "leave alone", never "clear".

This is also why `update` is a separate action from `save`: `save` stamps
`source_type='manual'`, which would relabel an AI recipe as the user's.

---

# RULE 33b — FRONTEND ENVIRONMENT FACTS

Hard-won, non-obvious, and all of them caused a user-visible bug.

## Text direction
This panel signals direction with an `.ltr` CLASS on `#app`. It NEVER sets a
`dir` attribute, so `[dir="rtl"]` selectors silently never match. Home
Assistant sets `dir` on its own document and the shadow tree inherits the
computed `direction`, so LOGICAL properties work and physical ones do not.

Use `padding-inline`, `inset-inline-start`, `border-inline-end`. Never
`padding-left` plus a `[dir="rtl"]` override.

## Canvas
- Set BOTH the backing store (`canvas.width`) and the CSS box
  (`canvas.style.width`) explicitly. Leaving the box to `inset: 0` makes the
  two agree only by accident, and the ink lands away from the pointer.
- Cap total pixels at roughly 14 million. iOS Safari refuses to allocate above
  ~16.7M and returns a BLANK canvas with no error — on a tall page at dpr 3
  this is easy to exceed.
- `touch-action: none` over a whole page prevents scrolling. Use `pan-y` and
  lock scrolling only for the duration of a stroke.
- Distinguish pointer types: pen and mouse draw, finger scrolls.

## Feature detection in webviews is unreliable
`'speechSynthesis' in window` returns false in the Android companion app even
though the engine works. Two rounds of widening the check still failed.

When a capability check hides a feature that actually works on the most common
platform, stop detecting: render the control and make the call a safe no-op.
A dead button on a rare browser is a smaller loss than an invisible feature on
the common one.

## Browser gestures
Speech synthesis only starts inside a real user gesture. Replies arrive in
websocket callbacks, which are not gestures, so audio was silently dropped.
Prime the engine synchronously inside a click (a zero-volume utterance), and
call `resume()` — some webviews leave the queue paused after `cancel()`.

## No external assets, ever
Home Assistant is often run without internet. No CDN, no webfont, no remote
script. This is also why PDF rendering is delegated to the platform rather
than bundling a viewer: the Android webview has no PDF renderer, so detect it
and offer an open button instead of showing a blank frame.

---

# RULE 33c — TRANSLATION FILE ROLES ARE NOT INTERCHANGEABLE

Three files, three different jobs. Mixing them broke the GitHub action.

- `frontend/translations.csv` — the ONLY source for panel UI strings. Seven
  languages in columns. Read at runtime by `_t()`.
- `strings.json` and `translations/en.json` — Home Assistant ONLY: config flow,
  options flow, services. These are schema-validated by `hassfest`, which
  REJECTS any top-level key outside its known set. Panel strings placed here
  caused `Invalid translations/en.json: not a valid option`.
- The two JSON files must stay structurally identical.

`hassfest` also requires that every service in `services.yaml` has a matching
entry with `name` and `description` in `strings.json`, and vice versa. Verify
all three lists agree before pushing.

Before deleting any key from the JSON files, confirm it exists in the CSV
first — otherwise the string is lost entirely.

---

# RULE 33d — PATCHING DISCIPLINE

- This repository mixes CRLF and LF. A replacement that fails to match is
  usually a line-ending mismatch, not a missing target. Read the exact bytes
  before assuming the code is absent.
- After any replacement, VERIFY it applied. A script that asserts and exits
  writes nothing; printing a success message before the write is not evidence.
- Remove dead code in the same change that orphans it. A helper left unused
  after a refactor, or an `else` branch left unreachable, is exactly the kind
  of plausible-looking code that causes the next defect.
- Never leave two copies of the same logic. When a second entry point needs the
  same behaviour, extract one function and call it from both.

---

# RULE 34 — FINAL TASK REPORT

At the end of EVERY coding task report:

```text
FILES CHANGED
- exact path

CODE-LEVEL CHANGES
- exact function/component/section
- what changed
- why
- how it works

FILE VERSION CHANGES
- previous entry
- new entry

TRANSLATION CHANGES
- UI strings changed
- translation files changed
- translation Excel updated
- translation validation result

AI LANGUAGE FLOW
- user language → English
- AI processing in English
- English result → selected UI language

RESPONSIVE (any UI change - see RULE 36)
- phone: what was verified
- tablet: what was verified
- desktop: what was verified
- RTL and LTR
- state plainly if a size was NOT checked

VALIDATION
- exact commands executed
- exact results
- number of regression suites run and their pass/fail
- BLOCKER / ERROR / HOT_WARN counts from the project gate
- for any test that failed first: whether the CODE or the HARNESS was wrong,
  and what was changed

WARNINGS
- warnings, skipped checks, or unresolved issues

ASSUMPTIONS
- assumptions made, if any
```

Never report a clean result when validation was not actually performed.

---

# RULE 36 — EVERY UI CHANGE IS THREE CHANGES

No UI change is finished until it has been reasoned about on ALL THREE form
factors. This is not a polish step at the end; the layout decision usually
differs per size and has to be made while writing the code.

| Form factor | Width | What is different |
|---|---|---|
| Phone | up to ~899px | One column. No hover. Thumb-sized targets. Vertical space is scarce and the on-screen keyboard eats half of it. |
| Tablet | ~900px to ~1199px | Enough width for two content columns, NOT enough for two columns plus a side panel. Touch, so still no hover. |
| Desktop | 1200px and up | Multiple columns, docked side panels, hover available. |

## The tablet is the one that gets forgotten

Every responsive bug in this project came from treating tablet as "a small
desktop" or "a large phone":

- The Sous-Chef panel docked as a 380px column from 900px up. On a tablet that
  left the book squeezed beside it. The docked column moved to 1200px and
  tablets now get the phone's bottom sheet — while the book's own two-page
  spread correctly stays at 900px, because a tablet SHOULD show two pages.
- The numbered step circles were positioned for a two-page spread and collided
  with the text on narrow screens.

Note that those two breakpoints are deliberately DIFFERENT in the same
stylesheet. "One breakpoint for the whole screen" is usually wrong: each
element flips at the width where IT stops fitting.

## Required checks for any UI change

- Does it work with no hover? `:hover` may reveal nothing essential. Where a
  control is hover-revealed on desktop, make it always visible under
  `@media (hover: none)` — the per-row delete buttons do exactly this.
- Does it work in both directions? See RULE 33b: logical properties only.
- Does a fixed or sticky element cover the header, the Home button, or the
  edit controls at any width?
- Does a long string, a long recipe name, or a long spoken question break the
  layout? Truncate with ellipsis in fixed-height strips rather than wrapping.
- Are touch targets at least ~40px on phone and tablet?
- Does the on-screen keyboard leave the input visible?

## Existing breakpoints are inconsistent — do not add a fourth set

`organizer-panel.css` and `stylist.css` use 450px and 768px. `recipes.css`
uses 900px and 1200px. When touching an existing file, follow the breakpoints
already in THAT file rather than introducing new ones; converging them is a
separate, deliberate task and never a side effect of a feature.

## Reporting

State explicitly in the final report what was verified at each of the three
sizes. "Responsive" on its own is not a result. If a size was not checked, say
so rather than implying it was.

---

# RULE 35 — RELEASING

The integration is in the HACS DEFAULT store. Installation is "search HACS for
Home Organizer and download" — the custom-repository path is now the fallback
for people who want an unreleased commit, not the main route. Documentation
must lead with the default-store path.

Release sequence:

1. Bump `version` in `manifest.json`.
2. Run the full gate with `GITHUB_REF_NAME` set to the tag, so the tag and the
   manifest are verified against each other.
3. Write release notes describing what the user GETS, not what the code does.
   Explain decisions that look odd from outside — why a confirmation exists,
   why prices are stored per unit, why the assistant may create sub-categories
   but not top-level ones.
4. Tag and push.

Release notes are read by people who did not see the code. Lead each section
with the effect, keep the internals to one short section at the end, and state
plainly what an upgrade requires of them — usually nothing.

When a user reports a bug, reply separately from the release notes. Name what
was actually wrong, say which version fixes it, answer the question they
actually asked (typically "do I need to reinstall?" — usually no), and credit
the detail in their report that made the diagnosis possible.

---

# FINAL PRINCIPLE

The LLM is a development assistant, not the authority.

The LLM is not trusted with security decisions.

User data is authoritative.

Home Assistant authorization is authoritative.

Deterministic backend validation is authoritative.

The database is persistent user state.

English is the only internal code language.

User-facing languages exist only through the translation layer.

Tests and actual validation are the evidence.

If convenience conflicts with safety, preserve safety.

If uncertain, inspect the actual code, repository, database, translation structure, and Home Assistant API before making assumptions.
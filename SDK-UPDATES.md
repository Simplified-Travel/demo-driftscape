# Recommended updates to st-frontend-sdk (and two to st-platform)

Source: building this Driftscape site (`demo-driftscape/`) as an outside developer. Narrative and observations are in
[SDK-FEEDBACK.md](SDK-FEEDBACK.md); this file is the work list. Items are in priority order. Each says what happened, what to
change, where, and how to know it is done.

## Read first (for the agent doing this work)

- SDK repo: `../../st-frontend-sdk` (read its `CLAUDE.md`, `PLAN.md` "Where things stand", and `docs/skinning.md`). Platform repo: `../../st-platform`
  (run artisan and pint through Sail; ask before pushing a tag; the user merges PRs).
- SDK rules that bite here: **size budget is 20 KB gzip and only about 0.5 KB is left** (`npm run size`); vanilla TypeScript, no DOM in
  `packages/core`; everything shown goes through `html`; `docs/skinning.md` is checked against the code by
  `packages/ui/test/skin-guide.test.ts`, so a new template field, text key or class must be added to the guide in the same change.
  Run `npm test`, `npm run typecheck`, `npm run build && npm run size` before finishing.
- The consumer to check against is this folder. After an SDK change, copy `packages/widget/dist/plan-widget.js` to
  `demo-driftscape/vendor/` and run the site (`python3 -m http.server 5190`; needs the local platform, planner `bayoffundy`, and `config.js`).
  Each item below says which workaround in this site it should let us delete.
- A real generation takes about 45 s and costs LLM budget: unit-test first, and do one live run at the end.

---

## P1. Custom templates silently lose Regenerate and photos (SDK, `packages/ui`)

> **DONE: PR #20 in `st-frontend-sdk`.** `ctx.regeneration` and `ctx.media` added in `packages/ui/src/render.ts` and `templates.ts`; the default templates read them from `ctx` (the data fields are still filled in for compatibility). Guide `ctx` table updated; test added in `media-template.test.ts`; 256 tests, typecheck and build pass; gzip 19.5 KB. This site now reads `ctx.regeneration`/`ctx.media` and no longer forwards props; a live run showed Regenerate buttons and photos. `vendor/plan-widget.js` is the new build.

**Problem.** The default `plan` template passes `regenerable`, `asking`, `photos`, `photoUrl` and `mapUrl` down to each `day`, and the default `day`
passes them to each `activity` (`packages/ui/src/templates.ts`, `plan` and `day`). A replacement `plan` template that calls `ctx.render('day', day)`
gets none of them, so Regenerate buttons and photos vanish with no error. I lost time to this; it is not in the guide.

**Change.** Stop threading these through template data. Put them on the render context instead (for example `ctx.regeneration`
`{ enabled, asking }` and `ctx.media` `{ photos, photoUrl, mapUrl }`), set once by `createRenderer`/the widget before rendering, so any template at any
depth can read them. Keep the old data fields populated for backward compatibility (the playground skins and existing tests use them) and document the
context members in the guide's `ctx` table.

**Done when.** A `plan` template that does only `ctx.render('day', day)` and a `day` template that does only `ctx.render('activity', a)` still get Regenerate
and photos; a test renders such templates; the guide's `ctx` table lists the new members.
**Removes from this site.** The `Object.assign({}, day, { regenerable, asking, photos, photoUrl })` forwarding in `js/templates.js` (`plan` and `day`).

## P1. Export the building blocks a custom skin has to copy (SDK, `packages/ui`, `packages/widget`)

> **DONE: PR #21 (stacked on #20).** `ctx.part('regenerate' | 'photo' | 'map', data)`. This site uses `photo` and `map` (day maps now show). It keeps its own Regenerate markup: the part has fixed `st-*` classes and markup, and the mockup puts the button outside the content column. Follow-up: a class/wrapper option on `regenerate`. Photo slots did not fill in the last live run (not investigated).

**Problem.** To restyle Regenerate, photos and day maps I re-implemented internal helpers by reading source: the regenerate button and inline feedback form
(`regenerate()` in `templates.ts`), the photo slot (`activityPhoto`), and the day map (`dayMap`, which needs `dayPoints` from `core`, not exported). I could
not build day maps at all and left them out. The markup contract (`data-st-regenerate`, `data-st-target-date`, `data-st-target-id`, `data-st-photo`) is
documented, but copying it is error-prone.

**Change.** Expose them as `ctx.renderPart` or as named exports on `window.SimplifiedTravel` (for example `parts.regenerate(target)`, `parts.photo(activity)`,
`parts.dayMap(day)`), each returning escaped `SafeHtml` with the required data attributes and reading the media and regeneration state from the context (item above).
Style hooks should accept a class prefix or return the default `st-*` classes that a host can override. Keep size in mind: these functions already exist, so this
should be mostly exporting and wiring, not new code.

**Done when.** A custom `activity` template can write `${ctx.part('regenerate', a)}` and `${ctx.part('photo', a)}` and get working behaviour; a custom `day` can render
the day map; tests cover each; the guide shows a copy-paste example.
**Removes from this site.** `regenerateMarkup()` and `photoMarkup()` in `js/templates.js`, and enables day maps (not built here).

## P1. Give templates the data they are missing (SDK, `packages/widget`, `packages/ui`)

> **DONE: PR #22.** `plan` gets `id`, `status`, `request`, `actions` (place with `ctx.render('actions', view.actions)`; default placement unchanged); `progress` gets `values`; `restart` gets `{ failed }`. This site uses all of them. Not run: a failed run, the conversation flow.

**Problem.** Each kiosk state is a separate template with its own narrow data (`kioskMarkup` in `packages/widget/src/index.ts`):
- `progress` gets no survey values, so it cannot say "Building your plan for Dec 4 to 5".
- `plan` gets `{ days, lists }` plus regeneration and media, but not the plan id, request (dates, travelers) or status; I derived dates from the days.
- `actions` is rendered before the plan and outside it (`actionsMarkup`), so a toolbar cannot sit inside the plan's own section.
- `restart` is rendered after the plan, and also after a failed run, so its label has to work for both.

**Change.** (a) Pass `values` (the survey answers) to `progress`, and `request`, `id`, `status` and `state` to `plan` and `progress`. (b) Add the actions
view to the `plan` data (`view.actions`, same shape as the `actions` template's data) and let a `plan` template place it with `ctx.render('actions', view.actions)`;
when the plan template does not, fall back to today's placement so existing skins are unchanged. (c) Pass `failed: boolean` to `restart` so the label can
differ. Update `TemplateData` types, the guide's template table and `skin-guide.test.ts`.

**Done when.** This site can print the chosen dates in the progress panel and put Share, Print and Restart inside the plan section without a separate band.
**Removes from this site.** The date derivation in `plan`, the separate `result-bar` band, the CSS that hides the footer restart behind the bar.

## P1. Expose the visitor's session (SDK, `packages/core`, `packages/widget`)

> **DONE: PR #23.** `widget.headers()` and `SimplifiedTravel.createAnonymousAuth` (also `AuthProvider`, `AnonymousAuthOptions` types). This site now uses `widget.headers()`; `createVisitorAuth()` is gone.

**Problem.** The widget signs the visitor in anonymously (`createAnonymousAuth`, `packages/core/src/auth.ts`) but keeps the session private. A host that needs the
visitor's token for other platform calls (here, reading an experience) has to copy the whole sign-up and refresh logic and pass it as the `auth` option, which I did
(`createVisitorAuth` in `js/site.js`, about 50 lines, with its own storage key).

**Change.** Export `createAnonymousAuth` and its types from `packages/widget/src/index.ts` (so `SimplifiedTravel.createAnonymousAuth({ supabaseUrl, supabaseKey })`
works and can be passed back as `auth`), and add a public `widget.headers()` (or `widget.auth`) returning the current auth headers. Document both in the guide's
JavaScript section. Check the size budget; this is mostly an export.

**Done when.** A page can call `await widget.headers()` and get `{ Authorization: 'Bearer ...' }` for the current visitor, and Restart resets it.
**Removes from this site.** `createVisitorAuth()` in `js/site.js`.

## P1. Plan activities should say where an experience lives (st-platform, then SDK types)

**Problem.** A plan activity carries only `experience_id` (`app/Http/Resources/PlanActivityResource.php`). The link (`externalUrl`) and source
(`synchronizationSource`, `driftscape` for all 113 `bayoffundy` experiences) are on the experience. The SDK has no hook for per-stop extra data, so this site fetches
each experience after every draw and re-renders (`watchExperiences()` in `js/site.js`), and the banner appears late.

**Change.** In `PlanActivityResource` add the experience to each activity: for example `experience: { id, title, external_url, synchronization_source, image_url }`
or `null` (eager load it, so there is no N+1; check the streamed `activity.generated` event payload and the saved document both carry it, since the widget folds
the two together). Add `experience?` to `PlanActivity` in `packages/core/src/plan.ts`, keep it through `foldActivity` (`core/generation.ts`) and `mergeDocument`,
and add a fixture and tests. Then `watchExperiences()` can be deleted.

**Done when.** `activity.experience.external_url` is present in both the REST plan and a streamed activity, on the first draw, and a test in each repo checks it.
**Removes from this site.** `watchExperiences()`, `DRIFTSCAPE_EXPERIENCES` and the `data-experience` attribute.

## P1. Fix `GET /api/v1/experiences` for signed-in visitors (st-platform)

**Problem.** The list endpoint returns 500 for any non-admin signed-in visitor:
`Unknown column 'user_id'` in `ExperienceSchema::indexQuery` (`app/JsonApi/V1/Experiences/ExperienceSchema.php`). It filters on `experiences.user_id`, which does not
exist (copied from itineraries). The planner scoping after it (`planner_id = currentPlanner`) is never reached because `$request->user()` is truthy. Reading one
experience by id works. Also `$request->user()->role` is read before the null check, which would error for a request with no user.

**Change.** Scope non-admin users to the current planner's experiences (the last branch), null-check `$request->user()` first, and add a feature test covering an
anonymous-visitor token with `filter[id]=a,b` and the planner header, asserting 200 and only that planner's experiences.

**Done when.** `GET /api/v1/experiences?filter[id]=ID1,ID2` with a visitor token and `X-SimplifiedTravel-Planner: bayoffundy` returns both. Use Sail for tests and `./vendor/bin/pint`.

---

## P1. A "Build a theme" guide for agents and humans (SDK, docs only)

**Why.** Everything we change in the SDK should be explained where a theme author, human or agent, will read it. Today `docs/skinning.md` is a
reference (attributes, tokens, a `ctx` table) and not a path from "I have a mockup" to "a working theme". Building this site needed knowledge that
is in no one place: the hooks, the state-to-template mapping, the `ctx` members, and the traps we hit.

**Change.** Add `docs/build-a-theme.md` (link it from `README.md` and the top of `docs/skinning.md`). Write it for a reader with no prior context, so an
agent can follow it step by step. Suggested shape:
1. Choose a level: tokens only, CSS on the `st-` classes, or replacing templates (when each is enough).
2. The kiosk states (survey, creating, generating, done, failed, shared), which template draws each, and that they share one root.
3. The template list, with the data each receives and the hooks each must keep (`data-st="survey"`, `name="arrive"`, `data-st-cancel`, `data-st-regenerate`,
   `data-st-photo`, `data-st-action`, `data-st="restart"`, `data-st-key`).
4. The `ctx` members, including `ctx.regeneration` and `ctx.media` (now done), with a copy-paste Regenerate and photo example.
5. A worked example: the Driftscape site (`demo-driftscape/js/templates.js`, `css/skin.css`) taken from mockup to widget, step by step.
6. Traps: the widget resets headings inside its root, `--st-bg: transparent` on a coloured page, defaults for omitted survey fields, `restart` also shows after
   a failure, nothing outside the root sees state except through events, generated text says "itinerary".
7. A checklist for verifying a theme, including the cases we did not run (Stop, failed run, narrow widths, print).

**Keep it current.** Each later item in this file that changes what a theme author sees (the exported parts, the new template data, the text hook, the state
attribute) must update this guide in the same change, and `skin-guide.test.ts` should be extended to check the guide's template list and hook names against
the code, as it does for `skinning.md`. Write the guide last in a batch of SDK changes, or revise it after each.

**Done when.** An agent given only the SDK repo and a mockup can follow the guide to a working themed widget; the guide's hooks and `ctx` members are test-checked.

## P2. A text hook for generated content and the generator's thoughts (SDK, plus a platform string)

**Problem.** This client wants the word "plan", never "itinerary". Thoughts arrive as "Working on the perfect itinerary: ...", and the generated details and checklist items
say it too (for example "Print out a physical copy of your itinerary"). The SDK only translates its own `messages`. I run every generated string through a regex in
`js/templates.js` (`term()`), which is easy to forget in one template.

**Change.** Add an option (for example `transformText(text, kind)` with `kind` of `thought`, `details`, `list-item`, `title`) applied by the renderer and the
progress path before the strings reach templates; document it. Separately, in `st-platform` change the thought prefix away from "itinerary" (already noted in `PLAN.md`).

**Done when.** A host sets one function and no template needs its own replace; unit-tested on a thought and an activity.
**Removes from this site.** `term()` and its call sites.

## P2. Make the guide describe the real patterns (docs only, `docs/skinning.md`)

Things I had to discover that belong in the guide, each short:
1. **Kiosk layout pattern.** Survey, progress and plan share one root and show one state at a time. For "form stays in place, plan appears under it", have the survey and
   progress templates render the same layout block and the plan template a full-width section. Include this site's approach as a worked example.
2. **Omitted fields.** A survey template may leave out fields (adults, budget, tone); `parseSurveyForm` fills defaults (1 adult, budget 3, standard tone), and locked or hidden
   planner questions are still sent. State this, and that a date-only form works.
3. **Heading and spacing resets.** The stylesheet resets heading fonts, margins and letter-spacing inside the root (`#plan h2`), which removes a custom template's own
   heading styles; re-apply them with an id-scoped rule.
4. **`--st-bg` and `--st-font-size`** paint and size the whole container; set `--st-bg: transparent` to sit on a coloured page.
5. **Restart after a failed run**, so the label must also mean "try again".
6. **Messages the widget prints outside templates** (the failed-run `.st-error`, the stopped `.st-notice`) are direct children of the root and need host CSS.
7. **Static mode** needs both `plannerUrl` and `planUrl`; add a minimal annotated planner JSON (which attributes `parsePlanner` needs) next to the fixtures.
8. **Bring your own form with `setPlan`** is a supported pattern (round 1 of this build); say so.

**Done when.** Each point is in the guide, and `skin-guide.test.ts` still passes.

## P2. A state attribute on the root (SDK, `packages/widget`)

**Problem.** Nothing outside the root can react to state except through events. A host may want to hide a hero while generating or scroll to results. This site listens
for `plan.created` only.

**Change.** Set `data-st-state` on the root element (`survey`, `creating`, `generating`, `done`, `failed`, `shared`, and `chat` for conversations) and keep it in sync in
`render()`. List it in the guide's data-attribute table.

**Done when.** The attribute updates through a full kiosk run in a widget test.

## P2. Progress that is visibly alive (SDK, with a platform check)

**Problem.** In two live runs the bar read 10% for about 25 s before thoughts and activities appeared. I did not see it climb in the first run, so I cannot say if
`document.generation.progress` events arrive after 10%, or if the platform only reports 10 then 80 then 100 as `PLAN.md` found for polling.

**Change.** Log the events of one run (`st:document.generation.progress`) to see what the platform sends; if it is sparse, show an indeterminate state for the first 10%
(for example `percent` plus `indeterminate: true` for `progress` templates) so a long first step does not look stuck. Report the findings in `PLAN.md`.

**Done when.** The behaviour of progress is written down and the default template does not look frozen for 25 s.

---

## P3. Smaller things

- **Static mode without a plan file.** Allow `plannerUrl` alone (the plan comes from `setPlan`); today an empty plan file is required (`createStaticSource` in `core/source.ts`).
- **`restart` label default.** "Start again" is generic; consider separate keys for "restart" and "try again".
- **Distribution.** The repo is private and releases need `gh` access; this site copied `dist/plan-widget.js` from a working tree. Decide how an outside developer gets a pinned
  build (a public release asset, an npm tarball, or documented `gh release download` access) and put it in the README.
- **Config hand-off.** A kiosk page needs the Supabase URL and key and the realtime URL. `playground/kiosk.config.example.js` shows them; mention in the guide that the client
  is given these values (they are public).
- **Day-level data.** Round 1 needed a day title that is not a date. If plans ever have named or undated days, `groupSchedule` should allow it. Low priority now that real
  plans have dates.

## Not verified in this build (check before relying on them)

Regenerate end to end from this skin, Stop, Share (`?st-plan=ID` link), Print preview, a failed run, the conversation flow, narrow widths, other browsers, and day maps (not built here).

# Feedback on st-frontend-sdk from the Driftscape build

Two rounds. Round 1 rendered prepared trips through `setPlan()` (static mode). Round 2, this version, is a real kiosk
build against the local platform (planner `bayoffundy`: destination locked and hidden), with every template replaced.
Built from the README, `docs/skinning.md` and the built widget only.

## What I ran

Loaded the page (date form only, no plan), submitted with no dates (error shown: "Please choose both dates."), then
submitted 2026-12-04 to 2026-12-05. The widget signed in, created and started the plan, showed progress and thoughts, streamed
in, and finished with 2 days and 9 stops, photos, links, 4 lists and Regenerate buttons; Plan a different trip showed. Regenerate's
form opened and closed. I did not run a regeneration, Stop, Share, Print preview, a failed run, other browsers or a narrow window.

## Problems, most important first

1. **A template for one state can't see another state's data, and some data never reaches templates.**
   - The `progress` template gets no survey values, so it cannot say "Building your plan for Dec 4 to 5".
   - The `plan` template gets `{ days, lists }` plus `regenerable`/`asking`/`photos`/`photoUrl`/`mapUrl`, but not the plan id, request or
     dates (I derived dates from the days).
   - `actions` renders before the plan, outside it, so a toolbar cannot sit inside the plan's section; I made it its own band.
2. **A custom `plan` template must pass `regenerable`, `asking`, `photos` and `photoUrl` on to `day`, and `day` on to `activity`.** The default
   plan template does this. Mine didn't at first, and Regenerate buttons and photos simply vanished with no error. Not in the guide.
3. **The Regenerate and photo markup has to be copied.** The helpers that build the feedback form and the photo slot are internal; I
   re-wrote them from the source (`data-st-regenerate`, `data-st-target-*`, `data-st-photo`). The guide lists the attributes, which was
   enough, but a short copy-paste example would save reading `templates.ts`. Day maps I skipped: `dayPoints` is not exported, so a custom `day`
   template cannot build the map the default one does.
4. **One root, several states.** Survey, progress and plan are drawn into one element, one state at a time. For a layout where the form
   stays put and the plan appears under it (the mockup's feel), I had the survey and progress templates both render the page's two-column
   block, and the plan template a full-width band. It works well, but the guide should say that is the pattern, and that nothing outside the
   root can react to state except through events.
5. **The generator's text says "itinerary".** Thoughts start "Working on the perfect itinerary: ...", and generated details and checklists
   say it too. This client wants "plan", so every generated string goes through a replace in the templates. Already in your notes as a platform
   change; a `messages`/text filter hook in the SDK would help clients who care about terminology.
6. **Progress looked stuck.** The bar read 10% for about 25 s, then thoughts appeared; the next sample I took was already streaming. I did not
   watch it climb, so I can't say whether more progress events arrived.

## Found while adding the Driftscape links

7. **The plan does not say where an experience lives.** A stop carries only `experience_id`; the link (`externalUrl`) and the source
   (`synchronizationSource: driftscape`) are on the experience. The SDK has no hook for per-activity extra data, so I fetch each
   experience myself after every draw and re-render with `widget.render()`. Cleanest fix: the platform includes the experience's
   external URL and source on each plan activity.
8. **The SDK does not expose the visitor's session**, so reading `/experiences` needed a bearer token the widget holds privately. I passed
   my own `auth` (the documented hook) that copies `createAnonymousAuth`. Exporting `createAnonymousAuth` (or `widget.auth`) would avoid that.
9. **Platform bug:** `GET /api/v1/experiences` (the list) returns 500 for any signed-in non-admin visitor: `ExperienceSchema::indexQuery`
   filters on `experiences.user_id`, which does not exist (it looks copied from itineraries), and the planner scoping below it is unreachable
   (`$request->user()` is truthy). Reading one by id works, so I make one request per stop. Not fixed in `st-platform`.

## Smaller things

- Defaults for fields I removed (adults 1, budget 3, tone) are filled in by the widget, so a date-only form works. Worth saying in the guide.
- Planner `interactions` with `hide` + `read_only` on the destination did exactly what the notes say: no destination field, answer sent.
- The widget resets heading fonts, margins and letter-spacing inside its root (`#plan h2`...), so a replacement template's headings lose the page's
  styles; I re-applied the mockup's. That is the hostile-theme hardening working against a custom skin. A note in the guide would help.
- `--st-bg` paints the container; set it to `transparent` to sit on a coloured page.
- `restart` is also shown after a failed run, so its label ("Restart") has to work for "try again" too. I also keep a Restart button in the toolbar, hidden by CSS when the toolbar is there.
- A kiosk page needs three config values (Supabase URL and key, realtime URL). I took them from the SDK's git-ignored
  `playground/kiosk.config.js`; a client needs these given to them.
- The SDK repo is private, so I copied `dist/plan-widget.js` from the working tree (`vendor/`).

## Worked well

- `configure({ templates })`, the escaping `html` tag and the documented hooks (`data-st="survey"`, `name="arrive"`, `data-st-cancel`,
  `data-st-action`, `data-st="restart"`, `data-st-key`) all behaved as documented once I had them right.
- Streaming updates into custom markup, Stop, Share/Print buttons and the "link copied" note all came for free through the hooks.
- No console errors in the runs above.

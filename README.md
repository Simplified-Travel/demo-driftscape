# demo-driftscape

Working demo of the Fundy Footsteps & Flavours itinerary page for Driftscape, built from
`../DMO_Bay_of_Fundy_Itineraries_UI_UX_Demo_v1.2_2026-11-23.html` on the Simplified Travel
[st-frontend-sdk](../../st-frontend-sdk) (`plan-widget.js`, v0.2.0 build).

Plain HTML, CSS and JavaScript. No build step.

## Run

Needs the local platform running (Sail, `http://localhost`) with a planner whose context is `bayoffundy` (kiosk on, destination
locked), and the shared queue workers so generation completes.

```sh
cp config.example.js config.js   # fill in the Supabase and realtime values (the SDK's playground/kiosk.config.js has them)
python3 -m http.server 5190      # or any static server
open http://localhost:5190/
```

It must be served over http. `config.js` is git-ignored.

## Layout

| Path                         | What it is                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `index.html`                 | The page chrome from the mockup. `<main id="plan">` is the widget's root: everything under the hero.    |
| `css/mockup.css`             | The mockup's stylesheet, unchanged.                                                                     |
| `css/skin.css`               | Widget tokens, plus styles for the pieces the templates add (date inputs, progress, result bands).      |
| `js/templates.js`            | Replaces every widget template: survey, progress, actions, plan, day, activity, list, restart.          |
| `js/site.js`                 | Mounts the widget in kiosk mode, supplies the visitor's session, looks up experiences, runs the menu and search.  |
| `vendor/plan-widget.js`      | The SDK build, copied from `st-frontend-sdk/packages/widget/dist` (v0.2.0 plus a docs commit).          |
| `assets/`                    | Images extracted from the mockup.                                                                       |

## How it works

1. On load the visitor sees only the date form (arrive, depart) beside the regional map. The destination is locked in the planner.
2. **Build my plan** creates an anonymous visitor, creates the plan and starts it. The same spot on the page shows the progress
   bar, its percentage and the generator's latest thoughts, with a Stop button.
3. The plan streams in below as stops are generated (photos, ratings, links, Driftscape banners). Each stop has Swap stop (the widget's
   regenerate, with optional feedback); the bar above has Share, Print and Restart. A stop that is a Driftscape experience (looked up by
   `experience_id`) gets the banner, linked to the experience's `externalUrl` when it has one.
4. **Restart** signs the visitor out and returns to the form.

Differences from the mockup: no theme or pace questions, Swap stop is now the regenerate button (there is no fixed catalogue to rotate through), and the `#sussex-ale-works` deep link is
gone because plans are now generated. Visible text says "plan" throughout, including generated text.

See [SDK-FEEDBACK.md](SDK-FEEDBACK.md) for what building this showed about the SDK.

/*
 * Fundy Footsteps & Flavours: a fully custom skin for the Simplified Travel widget (kiosk mode).
 *
 * Every visible piece of the widget is replaced here, so the mockup's markup and CSS (css/mockup.css) apply
 * directly. The widget still does the work: sign-in, creating the plan, streaming it in, regenerate, stop, share
 * and print. We keep the hooks the guide says a replacement template must keep (`data-st="survey"`,
 * `name="arrive"`, `data-st-cancel`, `data-st-regenerate`, `data-st-action`, `data-st="restart"`, `data-st-key`).
 *
 * Must run after vendor/plan-widget.js and before the widget is mounted.
 */
(function () {
    var html = SimplifiedTravel.html;
    var raw = SimplifiedTravel.raw;
    var safeUrl = SimplifiedTravel.safeUrl;

    /* ---------- Driftscape experiences ---------- */

    // An activity that is one of the planner's experiences carries an `experience_id`. site.js looks those up
    // (GET /experiences) and keeps them here by id: { title, externalUrl, synchronizationSource }. A stop whose
    // experience came from Driftscape gets the banner, linked to the experience's external URL when it has one.
    window.DRIFTSCAPE_EXPERIENCES = window.DRIFTSCAPE_EXPERIENCES || {};
    function driftscapeExperience(activity) {
        var exp = activity.experience_id && window.DRIFTSCAPE_EXPERIENCES[activity.experience_id];
        return exp && exp.synchronizationSource === 'driftscape' ? exp : null;
    }

    /* ---------- Shared pieces ---------- */

    // The "Explore the region" card beside the form (and beside the progress while a plan is made)
    var regionCard = html`
        <aside class="side">
            <a class="maplink" href="https://www.fundyfootstepsflavours.ca/explore-fundy" aria-label="Explore Fundy's regional map">
                <img alt="Regional map of the Fundy Coast and Foothills" src="assets/map-fundy-region.jpg">
            </a>
            <div class="side-body">
                <span class="over">Fundy Coast &amp; Foothills</span>
                <h3>Explore the region</h3>
                <p>Browse the destination’s map for local food, artists’ studios and places along the coast.</p>
                <a class="textlink" href="https://www.fundyfootstepsflavours.ca/explore-fundy">Open the Fundy map</a>
            </div>
        </aside>
    `;

    function shell(left) {
        return html`<div class="wrap body-grid">${left}${regionCard}</div>`;
    }

    function today() {
        var d = new Date();
        var p = function (n) { return String(n).padStart(2, '0'); };
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }

    // This site says "plan", never "itinerary": the generator's thoughts ("Working on the perfect itinerary: ...") and its
    // text say otherwise, so every piece of generated text goes through here.
    function term(text) {
        return String(text).replace(/itineraries/gi, 'plans').replace(/itinerary/gi, 'plan');
    }

    function regenerateMarkup(a, ctx, view, name) {
        var regen = ctx.regeneration;
        if (!regen.regenerable) return { button: '', form: '' };
        var where = html`data-st-target-date="${a.date}" data-st-target-id="${a.id}"`;
        var open = regen.asking && regen.asking.date === a.date && String(regen.asking.id || '') === String(a.id);
        if (open) {
            return {
                button: '',
                form: html`
                    <form class="regen" data-st-regenerate="ask" ${where} novalidate>
                        <label class="field" for="regen-${a.date}-${a.id}">${ctx.t('regenerate title')}</label>
                        <textarea id="regen-${a.date}-${a.id}" name="feedback" rows="2" placeholder="${ctx.t('regenerate placeholder')}"></textarea>
                        <div class="actionrow">
                            <button class="primary" type="submit">${ctx.t('regenerate go')}</button>
                            <button class="secondary" type="button" data-st-regenerate="close">${ctx.t('regenerate cancel')}</button>
                        </div>
                    </form>`,
            };
        }
        return {
            button: html`<button class="swap" type="button" data-st-regenerate="open" ${where} aria-label="${ctx.t('regenerate')}: ${name}">${ctx.t('regenerate')}</button>`,
            form: '',
        };
    }

    function timeRange(a) {
        return a.start_time ? (a.end_time ? a.start_time + ' – ' + a.end_time : a.start_time) : '';
    }

    /* ---------- The templates ---------- */

    SimplifiedTravel.configure({
        messages: {
            'start again': 'Restart',
            regenerate: 'Swap stop',
            'regenerate title': 'Swap this stop',
            'create plan': 'Build my plan',
            creating: 'Starting…',
            'plan not found': 'This plan could not be loaded.',
            'generation failed': 'Something went wrong building your plan. Please try again.',
        },
        templates: {
            // Before a plan exists: only the form (dates), beside the regional map. The destination is locked by
            // the planner, so there is no field for it and the widget sends the planner's answer.
            survey: function (view, ctx) {
                var invalid = view.errors.dates ? 'true' : 'false';
                return shell(html`
                    <form id="builder" class="builder" data-st="survey" novalidate>
                        <span class="over">Plan builder</span>
                        <h2>Plan your Fundy visit</h2>
                        <p class="intro">Choose your dates. We’ll shape a self-drive plan around the Bay of Fundy.</p>
                        <div class="row">
                            <div>
                                <label class="field" for="arrive">Arrive</label>
                                <input class="date" id="arrive" name="arrive" type="date" min="${today()}" value="${view.values.arrive}" aria-invalid="${invalid}" aria-describedby="dates-error">
                            </div>
                            <div>
                                <label class="field" for="depart">Depart</label>
                                <input class="date" id="depart" name="depart" type="date" min="${today()}" value="${view.values.depart}" aria-invalid="${invalid}" aria-describedby="dates-error">
                            </div>
                        </div>
                        <p id="dates-error" class="form-error" role="alert">${view.errors.dates ? ctx.t(view.errors.dates) : ''}</p>
                        <div class="actionrow">
                            <button class="primary" type="submit" ${view.submitting ? 'disabled' : ''}>${ctx.t(view.submitting ? 'creating' : 'create plan')}</button>
                            <span class="byline">Sample planner by Simplified.Travel</span>
                        </div>
                    </form>
                `);
            },

            // While the plan is being made: the same place on the page, now with the progress and the thoughts.
            progress: function (view, ctx) {
                var known = typeof view.percent === 'number' && isFinite(view.percent);
                var percent = known ? Math.max(0, Math.min(100, Math.round(view.percent))) : 0;
                var thoughts = view.thoughts && view.thoughts.length ? view.thoughts : view.thought ? [view.thought] : [];
                return shell(html`
                    <div class="making" data-st="progress" role="status">
                        <span class="over">Plan builder</span>
                        <h2>${ctx.t(view.label || 'generating')}</h2>
                        ${known
                            ? html`<div class="meter">
                                  <progress max="100" value="${percent}" aria-label="Plan progress">${percent}%</progress>
                                  <span class="pct">${percent}%</span>
                              </div>`
                            : ''}
                        ${thoughts.length
                            ? html`<ul class="thoughts">
                                  ${thoughts.map(function (text, age) {
                                      return html`<li data-st-age="${age}">${term(text)}</li>`;
                                  })}
                              </ul>`
                            : ''}
                        ${view.note ? html`<p class="byline">${view.note}</p>` : ''}
                        ${view.cancelable
                            ? html`<div class="actionrow"><button class="secondary" type="button" data-st-cancel>${ctx.t('cancel')}</button></div>`
                            : ''}
                    </div>
                `);
            },

            // Share and Print, above the finished plan, with the widget's own "link copied" note.
            actions: function (view, ctx) {
                return html`
                    <div class="result result-bar">
                        <div class="wrap">
                            <div class="toolbar" data-st="actions">
                                ${view.share ? html`<button type="button" data-st-action="share">${ctx.t('share')}</button>` : ''}
                                ${view.print ? html`<button type="button" data-st-action="print">${ctx.t('print')}</button>` : ''}
                                <button type="button" class="restart-top" data-st="restart">${ctx.t('start again')}</button>
                                <span id="notice" role="status">${view.note === 'copied' ? ctx.t('link copied') : view.note === 'manual' ? ctx.t('copy link') : ''}</span>
                                ${view.note === 'manual' && view.link
                                    ? html`<input class="date" readonly value="${view.link}" aria-label="${ctx.t('link label')}" onfocus="this.select()">`
                                    : ''}
                            </div>
                        </div>
                    </div>
                `;
            },

            plan: function (view, ctx) {
                if (view.days.length === 0 && view.lists.length === 0) return '';
                var stops = view.days.reduce(function (n, d) { return n + d.activities.length; }, 0);
                var first = view.days[0] && view.days[0].date;
                var last = view.days.length ? view.days[view.days.length - 1].date : '';
                var summary = [
                    view.days.length + (view.days.length === 1 ? ' day' : ' days'),
                    stops + (stops === 1 ? ' stop' : ' stops'),
                    first && last && first !== last ? ctx.formatDate(first) + ' to ' + ctx.formatDate(last) : first ? ctx.formatDate(first) : '',
                    'Self-drive',
                ].filter(Boolean).join(' · ');

                return html`
                    <section class="result" data-st="plan">
                        <div class="wrap">
                            <div class="dayhead">
                                <div>
                                    <span class="over">Your sample plan</span>
                                    <h2>Your Fundy plan</h2>
                                    <p>${summary}</p>
                                </div>
                            </div>
                            <div class="days">
                                ${view.days.map(function (day) { return ctx.render('day', day); })}
                                ${view.lists.map(function (list) { return ctx.render('list', list); })}
                            </div>
                            <p class="hint">Planning ideas for a seasonal visit. Check opening dates directly with each host. For coastal stops, check the park’s tide and access information for your travel date.</p>
                            <p class="hint">${ctx.t('ai disclaimer')}</p>
                        </div>
                    </section>
                `;
            },

            day: function (day, ctx) {
                return html`
                    <article class="day" data-st="day" data-st-key="day-${day.date}" data-st-date="${day.date}">
                        <span class="over">${ctx.t('day')} ${day.number}</span>
                        <h3>${ctx.formatDate(day.date)}</h3>
                        ${ctx.part('map', day)}
                        ${day.activities.map(function (activity) {
                            return ctx.render('activity', Object.assign({}, activity, { dayNumber: day.number }));
                        })}
                    </article>
                `;
            },

            activity: function (a, ctx) {
                var name = a.activity || a.title || '';
                var place = a.location && a.location.displayName && a.location.displayName.text;
                var time = timeRange(a);
                var meta = [place && place !== name ? place : '', time].filter(Boolean).join(' · ');
                var loc = a.location || {};
                var links = ctx.planner && ctx.planner.features.showGoogleLinks === false ? [] : [
                    safeUrl(loc.googleMapsUri) ? html`<a class="textlink" href="${safeUrl(loc.googleMapsUri)}" target="_blank" rel="noopener">${ctx.t('open in maps')}</a>` : '',
                    safeUrl(loc.websiteUri) ? html`<a class="textlink" href="${safeUrl(loc.websiteUri)}" target="_blank" rel="noopener">${ctx.t('website')}</a>` : '',
                ].filter(Boolean);

                var banner = '';
                var experience = driftscapeExperience(a);
                if (experience) {
                    var href = safeUrl(experience.externalUrl);
                    var img = html`<img src="assets/driftscape-banner.png" alt="${href ? 'Explore ' + name + ' with Driftscape (opens a new tab)' : 'Driftscape'}">`;
                    banner = href
                        ? html`<a class="dslink" href="${href}" target="_blank" rel="noopener">${img}</a>`
                        : html`<div class="dslink">${img}</div>`;
                }

                var regen = regenerateMarkup(a, ctx, a, name);
                return html`
                    <div class="stop" data-st="activity" data-st-key="activity-${a.date}-${a.id}" data-st-activity-id="${a.id}" data-experience="${a.experience_id || ''}">
                        <span class="cap">Stop ${a.id}</span>
                        <div>
                            <h4>${name}</h4>
                            ${meta ? html`<span class="byline">${meta}</span>` : ''}
                            <p>${term(a.details || '')}</p>
                            ${typeof loc.rating === 'number'
                                ? html`<p class="byline">★ ${loc.rating}${loc.userRatingCount ? ' (' + Number(loc.userRatingCount).toLocaleString(ctx.locale) + ' ' + ctx.t('reviews') + ')' : ''}</p>`
                                : ''}
                            ${links.length ? html`<p class="links">${links}</p>` : ''}
                            ${ctx.part('photo', a)}
                            ${banner}
                            ${regen.form}
                        </div>
                        ${regen.button}
                    </div>
                `;
            },

            // Packing list, checklist, points of interest and notes: plain cards in the mockup's style
            list: function (list, ctx) {
                return html`
                    <article class="day" data-st="list" data-st-key="list-${list.key}" data-st-list="${list.key}">
                        <h3>${ctx.t(list.key)}</h3>
                        <ul class="notes">${list.items.map(function (item) { return html`<li>${term(item)}</li>`; })}</ul>
                    </article>
                `;
            },

            // Plan a different trip: signs the visitor out and shows the form again
            restart: function (_data, ctx) {
                return html`
                    <div class="result result-foot">
                        <div class="wrap">
                            <button class="secondary" type="button" data-st="restart">${ctx.t('start again')}</button>
                        </div>
                    </div>
                `;
            },
        },
    });
})();

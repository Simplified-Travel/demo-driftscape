/*
 * Fundy Footsteps & Flavours: plan builder.
 *
 * The widget runs in kiosk mode against the local platform (planner "bayoffundy"; its destination is locked in the
 * planner, so the visitor only chooses dates). It owns everything under <main id="plan">: the date form, the
 * progress, the finished plan, regenerate, share and print. js/templates.js is its markup. This file only loads
 * the visitor's session and the Driftscape experience lookup, mounts the widget, and runs the page's own menu and search.
 */
(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };
    var site = 'https://www.fundyfootstepsflavours.ca';

    function el(tag, txt) {
        var node = document.createElement(tag);
        if (txt) node.textContent = txt;
        return node;
    }

    /* ---------- Page chrome: menu and search (from the mockup) ---------- */

    function wireChrome() {
        var navPages = [['Home', ''], ['Crafted Experiences', '/experience-fundy'], ['Featured Stories', '/featured-stories'], ['Explore Fundy', '/explore-fundy'], ['Fundy Inspired Tour · Artists and artisans', '/fundy-inspired-tour'], ['Fundy Flavours Trail', '/fundy-flavours-trail'], ['Plans', '#builder'], ['Pledge', '/pledge'], ['Friends of Fundy', '/friends-of-fundy'], ['The Work', '/the-work'], ['Programs & Initiatives', '/programs-initiatives'], ['Shop', 'https://shop.fundyfootstepsflavours.ca/']];

        function showMatches() {
            var q = $('query').value.trim().toLowerCase();
            var links = navPages.filter(function (p) { return p[0].toLowerCase().includes(q); }).map(function (p) {
                var li = el('li'), a = el('a', p[0]);
                a.href = p[1].startsWith('#') || p[1].startsWith('https:') ? p[1] : site + p[1];
                a.onclick = function () { $('searchBox').close(); };
                li.append(a);
                return li;
            });
            if (!links.length) links.push(el('li', 'No matching pages. Try “Fundy” or “flavours”.'));
            $('matches').replaceChildren.apply($('matches'), links);
        }

        document.querySelectorAll('.search').forEach(function (b) {
            b.onclick = function () { $('query').value = ''; showMatches(); $('searchBox').showModal(); $('query').focus(); };
        });
        $('query').oninput = showMatches;
        $('closeSearch').onclick = function () { $('searchBox').close(); };

        function menu(open) {
            $('mobilelinks').classList.toggle('show', open);
            $('menubtn').setAttribute('aria-expanded', String(open));
        }
        $('menubtn').onclick = function () { menu(!$('mobilelinks').classList.contains('show')); };
        $('mobilelinks').onclick = function () { menu(false); };
        document.addEventListener('click', function (e) {
            document.querySelectorAll('nav details[open]').forEach(function (d) { if (!d.contains(e.target)) d.open = false; });
        });
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            document.querySelectorAll('nav details[open]').forEach(function (d) { d.open = false; d.querySelector('summary').focus(); });
            if ($('mobilelinks').classList.contains('show')) { menu(false); $('menubtn').focus(); }
        });
    }

    /* ---------- The visitor ---------- */

    // The widget signs the visitor in anonymously by itself, but it does not hand us that session, and we need the
    // visitor's token to read the planner's experiences (below). So we bring our own `auth` (the SDK's documented
    // hook): the same anonymous Supabase sign-up, kept under our own storage key. `reset()` is "Restart".
    function createVisitorAuth(config) {
        var key = 'driftscape-session';
        var base = config.supabaseUrl.replace(/\/+$/, '') + '/auth/v1';
        var pending;

        function read() { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
        function write(session) { try { localStorage.setItem(key, JSON.stringify(session)); } catch (e) {} }

        async function call(path, body) {
            var response = await fetch(base + path, {
                method: 'POST',
                headers: { apikey: config.supabaseKey, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!response.ok) throw new Error('Sign-in failed (' + response.status + ')');
            var data = await response.json();
            return {
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                expires_at: data.expires_at || Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600),
            };
        }

        async function obtain() {
            var current = read();
            if (current && current.access_token && current.expires_at - 60 > Date.now() / 1000) return current;
            var session;
            if (current && current.refresh_token) {
                try { session = await call('/token?grant_type=refresh_token', { refresh_token: current.refresh_token }); } catch (e) {}
            }
            session = session || await call('/signup', { data: {}, gotrue_meta_security: {} });
            write(session);
            return session;
        }

        return {
            async headers() {
                pending = pending || obtain().finally(function () { pending = undefined; });
                var session = await pending;
                return { Authorization: 'Bearer ' + session.access_token };
            },
            reset() {
                pending = undefined;
                try { localStorage.removeItem(key); } catch (e) {}
            },
        };
    }

    /* ---------- Driftscape experiences ---------- */

    // Each stop in a plan may be one of the planner's experiences (`experience_id`). The plan does not say where the
    // experience lives online, so after each draw we ask the platform for the ones we have not seen, keep them in
    // window.DRIFTSCAPE_EXPERIENCES (read by js/templates.js) and draw again so the banners appear.
    function watchExperiences(widget, config, auth) {
        var cache = window.DRIFTSCAPE_EXPERIENCES;
        var asked = new Set();

        async function load() {
            var ids = Array.from(new Set(Array.from(document.querySelectorAll('#plan [data-experience]'))
                .map(function (node) { return node.dataset.experience; })
                .filter(function (id) { return id && !asked.has(id); })));
            if (!ids.length) return;
            ids.forEach(function (id) { asked.add(id); });

            try {
                var headers = Object.assign({ Accept: 'application/vnd.api+json', 'X-SimplifiedTravel-Planner': config.planner }, await auth.headers());
                // One request per experience: the platform's list endpoint fails for a signed-in visitor (it filters
                // on a column experiences do not have), but reading one by id works.
                await Promise.all(ids.map(async function (id) {
                    var response = await fetch(config.apiUrl.replace(/\/+$/, '') + '/api/v1/experiences/' + encodeURIComponent(id)
                        + '?fields%5Bexperiences%5D=title,externalUrl,synchronizationSource', { headers: headers });
                    if (!response.ok) return;
                    var attributes = (await response.json()).data.attributes;
                    cache[id] = {
                        title: attributes.title,
                        externalUrl: attributes.externalUrl,
                        synchronizationSource: attributes.synchronizationSource,
                    };
                }));
                widget.render();
            } catch (e) {
                // No banner is better than a broken page
            }
        }

        widget.on('rendered', load);
        load();
    }

    /* ---------- Start up ---------- */

    async function start() {
        wireChrome();

        var config = window.DRIFTSCAPE_CONFIG;
        if (!config) {
            $('plan').innerHTML = '<p class="wrap form-error">Missing config.js: copy config.example.js and fill it in.</p>';
            return;
        }

        var auth = createVisitorAuth(config);
        var widget = await SimplifiedTravel.mount($('plan'), {
            mode: 'kiosk',
            flow: 'survey',
            apiUrl: config.apiUrl,
            planner: config.planner,
            supabaseUrl: config.supabaseUrl,
            supabaseKey: config.supabaseKey,
            realtimeUrl: config.realtimeUrl,
            auth: auth,
            maxDays: config.maxDays,
            locale: 'en',
        });

        watchExperiences(widget, config, auth);

        // After a plan finishes or the visitor starts again, keep the page where they are looking
        widget.on('plan.created', function () { $('plan').scrollIntoView({ behavior: 'smooth' }); });
    }

    start();
})();

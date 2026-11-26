// Copy to config.local.js (git-ignored) to override config.js on your own machine. It is loaded only when the page is
// served from localhost or 127.0.0.1, so the deployed site never uses it. List only what you want to change.
// (None of this is secret: anything the page uses is visible in the browser.)
Object.assign(window.DRIFTSCAPE_CONFIG, {
    apiUrl: 'http://localhost', // the local platform (Sail) instead of the development platform in config.js
});

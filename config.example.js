// Copy to config.js (git-ignored) and fill in. The Supabase key is the project's public (anon) key and the realtime
// URL ends with the realtime app key; both are meant to be in the page.
window.DRIFTSCAPE_CONFIG = {
    apiUrl: 'http://localhost',
    planner: 'bayoffundy',
    supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
    supabaseKey: 'YOUR-PUBLIC-KEY',
    realtimeUrl: 'wss://realtime.example.com:6001/app/YOUR-APP-KEY?protocol=7&client=st-sdk',
    maxDays: 3,
};

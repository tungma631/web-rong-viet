const fetch = require('node-fetch');
(async () => {
    try {
        const response = await fetch('https://replicate.com/api/models/search?query=target_face_index');
        const data = await response.json();
        const names = data.models.map(m => m.username + '/' + m.name).slice(0, 5);
        console.log('Result:', names);
    } catch(e) { console.log(e.message); }
})();

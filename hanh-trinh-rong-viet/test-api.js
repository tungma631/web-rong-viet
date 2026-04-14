async function test() {
    const API_KEY = "AIzaSyCJlrODtjBXGzE8hdq6bbk1eovFov9dq-s";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${API_KEY}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                contents: [{parts: [{text: "generate an image of a cat"}]}]
            })
        });
        const data = await res.json();
        console.log(JSON.stringify(data).substring(0, 500));
    } catch(e) {
        console.error(e);
    }
}
test();

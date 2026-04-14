// chatbot.js - Tích hợp Gemini Chatbot
const API_KEY = "AIzaSyCJlrODtjBXGzE8hdq6bbk1eovFov9dq-s";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

const openChatBtn = document.getElementById('openChatBtn');
const chatbotWindow = document.getElementById('chatbotWindow');
const closeChatBtn = document.getElementById('closeChatBtn');
const chatBody = document.getElementById('chatBody');
const chatInput = document.getElementById('chatInput');
const btnSendChat = document.getElementById('btnSendChat');

// Open / Close
openChatBtn.addEventListener('click', () => {
    chatbotWindow.style.display = 'flex';
    openChatBtn.style.display = 'none';
});

closeChatBtn.addEventListener('click', () => {
    chatbotWindow.style.display = 'none';
    openChatBtn.style.display = 'flex';
});

const appendMessage = (text, sender) => {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chat-message', sender);
    msgDiv.innerText = text;
    chatBody.appendChild(msgDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
};

// Gọi Gemini API
const fetchGeminiResponse = async (userPrompt) => {
    try {
        const response = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Đóng vai nhân viên tư vấn cho website Hành Trình Rồng Việt. Bạn trả lời ngắn gọn, nhiệt tình. Khách hỏi: "${userPrompt}"`
                    }]
                }]
            })
        });
        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0) {
            return data.candidates[0].content.parts[0].text;
        } else {
            return "Xin lỗi, hiện tại tôi đang quá tải, vui lòng thử lại sau nhen!";
        }
    } catch (error) {
        console.error("Gemini Error:", error);
        return "Xin lỗi, đã có lỗi kết nối với trợ lý rồng!";
    }
};

const handleSend = async () => {
    const text = chatInput.value.trim();
    if (!text) return;

    // Hiện tin nhắn user
    appendMessage(text, 'user');
    chatInput.value = '';

    // Hiện message báo đang load
    const loadingDiv = document.createElement('div');
    loadingDiv.classList.add('chat-message', 'bot');
    loadingDiv.innerText = "Đang xử lý...";
    loadingDiv.id = "msg-loading";
    chatBody.appendChild(loadingDiv);
    chatBody.scrollTop = chatBody.scrollHeight;

    // Lấy đáp án
    const botReply = await fetchGeminiResponse(text);
    
    // Bỏ loading, hiện reply
    document.getElementById('msg-loading').remove();
    appendMessage(botReply, 'bot');
};

btnSendChat.addEventListener('click', handleSend);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSend();
    }
});

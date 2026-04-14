// ai-avatar.js - Xử lý tính năng AI tạo ảnh cùng thần tượng
const btnCreatorModal = document.getElementById('btnCreatorModal');
const aiModalOverlay = document.getElementById('aiModalOverlay');
const closeAiModal = document.getElementById('closeAiModal');
const userFaceInput = document.getElementById('userFaceInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const btnGenerate = document.getElementById('btnGenerate');
const aiPreviewArea = document.getElementById('aiPreviewArea');
const aiResultImg = document.getElementById('aiResultImg');
const aiLoading = document.getElementById('aiLoading');
const regenCountDisplay = document.getElementById('regenCountDisplay');
const btnAcceptProduct = document.getElementById('btnAcceptProduct');
const idolSelect = document.getElementById('idolSelect');

// State
let regenCount = 5;
let currentMockImageUrl = "";

// Mock AI Images (Placeholder) - Đổi sang source load siêu nhanh để test
const mockResults = [
    "https://via.placeholder.com/400x400.png?text=AI+Result+1",
    "https://via.placeholder.com/400x400.png?text=AI+Result+2",
    "https://via.placeholder.com/400x400.png?text=AI+Result+3",
    "https://via.placeholder.com/400x400.png?text=AI+Result+4",
    "https://via.placeholder.com/400x400.png?text=AI+Result+5"
];

// Mảng Idol Names
const idolNames = ["Nhân vật Nam - Áo khoác", "Nhân vật Nữ - Áo xanh", "Thần tượng Rồng Vàng"];

// Open / Close Modal
btnCreatorModal.addEventListener('click', () => {
    aiModalOverlay.style.display = 'flex';
});

closeAiModal.addEventListener('click', () => {
    aiModalOverlay.style.display = 'none';
});

// File Input
userFaceInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        fileNameDisplay.innerText = "Đã chọn: " + e.target.files[0].name;
    }
});

// Generate Trigger
btnGenerate.addEventListener('click', () => {
    if (!userFaceInput.files.length) {
        alert("Tính năng test: Bạn chưa chọn ảnh cá nhân, nhưng tôi vẫn sẽ chạy bản Gen nháp để bạn test quy trình nhé!");
    }

    if (regenCount <= 0) {
        alert("Bạn đã hết 5 lượt tạo ảnh. Vui lòng chốt ảnh cuối cùng hoặc tải lại trang để thử lại.");
        return;
    }

    // Trừ lượt regen
    regenCount--;
    regenCountDisplay.innerText = regenCount;

    // Hiển thị khung chờ đợi
    aiPreviewArea.style.display = 'flex';
    aiLoading.style.display = 'block';
    aiResultImg.style.display = 'none';
    btnAcceptProduct.style.display = 'none';

    // Real API Call
    const API_KEY = "AIzaSyCJlrODtjBXGzE8hdq6bbk1eovFov9dq-s";
    // Có thể dùng gemini-3.1-flash-image-preview hoặc nano-banana-pro-preview
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/nano-banana-pro-preview:generateContent?key=${API_KEY}`;
    
    // Đọc file ảnh user tải lên
    const file = userFaceInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async function() {
        const base64Data = reader.result.split(',')[1]; // Lấy chuỗi base64 bỏ phần header
        const mimeType = file.type;
        const idolSelectedText = idolSelect.options[idolSelect.selectedIndex].text;
        const promptText = `Hãy tạo một bức ảnh chân thực của người trong bức ảnh này đang đứng cạnh idol: ${idolSelectedText} tại sự kiện Hành Trình Rồng Việt, mặc trang phục đẹp mắt, lộng lẫy mang phong cách văn hóa Việt Nam. Giữ lại nét mặt nhân vật thật tự nhiên.`;

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: promptText },
                            { inline_data: { mime_type: mimeType, data: base64Data } }
                        ]
                    }]
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                console.error("API Error details:", data);
                if (data.error && data.error.code === 429) {
                    throw new Error("Tài khoản của bạn đã hết hạn mức (Quota) miễn phí hoặc cần nạp thêm tiền. Lỗi 429.");
                }
                throw new Error("Lỗi gọi API: " + (data.error?.message || response.statusText));
            }

            // Parse response tìm phần tử trả về inlineData
            let generatedBase64 = null;
            if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
                const parts = data.candidates[0].content.parts;
                for (let part of parts) {
                    if (part.inlineData) {
                        generatedBase64 = part.inlineData.data;
                        break;
                    } else if (part.inline_data) {
                        generatedBase64 = part.inline_data.data;
                        break;
                    }
                }
            }

            if (!generatedBase64) {
               throw new Error("AI không trả về ảnh. Có thể prompt vi phạm chính sách hoặc lỗi hệ thống.");
            }

            aiLoading.style.display = 'none';
            aiResultImg.style.display = 'block';
            
            // Xây dựng src base64
            currentMockImageUrl = "data:image/jpeg;base64," + generatedBase64;
            aiResultImg.src = currentMockImageUrl;

            // Hiện nút chốt
            btnAcceptProduct.style.display = 'inline-block';
            
            if(regenCount > 0) {
                btnGenerate.innerText = "Chưa ưng? Gen lại";
            } else {
                btnGenerate.innerText = "Đã hết lượt";
                btnGenerate.disabled = true;
                btnGenerate.style.opacity = 0.5;
            }
        } catch (err) {
            console.error(err);
            alert("Rất tiếc quá trình xử lý thất bại: " + err.message);
            aiLoading.style.display = 'none';
        }
    };
    
    // Nếu upload ảnh thật thì đọc ảnh, không thì dùng fake image base64
    if (file) {
        reader.readAsDataURL(file);
    } else {
        // Bypass logic cho việc không up ảnh
        aiLoading.style.display = 'none';
        alert("Để test API trực tiếp bạn nhất định phải upload file hợp lệ. Chức năng bypass này bị vô hiệu hóa khi nối API thật.");
    }
});

// Chốt ảnh và đẩy vào giỏ
btnAcceptProduct.addEventListener('click', () => {
    if (!currentMockImageUrl) return;
    
    // Đóng AI Modal
    aiModalOverlay.style.display = 'none';
    
    // Gọi hàm addToCartObject bên cart.js (đảm bảo cart.js load trước)
    // Tính giá chung cho thẻ in Ảo ảnh là 250.000 đ
    const specialProduct = {
        img: currentMockImageUrl,
        title: "Thẻ Hóa Thân Rồng Việt (Custom)",
        price: 250000
    };
    
    if(window.addToCartObject) {
        window.addToCartObject(specialProduct);
    } else {
        alert("Đã thêm vào giỏ. Hãy mở giỏ hàng để kiểm tra.");
    }
});

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
const btnAcceptProduct = document.getElementById('btnAcceptProduct');
const btnDownloadImage = document.getElementById('btnDownloadImage');

// State
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
        alert("Vui lòng chọn ảnh khuôn mặt bằng nút phía trên.");
        return;
    }

    // Hiển thị khung chờ đợi
    aiPreviewArea.style.display = 'flex';
    aiLoading.style.display = 'block';
    aiResultImg.style.display = 'none';
    btnAcceptProduct.style.display = 'none';
    if (btnDownloadImage) btnDownloadImage.style.display = 'none';

    // Real API Call qua Backend
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? "http://localhost:3000/api/generate-avatar" : "/api/generate-avatar";
    
    const file = userFaceInput.files[0];
    const reader = new FileReader();

    reader.onload = function(event) {
        // Tải ảnh vào object img
        const img = new Image();
        img.onload = async function() {
            // Nén ảnh bằng Canvas
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_SIZE = 800; // Giới hạn kích thước để truyền nhanh, tránh sập server Nginx 413

            if (width > height) {
                if (width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Chuyển sang base64 JPEG với quality 0.8
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            const base64Data = dataUrl.split(',')[1];
            const mimeType = 'image/jpeg';
            
            const idolSelectedRadio = document.querySelector('input[name="idolSelect"]:checked');
            const idolId = idolSelectedRadio ? idolSelectedRadio.value : "sontung";

            const genderRadio = document.querySelector('input[name="userGender"]:checked');
            const userGender = genderRadio ? genderRadio.value : "nam";

            const templateName = `${idolId}_${userGender}`;

            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        templateName: templateName,
                        mimeType: mimeType,
                        base64Data: base64Data
                    })
                });

                const contentType = response.headers.get("content-type");
                
                // Bắt lỗi không phải JSON trước khi phân mảnh (ví dụ lỗi Gateway Timeout HTML)
                if (!response.ok && contentType && contentType.indexOf("application/json") === -1) {
                    throw new Error(`Máy chủ bận hoặc nghẽn mạng (${response.status}). Khối lượng xử lý quá lớn.`);
                }

                const data = await response.json();

                if (!response.ok) {
                    console.error("API Error details:", data);
                    if (data.error && data.error.code === 429) {
                        throw new Error("Tài khoản của bạn đã hết hạn mức (Quota) miễn phí hoặc cần nạp thêm tiền. Lỗi 429.");
                    }
                    throw new Error("Lỗi gọi API: " + (data.error?.message || response.statusText));
                }

                if (!data.imageUrl) {
                    throw new Error("AI không trả về ảnh. Có thể có lỗi trong quá trình xử lý.");
                }

                aiLoading.style.display = 'none';
                aiResultImg.style.display = 'block';

                currentMockImageUrl = data.imageUrl;
                aiResultImg.src = currentMockImageUrl;

                // Hiện nút chốt và nút download
                btnAcceptProduct.style.display = 'inline-block';
                if (btnDownloadImage) btnDownloadImage.style.display = 'inline-block';

                btnGenerate.innerText = "Chưa ưng? Gen lại";
            } catch (err) {
                console.error(err);
                alert("Rất tiếc quá trình xử lý thất bại: " + err.message);
                aiLoading.style.display = 'none';
            }
        };
        img.src = event.target.result;
    };
    
    reader.readAsDataURL(file);
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

    if (window.addToCartObject) {
        window.addToCartObject(specialProduct);
    } else {
        alert("Đã thêm vào giỏ. Hãy mở giỏ hàng để kiểm tra.");
    }
});

// Nút Tải ảnh 
if (btnDownloadImage) {
    btnDownloadImage.addEventListener('click', async () => {
        if (!currentMockImageUrl) return;
        try {
            // Tải url về blob local để không bị lỗi CORS chặn tải file của thẻ A download
            const response = await fetch(currentMockImageUrl);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `HoaThan_RongViet_${Date.now()}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error("Lỗi download:", error);
            alert("Trình duyệt chặn việc lưu ảnh tự động. Bạn hãy giữ vào ảnh và chọn 'Lưu hình ảnh' từ di động nhé!");
        }
    });
}

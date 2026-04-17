require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { PayOS } = require('@payos/node');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const Replicate = require('replicate');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: false }));

// Rate Limiters
const chatLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 20, 
    message: { error: "Bạn nhắn tin quá nhanh, xin vui lòng đợi." }
});

const avatarLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, 
    max: 20, 
    message: { error: { message: "Bạn đã hết giới hạn tạo ảnh (tối đa 20 lượt 1 ngày trên 1 IP)." } }
});

// Admin Authentication Middleware
const ADMIN_PIN = process.env.ADMIN_PIN || '123456';
const authAdmin = (req, res, next) => {
    const pin = req.headers['x-admin-pin'];
    if (pin === ADMIN_PIN) {
        next();
    } else {
        res.status(401).json({ success: false, error: "Sai mã PIN bảo mật Admin" });
    }
};

const payos = new PayOS({
    clientId: process.env.PAYOS_CLIENT_ID,
    apiKey: process.env.PAYOS_API_KEY,
    checksumKey: process.env.PAYOS_CHECKSUM_KEY
});

// Lưu trạng thái đơn hàng ảo trong RAM
const orders = {};

// --- QUẢN LÝ SẢN PHẨM ---
const DATA_FILE = path.join(__dirname, 'data.json');

app.get('/api/products', async (req, res) => {
    try {
        const data = await fsPromises.readFile(DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (e) {
        res.json([]);
    }
});

app.post('/api/products', authAdmin, async (req, res) => {
    try {
        const { title, price, img, category } = req.body;
        const products = JSON.parse(await fsPromises.readFile(DATA_FILE, 'utf8'));
        const newProduct = {
            id: 'p' + Date.now(),
            title,
            price: Number(price),
            img,
            category: category || 'thoi-trang' // Default
        };
        products.push(newProduct);
        await fsPromises.writeFile(DATA_FILE, JSON.stringify(products, null, 2));
        res.json({ success: true, product: newProduct });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.put('/api/products/:id', authAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, price, img, category } = req.body;
        const products = JSON.parse(await fsPromises.readFile(DATA_FILE, 'utf8'));
        const index = products.findIndex(p => p.id === id);
        if (index > -1) {
            products[index] = { ...products[index], title, price: Number(price), img, category };
            await fsPromises.writeFile(DATA_FILE, JSON.stringify(products, null, 2));
            res.json({ success: true, product: products[index] });
        } else {
            res.status(404).json({ success: false, message: 'Not found' });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/products/:id', authAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        let products = JSON.parse(await fsPromises.readFile(DATA_FILE, 'utf8'));
        products = products.filter(p => p.id !== id);
        await fsPromises.writeFile(DATA_FILE, JSON.stringify(products, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/create-payment-link', async (req, res) => {
    try {
        const { amount, description, items } = req.body;
        // PayOS yêu cầu orderCode là số nguyên (tối đa 53 bits). Ta dùng timestamp cho đơn giản.
        const orderCode = Number(String(Date.now()).slice(-6));

        const body = {
            orderCode: orderCode,
            amount: amount,
            description: description || 'Thanh toan HTRV',
            items: items || [],
            returnUrl: process.env.RETURN_URL, // Link trả về khi thành công
            cancelUrl: process.env.CANCEL_URL, // Link trả về khi huỷ
        };

        orders[orderCode] = { status: 'PENDING', amount };

        const paymentLinkRes = await payos.paymentRequests.create(body);

        return res.json({
            error: 0,
            message: "Success",
            data: {
                checkoutUrl: paymentLinkRes.checkoutUrl,
                paymentLinkId: paymentLinkRes.paymentLinkId,
                orderCode: orderCode
            }
        });
    } catch (error) {
        console.error("Error creating payment link:", error);
        return res.status(500).json({
            error: -1,
            message: "Failed",
            data: null
        });
    }
});

// PayOS sẽ chủ động gửi dữ liệu về cổng này (Webhook / IPN)
app.post('/payos-webhook', (req, res) => {
    console.log("Receive webhook from PayOS");
    try {
        // Xác thực dữ liệu webhook để tránh giả mạo
        const webhookData = payos.webhooks.verify(req.body);

        if (webhookData.code === "00") { // 00 là mã thành công của PayOS
            console.log(`Tiền đã vào tài khoản cho đơn hàng: ${webhookData.orderCode}`);
            // Lệnh cập nhật DB...
            if (orders[webhookData.orderCode]) {
                orders[webhookData.orderCode].status = 'PAID';
            }
        }

        return res.json({ error: 0, message: "Ok", success: true });
    } catch (err) {
        console.error("Sai chữ ký Webhook (Invalid checksum)", err);
        return res.status(400).json({ error: -1, message: "Invalid webhook", success: false });
    }
});

app.get('/order/:orderCode', (req, res) => {
    const order = orders[req.params.orderCode];
    if (order) {
        return res.json({ error: 0, data: order });
    }
    return res.status(404).json({ error: -1, message: "Not found" });
});

// --- BỘ NÃO AI (GEMINI) ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// LUẬT CỦA CHATBOT (BẠN CÓ THỂ SỬA Ở ĐÂY)
const chatbotRule = `
Bạn là "Rồng Con", nhân viên tư vấn cực kỳ dễ thương của shop Hành Trình Rồng Việt.
Quy tắc:
1. Luôn xưng hô là "Em" và gọi khách là "Anh/Chị".
2. Khuyến khích khách hàng mua các sản phẩm mang đậm bản sắc dân tộc Việt.
3. RẤT QUAN TRỌNG: Bạn đã được cung cấp Dữ liệu Mảng Sản Phẩm của Shop ở ngay phía dưới. Hãy tra cứu dữ liệu này để báo chính xác Tên, Giá tiền, và Danh mục cho khách nếu khách hỏi.
4. Trả lời thật ngắn gọn, súc tích và nhiệt tình.
5. Tuyệt đối không trả lời những câu hỏi khác ngoài văn hóa Việt Nam và các câu hỏi về sản phẩm.
`;

app.post('/api/chat', chatLimiter, async (req, res) => {
    try {
        const { userPrompt } = req.body;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

        // Đọc danh sách sản phẩm từ data.json để cung cấp cho AI nhận thức
        let productListPrompt = "";
        try {
            const products = JSON.parse(await fsPromises.readFile(DATA_FILE, 'utf8'));
            // Chỉ trích xuất thông tin cần thiết để tiết kiệm token
            const contextData = products.map(p => `- Tên SP: ${p.title}, Giá: ${p.price} VNĐ, Danh mục: ${p.category}`).join("\n");
            productListPrompt = "\n[DỮ LIỆU SẢN PHẨM HIỆN CÓ CỦA SHOP]\n" + contextData;
        } catch (e) {
            console.error("Không tải được dữ liệu sản phẩm cho chatbot", e);
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${chatbotRule}\n${productListPrompt}\n\nKhách hỏi: "${userPrompt}"`
                    }]
                }]
            })
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-avatar', avatarLimiter, async (req, res) => {
    try {
        const { templateName, mimeType, base64Data } = req.body;
        
        if (!base64Data) {
            return res.status(400).json({ error: { message: "Bạn cần chọn ảnh khuôn mặt." } });
        }

        // Tìm ảnh phôi (Template) từ đĩa
        const templateExtensions = ['.png', '.jpg', '.jpeg'];
        let templatePath = null;
        let templateExt = null;
        
        for (const ext of templateExtensions) {
            const p = path.join(__dirname, '../frontend/assets/img', `${templateName}${ext}`);
            if (fs.existsSync(p)) {
                templatePath = p;
                templateExt = ext;
                break;
            }
        }

        if (!templatePath) {
             return res.status(404).json({ error: { message: `Thiếu file phôi: frontend/assets/img/${templateName}.png hoặc .jpg` } });
        }

        const templateBuffer = fs.readFileSync(templatePath);
        const templateBase64 = templateBuffer.toString('base64');
        const templateMime = templateExt === '.png' ? 'image/png' : 'image/jpeg';
        const templateUri = `data:${templateMime};base64,${templateBase64}`;
        const dataUri = `data:${mimeType || 'image/jpeg'};base64,${base64Data}`;

        const replicate = new Replicate({
            auth: process.env.REPLICATE_API_TOKEN,
        });

        // Chạy model Face Swap (Hoán đổi khuôn mặt khách hàng vào Phôi chụp chung)
        const output = await replicate.run(
            "lucataco/faceswap:9a4298548422074c3f57258c5d544497314ae4112df80d116f0d2109e843d20d",
            {
                input: {
                    target_image: templateUri,
                    swap_image: dataUri
                }
            }
        );

        let imageUrl = "";
        const fileOutput = Array.isArray(output) ? output[0] : output;
        
        // Replicate v1.4+ trả về FileOutput (ReadableStream), ta cần gọi hàm .url() để lấy Object URL
        if (fileOutput && typeof fileOutput.url === 'function') {
            const urlObj = fileOutput.url();
            imageUrl = urlObj.href || urlObj;
        } else if (fileOutput && fileOutput.href) {
            imageUrl = fileOutput.href;
        } else {
            imageUrl = String(fileOutput);
        }
        
        res.json({ imageUrl: imageUrl });
    } catch (error) {
        console.error("Replicate Image Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend Server đang chạy ở cổng ${PORT}`);
});

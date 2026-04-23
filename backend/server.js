require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { PayOS } = require('@payos/node');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const Replicate = require('replicate');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

// Import Sequelize Models
const sequelize = require('./models/index');
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');
const OrderItem = require('./models/OrderItem');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_default_key';

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
    message: { error: { message: "Bạn đã hết giới hạn tạo ảnh." } }
});

// middlewares
const ADMIN_PIN = process.env.ADMIN_PIN || '123456';
const authAdmin = (req, res, next) => {
    const pin = req.headers['x-admin-pin'];
    if (pin === ADMIN_PIN) {
        next();
    } else {
        res.status(401).json({ success: false, error: "Sai mã PIN bảo mật Admin" });
    }
};

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = await User.findByPk(decoded.id);
        if (!req.user) throw new Error('User not found');
        if (!req.user.isActive) return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị khóa bởi Admin.' });
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
};

const payos = new PayOS({
    clientId: process.env.PAYOS_CLIENT_ID,
    apiKey: process.env.PAYOS_API_KEY,
    checksumKey: process.env.PAYOS_CHECKSUM_KEY
});

// --- AUTHENTICATION API ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, fullName, phone } = req.body;
        if(!username || !password) return res.status(400).json({ success: false, message: "Username và Password là bắt buộc" });
        
        const existingInfo = await User.findOne({ where: { username } });
        if(existingInfo) return res.status(400).json({ success: false, message: "Tên đăng nhập đã tồn tại" });
        
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({
            username,
            passwordHash,
            fullName,
            phone
        });
        res.json({ success: true, message: "Đăng ký thành công" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ where: { username } });
        if(!user) return res.status(401).json({ success: false, message: "Sai tên đăng nhập hoặc mật khẩu" });
        
        const match = await bcrypt.compare(password, user.passwordHash);
        if(!match) return res.status(401).json({ success: false, message: "Sai tên đăng nhập hoặc mật khẩu" });
        
        if(!user.isActive) return res.status(403).json({ success: false, message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ." });
        
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { id: user.id, username: user.username, fullName: user.fullName, phone: user.phone, role: user.role } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/auth/me', verifyToken, async (req, res) => {
    try {
        // Fetch User and their latest orders
        const orders = await Order.findAll({
            where: { userId: req.user.id },
            include: [{ model: OrderItem, include: [Product] }],
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, user: req.user, orders });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- PRODUCTS API (Sequelize) ---
app.get('/api/products', async (req, res) => {
    try {
        let { page, limit, category, search } = req.query;
        page = parseInt(page) || 1;
        limit = parseInt(limit) || 8;
        const offset = (page - 1) * limit;

        const whereClause = {};

        if (category && category !== 'all') {
            whereClause.category = category;
        }

        if (search) {
            whereClause.title = {
                [Op.iLike]: `%${search}%`
            };
        }

        const { count, rows } = await Product.findAndCountAll({
            where: whereClause,
            limit: limit,
            offset: offset,
            // Cập nhật sắp xếp nếu muốn
        });

        res.json({
            products: rows,
            total: count,
            page: page,
            limit: limit,
            hasMore: offset + limit < count
        });
    } catch (e) {
        console.error("Lỗi lấy sản phẩm:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/products', authAdmin, async (req, res) => {
    try {
        const { title, price, img, category } = req.body;
        const newProduct = await Product.create({
            id: 'p' + Date.now(),
            title,
            price: Number(price),
            img,
            category: category || 'thoi-trang'
        });
        res.json({ success: true, product: newProduct });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.put('/api/products/:id', authAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, price, img, category } = req.body;
        const product = await Product.findByPk(id);
        if (product) {
            await product.update({ title, price: Number(price), img, category });
            res.json({ success: true, product });
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
        await Product.destroy({ where: { id } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});


// --- ADMIN ORDERS API ---
app.get('/api/admin/orders', authAdmin, async (req, res) => {
    try {
        const orders = await Order.findAll({
            include: [User, { model: OrderItem, include: [Product] }],
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, orders });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.put('/api/admin/orders/:orderCode', authAdmin, async (req, res) => {
    try {
        const { orderCode } = req.params;
        const { shippingName, shippingPhone, shippingAddress, status } = req.body;
        
        const order = await Order.findByPk(orderCode);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Đơn hàng không tồn tại' });
        }
        
        await order.update({
            shippingName,
            shippingPhone,
            shippingAddress,
            status
        });
        
        res.json({ success: true, order });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- ADMIN USERS API ---
app.get('/api/admin/users', authAdmin, async (req, res) => {
    try {
        const users = await User.findAll({ attributes: { exclude: ['passwordHash'] }, order: [['createdAt', 'DESC']] });
        res.json({ success: true, users });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/admin/users', authAdmin, async (req, res) => {
    try {
        const { username, password, fullName, phone } = req.body;
        if(!username || !password) return res.status(400).json({ success: false, message: "Username và Password là bắt buộc" });
        const existingInfo = await User.findOne({ where: { username } });
        if(existingInfo) return res.status(400).json({ success: false, message: "Tên đăng nhập đã tồn tại" });
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({ username, passwordHash, fullName, phone, isActive: true });
        res.json({ success: true, message: "Đã thêm Khách hàng" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.put('/api/admin/users/:id', authAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { fullName, phone, password, isActive } = req.body;
        const user = await User.findByPk(id);
        if(!user) return res.status(404).json({ success: false, message: "Không tìm thấy user" });
        
        let updateData = { fullName, phone, isActive };
        if (password) {
            updateData.passwordHash = await bcrypt.hash(password, 10);
        }
        await user.update(updateData);
        res.json({ success: true, message: "Cập nhật thành công" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- PAYOS CHECKOUT API ---
app.post('/api/create-payment-link', verifyToken, async (req, res) => {
    try {
        const { amount, description, items, shippingInfo, returnUrl, cancelUrl } = req.body;
        // shippingInfo: { fullName, phone, address }
        
        if(!shippingInfo || !shippingInfo.address || !shippingInfo.phone || !shippingInfo.fullName) {
             return res.status(400).json({ error: -1, message: "Cần đủ thông tin giao hàng." });
        }

        const orderCode = Number(String(Date.now()).slice(-9)); // Đảm bảo unique và max 53bit

        const body = {
            orderCode: orderCode,
            amount: amount,
            description: description || 'Thanh toan HTRV',
            items: items.map(item => ({ name: item.name, quantity: item.quantity, price: item.price })), // Ensure valid format
            returnUrl: returnUrl || process.env.RETURN_URL, // Dynamic Link
            cancelUrl: cancelUrl || process.env.CANCEL_URL, // Dynamic Link
        };

        // Lưu Order vào PostgreSQL với trạng thái PENDING
        const order = await Order.create({
            orderCode: orderCode,
            userId: req.user.id,
            shippingName: shippingInfo.fullName,
            shippingPhone: shippingInfo.phone,
            shippingAddress: shippingInfo.address,
            totalAmount: amount,
            status: 'PENDING'
        });

        // Lưu OrderItem
        for (const item of items) {
             await OrderItem.create({
                 orderCode: orderCode,
                 productId: item.id || null, // client should pass id
                 quantity: item.quantity || 1,
                 priceAtPurchase: item.price
             });
        }

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
            message: error.message || "Failed",
            data: null
        });
    }
});

app.post('/api/payos-webhook', async (req, res) => {
    console.log("Receive webhook from PayOS");
    try {
        const webhookData = payos.webhooks.verify(req.body);

        if (webhookData.code === "00") { 
            console.log(`Tiền đã vào tài khoản cho đơn hàng: ${webhookData.orderCode}`);
            // Update Database
            await Order.update(
                { status: 'PAID' }, 
                { where: { orderCode: webhookData.orderCode } }
            );
        }

        return res.json({ error: 0, message: "Ok", success: true });
    } catch (err) {
        console.error("Sai chữ ký Webhook (Invalid checksum)", err);
        return res.status(400).json({ error: -1, message: "Invalid webhook", success: false });
    }
});

app.get('/api/order/:orderCode', async (req, res) => {
    const order = await Order.findByPk(req.params.orderCode);
    if (order) {
        return res.json({ error: 0, data: order });
    }
    return res.status(404).json({ error: -1, message: "Not found" });
});

app.get('/api/orders/sync-status/:orderCode', async (req, res) => {
    try {
        const orderCode = req.params.orderCode;
        // Check order in local DB
        const order = await Order.findOne({ where: { orderCode: orderCode } });
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        // If PENDING, strictly verify with PayOS server
        if (order.status === 'PENDING') {
            try {
                const paymentInfo = await payos.paymentRequests.get(orderCode);
                if (paymentInfo && paymentInfo.status && paymentInfo.status !== order.status) {
                    await order.update({ status: paymentInfo.status });
                }
            } catch (payosError) {
                console.error("Lỗi khi kiểm tra PayOS:", payosError.message);
                // Có thể do đơn hàng vừa hủy hoặc chưa tồn tại trên hệ thống PayOS ngay lập tức
            }
        }
        res.json({ success: true, status: order.status });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// --- BỘ NÃO AI (GEMINI) ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.get('/api/orders/:orderCode/payment-link', verifyToken, async (req, res) => {
    try {
        const orderCode = req.params.orderCode;
        const paymentInfo = await payos.paymentRequests.get(orderCode);
        if (paymentInfo && paymentInfo.status === 'PENDING') {
             res.json({ success: true, checkoutUrl: `https://pay.payos.vn/web/${paymentInfo.id}` });
        } else {
             res.status(400).json({ success: false, message: 'Đơn hàng không còn ở trạng thái PENDING hoặc không tồn tại' });
        }
    } catch (e) {
         res.status(500).json({ success: false, message: e.message });
    }
});

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

        let productListPrompt = "";
        try {
            const products = await Product.findAll();
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

// --- AI AVATAR (REPLICATE) ---
app.post('/api/generate-avatar', avatarLimiter, async (req, res) => {
    try {
        const { templateName, mimeType, base64Data } = req.body;
        
        if (!base64Data) return res.status(400).json({ error: { message: "Bạn cần chọn ảnh khuôn mặt." } });

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

        if (!templatePath) return res.status(404).json({ error: { message: `Thiếu file phôi: frontend/assets/img/${templateName}.png hoặc .jpg` } });

        const templateBuffer = fs.readFileSync(templatePath);
        const templateBase64 = templateBuffer.toString('base64');
        const templateMime = templateExt === '.png' ? 'image/png' : 'image/jpeg';
        const templateUri = `data:${templateMime};base64,${templateBase64}`;
        const dataUri = `data:${mimeType || 'image/jpeg'};base64,${base64Data}`;

        const replicate = new Replicate({
            auth: process.env.REPLICATE_API_TOKEN,
        });

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


// Init Database & Start Server
const startServer = async () => {
    try {
        await sequelize.sync({ alter: true }); // Migrate tables
        
        // Setup initial DB from data.json if empty
        const count = await Product.count();
        if (count === 0) {
            const dataPath = path.join(__dirname, 'data.json');
            if (fs.existsSync(dataPath)) {
                const oldData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
                for(let item of oldData) {
                    await Product.create({
                         id: item.id,
                         title: item.title,
                         price: item.price,
                         img: item.img,
                         category: item.category
                    });
                }
                console.log("Đã import dữ liệu từ data.json sang PostgreSQL");
            }
        }

        app.listen(PORT, () => {
            console.log(`Backend Server đang chạy ở cổng ${PORT}`);
        });
    } catch(err) {
        console.error("Cannot connect or sync database:", err);
    }
}

startServer();

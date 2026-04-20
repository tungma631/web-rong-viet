const http = require('http');

console.log("=== BẮT ĐẦU TEST SỨC KHỎE API ===");
const BASE_URL = 'http://localhost:3000';

const testAPI = async (endpoint, options = {}) => {
    try {
        const res = await fetch(BASE_URL + endpoint, {
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            ...options
        });
        const contentType = res.headers.get("content-type");
        const data = contentType && contentType.includes("application/json") ? await res.json() : await res.text();
        return { status: res.status, data };
    } catch (e) {
        return { status: "ERROR", data: e.message };
    }
}

const runTests = async () => {
    // 1. Get Products
    console.log("\\n1. [GET /api/products] Lấy danh sách sản phẩm...");
    let res = await testAPI('/api/products');
    console.log(res.status === 200 ? "✅ THÀNH CÔNG:" : "❌ THẤT BẠI:");
    console.log(Array.isArray(res.data) ? `Đã lấy được ${res.data.length} sản phẩm.` : res.data);

    // 2. Register
    const mockUser = { username: "tester_" + Date.now(), password: "123", fullName: "Khach Hang", phone: "0999888" };
    console.log("\\n2. [POST /api/auth/register] Đăng ký User mới (" + mockUser.username + ")...");
    res = await testAPI('/api/auth/register', { method: 'POST', body: JSON.stringify(mockUser) });
    console.log(res.status === 200 && res.data.success ? "✅ THÀNH CÔNG: " + res.data.message : "❌ THẤT BẠI: " + JSON.stringify(res.data));

    // 3. Login
    console.log("\\n3. [POST /api/auth/login] Đăng nhập...");
    res = await testAPI('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: mockUser.username, password: "123" }) });
    let token = "";
    if (res.status === 200 && res.data.success) {
        console.log("✅ THÀNH CÔNG! Đã lấy được JWT Token");
        token = res.data.token;
    } else {
        console.log("❌ THẤT BẠI: " + JSON.stringify(res.data));
    }

    // 4. Create Order
    if (token) {
        console.log("\\n4. [POST /api/create-payment-link] Tạo Đơn Hàng mới...");
        const orderPayload = {
            amount: 50000,
            items: [{ id: "p2", name: "Áo Test", quantity: 1, price: 50000 }],
            shippingInfo: { fullName: "Test Delivery", phone: "012", address: "HCM" }
        };
        res = await testAPI('/api/create-payment-link', { 
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(orderPayload) 
        });
        
        if (res.data && res.data.error === 0) {
            console.log("✅ THÀNH CÔNG! Đã tạo Order và PayOS Link:");
            console.log(" -> Link thanh toán: " + res.data.data.checkoutUrl);
            console.log(" -> Order Code lưu vào DB: " + res.data.data.orderCode);
        } else {
            console.log("❌ THẤT BẠI: " + JSON.stringify(res.data));
        }
    }
    
    console.log("\\n=== KẾT THÚC TEST ===");
};

runTests();

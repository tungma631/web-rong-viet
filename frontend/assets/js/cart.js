// cart.js - Quản lý giỏ hàng và Thanh toán
let shoppingCart = [];

// DOM Elements
const cartIcon = document.getElementById('cart-icon');
const cartCount = document.querySelector('.cart-count');
const cartOverlay = document.getElementById('cartOverlay');
const cartSidebar = document.getElementById('cartSidebar');
const closeCartBtn = document.getElementById('closeCartBtn');
const cartItemsList = document.getElementById('cartItemsList');
const cartTotalPrice = document.getElementById('cartTotalPrice');

const btnCheckout = document.getElementById('btnCheckout');
const shipWarningMsg = document.getElementById('shipWarningMsg');

const momoModalOverlay = document.getElementById('momoModalOverlay');
const closeMomoModal = document.getElementById('closeMomoModal');
const btnConfirmPaid = document.getElementById('btnConfirmPaid');
const momoOrderInfo = document.getElementById('momoOrderInfo');

// Format tiền tệ
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

// Cập nhật UI giỏ hàng
const updateCartUI = () => {
    cartCount.innerText = shoppingCart.reduce((total, item) => total + item.quantity, 0);
    let totalValue = 0;

    if (shoppingCart.length === 0) {
        cartItemsList.innerHTML = '<p class="empty-cart-msg">Giỏ hàng đang trống.</p>';
    } else {
        cartItemsList.innerHTML = '';
        shoppingCart.forEach((item, index) => {
            totalValue += item.price * item.quantity;
            cartItemsList.innerHTML += `
                <div class="cart-item" style="position:relative;">
                    <img src="${item.img}" alt="${item.title}">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 0.9rem;">${item.title}</div>
                        <div style="color: var(--secondary-color); font-weight: bold; font-size: 0.9rem;">${formatCurrency(item.price)}</div>
                        
                        <div style="display:flex; align-items:center; margin-top:5px; gap:8px;">
                            <button class="btn-secondary" style="padding: 2px 8px; font-size: 0.8rem;" onclick="decreaseQty('${item.id}')">-</button>
                            <span style="font-size: 0.9rem; font-weight:600;">${item.quantity}</span>
                            <button class="btn-secondary" style="padding: 2px 8px; font-size: 0.8rem;" onclick="increaseQty('${item.id}')">+</button>
                        </div>
                    </div>
                    <button style="position:absolute; right:10px; top:10px; background:none; border:none; color:red; cursor:pointer;" onclick="removeFromCart('${item.id}')">&times;</button>
                </div>
            `;
        });
    }
    cartTotalPrice.innerText = formatCurrency(totalValue);
};

window.removeFromCart = (id) => {
    shoppingCart = shoppingCart.filter(i => i.id !== id);
    updateCartUI();
};

window.increaseQty = (id) => {
    const item = shoppingCart.find(i => i.id === id);
    if(item) item.quantity += 1;
    updateCartUI();
};

window.decreaseQty = (id) => {
    const item = shoppingCart.find(i => i.id === id);
    if(item) {
        item.quantity -= 1;
        if(item.quantity <= 0) {
            window.removeFromCart(id);
        } else {
            updateCartUI();
        }
    }
};

window.addToCartObject = (product) => {
    const existingPos = shoppingCart.findIndex(i => i.id === product.id);
    if (existingPos > -1) {
        shoppingCart[existingPos].quantity += 1;
    } else {
        shoppingCart.push({ ...product, quantity: 1 });
    }
    updateCartUI();
    // Đã loại bỏ logic tự động mở giỏ hàng (cartSidebar) theo yêu cầu
    
    if (cartIcon) {
        cartIcon.classList.remove('shake-animation');
        void cartIcon.offsetWidth; // Force Reflow để trigger lại class mới
        cartIcon.classList.add('shake-animation');
    }
};

// Frontend legacy wrapper for custom cards like AI Avatar which doesn't have an ID initially
document.querySelectorAll('.product-card:not(.special-card) .btn-add-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const card = e.target.closest('.product-card');
        const img = card.querySelector('img').src;
        const title = card.querySelector('.product-title').innerText;
        const priceStr = card.querySelector('.product-price').innerText.replace(/[^\d]/g, '');
        const price = parseInt(priceStr, 10);
        
        // This is fallback, normally id will be passed from products.js
        window.addToCartObject({ id: 'p_fallback_' + Date.now(), img, title, price });
    });
});

// Sidebar Toggle
cartIcon.addEventListener('click', () => {
    cartOverlay.style.display = 'flex';
    cartSidebar.classList.add('open');
});

const closeCart = () => {
    cartOverlay.style.display = 'none';
    cartSidebar.classList.remove('open');
};

if(closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
if(cartOverlay) cartOverlay.addEventListener('click', closeCart);

// Checkout
btnCheckout.addEventListener('click', async () => {
    if (shoppingCart.length === 0) {
        alert("Giỏ hàng đang trống!");
        return;
    }

    const authToken = localStorage.getItem('authToken');
    if(!authToken) {
        // Mở Auth Modal bắt Đăng nhập
        window.openAuthOrDashboard();
        return;
    }

    const shipFullName = document.getElementById('shipFullName').value.trim();
    const shipPhone = document.getElementById('shipPhone').value.trim();
    const shipAddress = document.getElementById('shipAddress').value.trim();

    if(!shipFullName || !shipPhone || !shipAddress) {
        shipWarningMsg.style.display = 'block';
        return;
    }
    shipWarningMsg.style.display = 'none';

    // Tổng hợp Items payload
    const total = shoppingCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const items = shoppingCart.map(item => ({
        id: item.id,
        name: item.title,
        quantity: item.quantity,
        price: item.price
    }));

    try {
        btnCheckout.innerText = "Đang xử lý...";
        btnCheckout.disabled = true;

        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
        const fetchUrl = isLocal ? "http://127.0.0.1:3000/api/create-payment-link" : "/api/create-payment-link";

        const response = await fetch(fetchUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({
                amount: total,
                description: "Thanh toan HTRV",
                items: items,
                shippingInfo: {
                    fullName: shipFullName,
                    phone: shipPhone,
                    address: shipAddress
                },
                returnUrl: window.location.href.split('?')[0] + '?payos_return=true',
                cancelUrl: window.location.href.split('?')[0] + '?payos_cancel=true'
            })
        });

        const data = await response.json();

        if (data.error === 0 && data.data && data.data.checkoutUrl) {
            window.location.href = data.data.checkoutUrl;
        } else {
            alert("Lỗi thanh toán: " + data.message);
            btnCheckout.innerText = "Thanh toán (PayOS)";
            btnCheckout.disabled = false;
        }
    } catch (e) {
        console.error(e);
        alert("Lưu Đơn thất bại. Hãy kiểm tra kết nối Server");
        btnCheckout.innerText = "Thanh toán (PayOS)";
        btnCheckout.disabled = false;
    }
});

if(closeMomoModal) {
    closeMomoModal.addEventListener('click', () => momoModalOverlay.style.display = 'none');
}

if(btnConfirmPaid) {
    btnConfirmPaid.addEventListener('click', () => {
        alert("Cảm ơn! Giao dịch đang chờ xác nhận.");
        momoModalOverlay.style.display = 'none';
        shoppingCart = [];
        updateCartUI();
    });
}

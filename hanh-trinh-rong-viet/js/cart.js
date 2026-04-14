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
    cartCount.innerText = shoppingCart.length;
    let total = 0;
    
    if (shoppingCart.length === 0) {
        cartItemsList.innerHTML = '<p class="empty-cart-msg">Giỏ hàng đang trống.</p>';
    } else {
        cartItemsList.innerHTML = '';
        shoppingCart.forEach((item, index) => {
            total += item.price;
            cartItemsList.innerHTML += `
                <div class="cart-item">
                    <img src="${item.img}" alt="${item.title}">
                    <div>
                        <div style="font-weight: 600;">${item.title}</div>
                        <div style="color: var(--secondary-color); font-weight: bold;">${formatCurrency(item.price)}</div>
                        <button class="btn-secondary" style="padding: 2px 8px; font-size: 0.8rem; margin-top: 5px;" onclick="removeFromCart(${index})">Xóa</button>
                    </div>
                </div>
            `;
        });
    }
    cartTotalPrice.innerText = formatCurrency(total);
};

window.removeFromCart = (index) => {
    shoppingCart.splice(index, 1);
    updateCartUI();
};

window.addToCartObject = (product) => {
    shoppingCart.push(product);
    updateCartUI();
    // Mở giỏ hàng ra luôn
    cartOverlay.style.display = 'block';
    cartSidebar.classList.add('open');
};

// Lắng nghe sự kiện "Thêm vào giỏ" trên lưới sản phẩm
document.querySelectorAll('.product-card:not(.special-card) .btn-add-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const card = e.target.closest('.product-card');
        const img = card.querySelector('img').src;
        const title = card.querySelector('.product-title').innerText;
        // Parse giá từ string (VD: 119.000 đ)
        const priceStr = card.querySelector('.product-price').innerText.replace(/[^\d]/g, '');
        const price = parseInt(priceStr, 10);
        
        addToCartObject({ img, title, price });
    });
});

// Sidebar Toggle
cartIcon.addEventListener('click', () => {
    cartOverlay.style.display = 'block';
    cartSidebar.classList.add('open');
});

const closeCart = () => {
    cartOverlay.style.display = 'none';
    cartSidebar.classList.remove('open');
};

closeCartBtn.addEventListener('click', closeCart);
cartOverlay.addEventListener('click', closeCart);

// MoMo Checkout Logic
btnCheckout.addEventListener('click', () => {
    if (shoppingCart.length === 0) {
        alert("Giỏ hàng đang trống!");
        return;
    }
    
    // Tính tổng
    const total = shoppingCart.reduce((sum, item) => sum + item.price, 0);
    const orderId = 'HTRV-' + Math.floor(Math.random() * 1000000);
    
    momoOrderInfo.innerHTML = `Mã đơn hàng: <b>${orderId}</b><br>Tổng thanh toán: <b>${formatCurrency(total)}</b>`;
    
    closeCart();
    momoModalOverlay.style.display = 'flex';
});

closeMomoModal.addEventListener('click', () => {
    momoModalOverlay.style.display = 'none';
});

btnConfirmPaid.addEventListener('click', () => {
    alert("Cảm ơn! Giao dịch của bạn đang được xử lý.");
    momoModalOverlay.style.display = 'none';
    shoppingCart = [];
    updateCartUI();
});

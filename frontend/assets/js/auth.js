document.addEventListener('DOMContentLoaded', () => {
    const authModalOverlay = document.getElementById('authModalOverlay');
    const closeAuthModal = document.getElementById('closeAuthModal');
    const loginFormArea = document.getElementById('loginFormArea');
    const registerFormArea = document.getElementById('registerFormArea');
    
    const showRegisterLink = document.getElementById('showRegisterLink');
    const showLoginLink = document.getElementById('showLoginLink');
    
    const accountIcon = document.getElementById('account-icon');
    const accountNameText = document.getElementById('accountNameText');
    const dashboardModalOverlay = document.getElementById('dashboardModalOverlay');
    const closeDashboardModal = document.getElementById('closeDashboardModal');
    const dashFullName = document.getElementById('dashFullName');
    const userOrderHistory = document.getElementById('userOrderHistory');
    const btnLogOut = document.getElementById('btnLogOut');

    const BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
        ? "http://127.0.0.1:3000"
        : "";

    // Toggle forms
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginFormArea.style.display = 'none';
        registerFormArea.style.display = 'block';
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerFormArea.style.display = 'none';
        loginFormArea.style.display = 'block';
    });

    // Close Modals
    closeAuthModal.addEventListener('click', () => authModalOverlay.style.display = 'none');
    closeDashboardModal.addEventListener('click', () => dashboardModalOverlay.style.display = 'none');

    // Mở Account Modal
    window.openAuthOrDashboard = () => {
        const token = localStorage.getItem('authToken');
        if (token) {
            dashboardModalOverlay.style.display = 'flex';
            fetchUserProfile();
        } else {
            loginFormArea.style.display = 'block';
            registerFormArea.style.display = 'none';
            authModalOverlay.style.display = 'flex';
        }
    };

    if (accountIcon) {
        accountIcon.addEventListener('click', window.openAuthOrDashboard);
    }

    // Refresh UI Header
    const refreshHeaderUI = async () => {
        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                const res = await fetch(`${BASE_URL}/api/auth/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (res.status === 401 || res.status === 403) {
                    if (localStorage.getItem('authToken')) {
                        localStorage.removeItem('authToken');
                        alert("Tài khoản của bạn đã thay đổi phiên đăng nhập hoặc bị khóa!");
                        window.location.href = "index.html";
                    }
                    return;
                }

                const data = await res.json();
                if (data.success) {
                    accountNameText.textContent = `Chào ${data.user.fullName || data.user.username}`;
                    // Auto-fill delivery form
                    const shipFullName = document.getElementById('shipFullName');
                    const shipPhone = document.getElementById('shipPhone');
                    if(shipFullName && !shipFullName.value) shipFullName.value = data.user.fullName || '';
                    if(shipPhone && !shipPhone.value) shipPhone.value = data.user.phone || '';
                } else {
                    localStorage.removeItem('authToken');
                    accountNameText.textContent = "Đăng nhập";
                }
            } catch (e) {
                console.error("Auth verify error");
            }
        } else {
            accountNameText.textContent = "Đăng nhập";
        }
    };
    refreshHeaderUI();
    setInterval(refreshHeaderUI, 15000); // Polling check xem có bị khóa không sau mỗi 15 giây

    // Redirect check after payment
    const urlParams = new URLSearchParams(window.location.search);
    const returnedOrderCode = urlParams.get('orderCode');
    
    if (urlParams.get('payos_return') === 'true' || urlParams.get('cancel') === 'false' || urlParams.get('cancel') === 'true' || returnedOrderCode) {
        
        const syncStatusAndOpen = async () => {
            if (returnedOrderCode) {
                try {
                    await fetch(`${BASE_URL}/api/orders/sync-status/${returnedOrderCode}`);
                } catch (e) {
                    console.log("Not synced", e);
                }
            }
            if (localStorage.getItem('authToken')) {
                window.openAuthOrDashboard();
            }
            window.history.replaceState({}, document.title, window.location.pathname);
        };
        
        setTimeout(syncStatusAndOpen, 500); // Đợi 1 tí để UI render xong
    }

    // Login function
    document.getElementById('btnLoginSubmit').addEventListener('click', async () => {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        const errObj = document.getElementById('loginError');
        
        if(!username || !password) {
            errObj.textContent = "Vui lòng nhập đủ thông tin";
            errObj.style.display = "block";
            return;
        }
        
        document.getElementById('btnLoginSubmit').disabled = true;
        try {
            const res = await fetch(`${BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('authToken', data.token);
                authModalOverlay.style.display = 'none';
                refreshHeaderUI();
                errObj.style.display = 'none';
            } else {
                errObj.textContent = data.message;
                errObj.style.display = "block";
            }
        } catch (e) {
            errObj.textContent = "Lỗi kết nối server";
            errObj.style.display = "block";
        }
        document.getElementById('btnLoginSubmit').disabled = false;
    });

    // Register function
    document.getElementById('btnRegisterSubmit').addEventListener('click', async () => {
        const username = document.getElementById('regUsername').value.trim();
        const password = document.getElementById('regPassword').value.trim();
        const fullName = document.getElementById('regFullName').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const errObj = document.getElementById('regError');

        if(!username || !password) {
            errObj.textContent = "Vui lòng nhập đủ Username và Password";
            errObj.style.display = "block";
            return;
        }

        document.getElementById('btnRegisterSubmit').disabled = true;
        try {
            const res = await fetch(`${BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, fullName, phone })
            });
            const data = await res.json();
            if (data.success) {
                alert("Đăng ký thành công! Hãy đăng nhập.");
                registerFormArea.style.display = 'none';
                loginFormArea.style.display = 'block';
                errObj.style.display = 'none';
            } else {
                errObj.textContent = data.message;
                errObj.style.display = "block";
            }
        } catch (e) {
            errObj.textContent = "Lỗi kết nối server";
            errObj.style.display = "block";
        }
        document.getElementById('btnRegisterSubmit').disabled = false;
    });

    // Logout
    if(btnLogOut) {
        btnLogOut.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            dashboardModalOverlay.style.display = 'none';
            accountNameText.textContent = "Đăng nhập";
            
            // clear form
            const shipFullName = document.getElementById('shipFullName');
            const shipPhone = document.getElementById('shipPhone');
            const shipAddress = document.getElementById('shipAddress');
            if(shipFullName) shipFullName.value = '';
            if(shipPhone) shipPhone.value = '';
            if(shipAddress) shipAddress.value = '';
        });
    }

    // Fetch orders history
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    async function fetchUserProfile() {
        const token = localStorage.getItem('authToken');
        userOrderHistory.innerHTML = "<p>Đang tải...</p>";
        
        try {
            const res = await fetch(`${BASE_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (res.status === 401 || res.status === 403) {
                alert(data.message || "Phiên đăng nhập không hợp lệ hoặc tài khoản bị khóa!");
                localStorage.removeItem('authToken');
                window.location.reload();
                return;
            }

            if (data.success) {
                dashFullName.textContent = data.user.fullName || data.user.username;
                
                if (data.orders && data.orders.length > 0) {
                    userOrderHistory.innerHTML = data.orders.map(o => `
                        <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; border-radius: 4px;">
                            <strong>Đơn hàng: #${o.orderCode}</strong> <br/>
                            <span style="font-size:0.85rem; color:#666;">Ngày tạo: ${new Date(o.createdAt).toLocaleString('vi-VN')}</span> <br/>
                            <span>Tổng tiền: <b style="color:var(--secondary-color)">${formatCurrency(o.totalAmount)}</b></span> - 
                            <span style="font-weight:bold; color: ${o.status==='PAID' ? 'green' : (o.status==='CANCELLED' ? 'red' : 'orange')}">${o.status}</span>
                            ${o.status === 'PENDING' ? `<button onclick="window.repayOrder('${o.orderCode}')" style="margin-left: 10px; padding: 3px 10px; border:none; background: var(--secondary-color); color: #fff; cursor: pointer; border-radius: 4px;">Thanh toán lại</button>` : ''}
                            <div style="margin-top: 5px; font-size: 0.85rem; padding-left: 10px; border-left: 2px solid #ddd;">
                                ${o.OrderItems.map(item => `- ${item.Product ? item.Product.title : 'Sản phẩm ' + item.productId} (x${item.quantity})<br/>`).join('')}
                            </div>
                        </div>
                    `).join('');
                } else {
                    userOrderHistory.innerHTML = "<p>Bạn chưa có đơn hàng nào.</p>";
                }
            } else {
                 userOrderHistory.innerHTML = `<p>${data.message}</p>`;
            }
        } catch (e) {
            userOrderHistory.innerHTML = "<p>Hoạt động thất bại do mất kết nối.</p>";
        }
    }

    window.repayOrder = async (orderCode) => {
        const token = localStorage.getItem('authToken');
        if(!token) return;
        try {
            const res = await fetch(`${BASE_URL}/api/orders/${orderCode}/payment-link`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success && data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else {
                alert("Không thể thanh toán lại. Vui lòng tạo đơn hàng mới! " + (data.message || ''));
            }
        } catch (e) {
            alert("Lỗi tải link thanh toán. Thử lại sau.");
        }
    };
});

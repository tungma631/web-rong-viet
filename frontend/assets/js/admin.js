document.addEventListener("DOMContentLoaded", () => {
    const adminProductList = document.getElementById("adminProductList");
    const formTitle = document.getElementById("formTitle");
    const prodId = document.getElementById("prodId");
    const prodTitle = document.getElementById("prodTitle");
    const prodPrice = document.getElementById("prodPrice");
    const prodImg = document.getElementById("prodImg");
    const prodCategory = document.getElementById("prodCategory");
    const btnSaveProd = document.getElementById("btnSaveProd");
    const btnCancelEdit = document.getElementById("btnCancelEdit");

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const API_URL = isLocal ? "http://localhost:3000/api/products" : "/api/products";
    let adminPin = ""; // Biến lưu mã PIN tạm trên RAM

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    // Tải danh sách Sản Phẩm
    const loadProducts = async () => {
        try {
            const res = await fetch(API_URL);
            const data = await res.json();
            const products = Array.isArray(data) ? data : (data.products || []);

            adminProductList.innerHTML = "";
            if (products.length === 0) {
                adminProductList.innerHTML = `<tr><td colspan="3" style="text-align: center;">Chưa có sản phẩm nào.</td></tr>`;
                return;
            }

            products.forEach(p => {
                adminProductList.innerHTML += `
                    <tr>
                        <td><img src="${p.img}" class="img-preview" alt="img"></td>
                        <td>
                            <strong>${p.title}</strong><br>
                            <span style="color:red; font-weight:bold;">${formatCurrency(p.price)}</span>
                            <br><span style="font-size: 0.8rem; background: #eee; padding: 2px 5px; border-radius: 3px;">${p.category || 'thoi-trang'}</span>
                        </td>
                        <td>
                            <button class="btn-sm btn-edit" onclick="editProduct('${p.id}', '${p.title.replace(/'/g, "\\'")}', ${p.price}, '${p.img}', '${p.category || 'thoi-trang'}')">Sửa</button>
                            <button class="btn-sm btn-delete" onclick="deleteProduct('${p.id}')">Xóa</button>
                        </td>
                    </tr>
                `;
            });
        } catch (e) {
            adminProductList.innerHTML = `<tr><td colspan="3" style="text-align: center; color: red;">Lỗi tải dữ liệu. Bạn đã bật Backend chưa?</td></tr>`;
        }
    };

    // Xử lý nút Lưu (Add / Edit)
    btnSaveProd.addEventListener("click", async () => {
        const payload = {
            title: prodTitle.value,
            price: prodPrice.value,
            img: prodImg.value,
            category: prodCategory.value
        };

        if (!payload.title || !payload.price || !payload.img) {
            alert("Vui lòng nhập đủ thông tin!");
            return;
        }

        if (!adminPin) {
            adminPin = prompt("Vui lòng nhập mã PIN Admin để thực hiện sửa đổi:");
            if (!adminPin) return;
        }

        try {
            if (prodId.value) {
                // Edit
                const res = await fetch(`${API_URL}/${prodId.value}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "x-admin-pin": adminPin
                    },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error(await res.text());
                alert("Đã cập nhật thành công!");
            } else {
                // Add
                const res = await fetch(API_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-admin-pin": adminPin
                    },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error(await res.text());
                alert("Đã thêm sản phẩm mới!");
            }

            resetForm();
            loadProducts();
        } catch (e) {
            alert("Lỗi khi lưu: Sai mã PIN hoặc Server từ chối!");
            adminPin = ""; // Reset pin nếu nhập sai
        }
    });

    window.editProduct = (id, title, price, img, category) => {
        formTitle.innerText = "Sửa Sản Phẩm Lựa Chọn";
        prodId.value = id;
        prodTitle.value = title;
        prodPrice.value = price;
        prodImg.value = img;
        prodCategory.value = category;
        btnCancelEdit.style.display = "inline-block";
        window.scrollTo(0, 0); // cuộn lên đầu form
    };

    window.deleteProduct = async (id) => {
        if (confirm("Xóa là mất luôn nhé! Bạn có chắc không?")) {
            if (!adminPin) {
                adminPin = prompt("Vui lòng nhập mã PIN Admin để xác nhận xóa:");
                if (!adminPin) return;
            }
            try {
                const res = await fetch(`${API_URL}/${id}`, {
                    method: "DELETE",
                    headers: { "x-admin-pin": adminPin }
                });
                if (!res.ok) throw new Error("Thất bại");
                loadProducts();
            } catch (e) {
                alert("Lỗi không thể xóa sản phẩm! Có thể sai mã PIN.");
                adminPin = "";
            }
        }
    };

    btnCancelEdit.addEventListener("click", resetForm);

    function resetForm() {
        formTitle.innerText = "Thêm Sản Phẩm Mới";
        prodId.value = "";
        prodTitle.value = "";
        prodPrice.value = "";
        prodImg.value = "";
        prodCategory.value = "thoi-trang";
        btnCancelEdit.style.display = "none";
    }

    // Tab Switching
    const adminTabs = document.querySelectorAll(".admin-tab");
    const tabContents = document.querySelectorAll(".tab-content");
    adminTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            adminTabs.forEach(t => t.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));
            tab.classList.add("active");
            document.getElementById(tab.getAttribute("data-target")).classList.add("active");
            
            if(tab.getAttribute("data-target") === "ordersTab") {
                loadOrders();
            }
            if(tab.getAttribute("data-target") === "usersTab") {
                loadUsers();
            }
        });
    });

    // ORDER MANAGEMENT
    const adminOrdersList = document.getElementById("adminOrdersList");
    const orderSearchInput = document.getElementById("orderSearchInput");
    const orderStatusFilter = document.getElementById("orderStatusFilter");
    const editOrderModal = document.getElementById("editOrderModal");

    let allOrders = [];

    const renderOrdersList = () => {
        if (!allOrders || allOrders.length === 0) {
            adminOrdersList.innerHTML = `<tr><td colspan="6" style="text-align: center;">Chưa có đơn đặt hàng nào.</td></tr>`;
            return;
        }

        const searchText = (orderSearchInput.value || "").toLowerCase();
        const statusFilter = orderStatusFilter.value;

        const filtered = allOrders.filter(o => {
            const strItems = o.OrderItems.map(i => i.Product ? i.Product.title : "").join(" ");
            const aggregateStr = `${o.orderCode} ${o.shippingName} ${o.shippingPhone} ${o.shippingAddress} ${strItems} ${o.User ? o.User.username : ''}`.toLowerCase();
            
            if (searchText && !aggregateStr.includes(searchText)) return false;
            if (statusFilter && o.status !== statusFilter) return false;
            return true;
        });

        if (filtered.length === 0) {
            adminOrdersList.innerHTML = `<tr><td colspan="6" style="text-align: center;">Không tìm thấy đơn hàng phù hợp.</td></tr>`;
            return;
        }

        adminOrdersList.innerHTML = "";
        filtered.forEach(o => {
            const orderItemsStr = o.OrderItems.map(i => {
                const productName = i.Product ? i.Product.title : `SP ID: ${i.productId}`;
                return `- ${productName} (x${i.quantity})`;
            }).join("<br>");

            adminOrdersList.innerHTML += `
                <tr>
                    <td><strong>#${o.orderCode}</strong><br><span style="font-size:0.8rem">${o.User ? o.User.username : ''} (${o.shippingName})</span></td>
                    <td>${o.shippingAddress}<br><span style="font-size:0.8rem">SĐT: ${o.shippingPhone}</span></td>
                    <td style="font-size:0.85rem">${orderItemsStr}</td>
                    <td style="color:var(--secondary-color); font-weight:bold">${formatCurrency(o.totalAmount)}</td>
                    <td><span style="font-weight:bold; color: ${o.status==='PAID'?'green': (o.status==='CANCELLED'?'red':'orange')}">${o.status}</span></td>
                    <td align="center">
                        <button class="btn-sm btn-edit" onclick="openEditOrder('${o.orderCode}')">Sửa</button>
                    </td>
                </tr>
            `;
        });
    };

    if (orderSearchInput) orderSearchInput.addEventListener("input", renderOrdersList);
    if (orderStatusFilter) orderStatusFilter.addEventListener("change", renderOrdersList);

    const loadOrders = async () => {
        if (!adminPin) {
            adminPin = prompt("Vui lòng nhập mã PIN Admin (nếu chưa nhập):");
            if(!adminPin) return;
        }
        try {
            adminOrdersList.innerHTML = `<tr><td colspan="6" style="text-align: center;">Đang tải...</td></tr>`;
            const ORDER_API = isLocal ? "http://localhost:3000/api/admin/orders" : "/api/admin/orders";
            const res = await fetch(ORDER_API, {
                headers: { "x-admin-pin": adminPin }
            });
            const data = await res.json();
            if(!data.success) throw new Error(data.error);

            allOrders = data.orders;
            renderOrdersList();
        } catch(e) {
            adminOrdersList.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Lỗi tải Order: ${e.message}</td></tr>`;
            adminPin = "";
        }
    };

    window.openEditOrder = (orderCode) => {
        const order = allOrders.find(o => o.orderCode == orderCode);
        if(!order) return;
        document.getElementById("editOrderCodeTitle").innerText = `#${order.orderCode}`;
        document.getElementById("editOrderName").value = order.shippingName;
        document.getElementById("editOrderPhone").value = order.shippingPhone;
        document.getElementById("editOrderAddress").value = order.shippingAddress;
        document.getElementById("editOrderStatus").value = order.status;
        editOrderModal.dataset.orderCode = orderCode;
        editOrderModal.style.display = "flex";
    };

    const btnCancelEditOrder = document.getElementById("btnCancelEditOrder");
    if (btnCancelEditOrder) {
        btnCancelEditOrder.addEventListener("click", () => {
            editOrderModal.style.display = "none";
        });
    }

    const btnSaveEditOrder = document.getElementById("btnSaveEditOrder");
    if (btnSaveEditOrder) {
        btnSaveEditOrder.addEventListener("click", async () => {
            const orderCode = editOrderModal.dataset.orderCode;
            if (!orderCode) return;
            
            const payload = {
                shippingName: document.getElementById("editOrderName").value.trim(),
                shippingPhone: document.getElementById("editOrderPhone").value.trim(),
                shippingAddress: document.getElementById("editOrderAddress").value.trim(),
                status: document.getElementById("editOrderStatus").value
            };

            try {
                const ORDER_API = isLocal ? "http://localhost:3000/api/admin/orders" : "/api/admin/orders";
                const res = await fetch(`${ORDER_API}/${orderCode}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "x-admin-pin": adminPin
                    },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if(!data.success) throw new Error(data.message);
                
                alert("Đã cập nhật Đơn hàng thành công!");
                editOrderModal.style.display = "none";
                loadOrders(); // reload
            } catch (e) {
                alert("Lỗi khi lưu đơn hàng: " + e.message);
            }
        });
    }

    const btnRefreshOrders = document.getElementById("btnRefreshOrders");
    if(btnRefreshOrders) {
        btnRefreshOrders.addEventListener("click", loadOrders);
    }

    // ============================================
    // USERS MANAGEMENT
    // ============================================
    const adminUsersList = document.getElementById("adminUsersList");
    const userSearchInput = document.getElementById("userSearchInput");
    const editUserModal = document.getElementById("editUserModal");
    let allUsers = [];

    const renderUsersList = () => {
        if (!allUsers || allUsers.length === 0) {
            adminUsersList.innerHTML = `<tr><td colspan="6" style="text-align: center;">Chưa có tài khoản nào.</td></tr>`;
            return;
        }

        const searchText = (userSearchInput.value || "").toLowerCase();

        const filtered = allUsers.filter(u => {
            const aggregateStr = `${u.username} ${u.fullName || ''} ${u.phone || ''}`.toLowerCase();
            if (searchText && !aggregateStr.includes(searchText)) return false;
            return true;
        });

        if (filtered.length === 0) {
            adminUsersList.innerHTML = `<tr><td colspan="6" style="text-align: center;">Không tìm thấy tài khoản phù hợp.</td></tr>`;
            return;
        }

        adminUsersList.innerHTML = "";
        filtered.forEach(u => {
            adminUsersList.innerHTML += `
                <tr>
                    <td><strong>${u.username}</strong></td>
                    <td>${u.fullName || '-'}</td>
                    <td>${u.phone || '-'}</td>
                    <td><span style="background:#eee; padding:2px 5px; border-radius:3px; font-size:0.8rem;">${u.role}</span></td>
                    <td><span style="font-weight:bold; color: ${u.isActive ? 'green' : 'red'}">${u.isActive ? 'Hoạt động' : 'Đã khóa'}</span></td>
                    <td align="center">
                        <button class="btn-sm btn-edit" onclick="openEditUser('${u.id}')">Sửa</button>
                    </td>
                </tr>
            `;
        });
    };

    if (userSearchInput) userSearchInput.addEventListener("input", renderUsersList);

    const loadUsers = async () => {
        if (!adminPin) {
            adminPin = prompt("Vui lòng nhập mã PIN Admin:");
            if(!adminPin) return;
        }
        try {
            adminUsersList.innerHTML = `<tr><td colspan="6" style="text-align: center;">Đang tải...</td></tr>`;
            const USERS_API = isLocal ? "http://localhost:3000/api/admin/users" : "/api/admin/users";
            const res = await fetch(USERS_API, {
                headers: { "x-admin-pin": adminPin }
            });
            const data = await res.json();
            if(!data.success) throw new Error(data.error || data.message || "Lỗi tải User");

            allUsers = data.users;
            renderUsersList();
        } catch(e) {
            adminUsersList.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Lỗi tải Users: ${e.message}</td></tr>`;
            adminPin = "";
        }
    };

    const btnRefreshUsers = document.getElementById("btnRefreshUsers");
    if(btnRefreshUsers) btnRefreshUsers.addEventListener("click", loadUsers);

    window.openEditUser = (userId) => {
        const u = allUsers.find(x => x.id === userId);
        if(!u) return;
        
        document.getElementById("editUserModalTitle").innerText = "Sửa Khách Hàng";
        document.getElementById("editUserId").value = u.id;
        document.getElementById("editUserUsername").value = u.username;
        document.getElementById("editUserUsername").disabled = true; // Không cho sửa username
        document.getElementById("editUserPassword").value = "";
        document.getElementById("editUserFullName").value = u.fullName || "";
        document.getElementById("editUserPhone").value = u.phone || "";
        document.getElementById("editUserIsActive").value = u.isActive !== false ? "true" : "false";
        
        editUserModal.style.display = "flex";
    };

    const btnAddUser = document.getElementById("btnAddUser");
    if(btnAddUser) {
        btnAddUser.addEventListener("click", () => {
            document.getElementById("editUserModalTitle").innerText = "Thêm Khách Hàng Mới";
            document.getElementById("editUserId").value = "";
            document.getElementById("editUserUsername").value = "";
            document.getElementById("editUserUsername").disabled = false;
            document.getElementById("editUserPassword").value = "";
            document.getElementById("editUserFullName").value = "";
            document.getElementById("editUserPhone").value = "";
            document.getElementById("editUserIsActive").value = "true";
            
            editUserModal.style.display = "flex";
        });
    }

    const btnCancelEditUser = document.getElementById("btnCancelEditUser");
    if(btnCancelEditUser) {
        btnCancelEditUser.addEventListener("click", () => {
            editUserModal.style.display = "none";
        });
    }

    const btnSaveEditUser = document.getElementById("btnSaveEditUser");
    if(btnSaveEditUser) {
        btnSaveEditUser.addEventListener("click", async () => {
            const id = document.getElementById("editUserId").value;
            const username = document.getElementById("editUserUsername").value.trim();
            const password = document.getElementById("editUserPassword").value;
            const fullName = document.getElementById("editUserFullName").value.trim();
            const phone = document.getElementById("editUserPhone").value.trim();
            const isActive = document.getElementById("editUserIsActive").value === "true";

            if (!id && (!username || !password)) {
                alert("Khi tạo mới, Username và Password không được để trống!");
                return;
            }

            const payload = { username, fullName, phone, isActive };
            if (password) payload.password = password;

            try {
                const USERS_API = isLocal ? "http://localhost:3000/api/admin/users" : "/api/admin/users";
                let url = USERS_API;
                let method = "POST";
                if (id) {
                    url = `${USERS_API}/${id}`;
                    method = "PUT";
                }

                const res = await fetch(url, {
                    method: method,
                    headers: {
                        "Content-Type": "application/json",
                        "x-admin-pin": adminPin
                    },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if(!data.success) throw new Error(data.message || data.error);
                
                alert(id ? "Đã cập nhật User thành công!" : "Đã tạo User mới!");
                editUserModal.style.display = "none";
                loadUsers(); // reload danh sách
            } catch (e) {
                alert("Lỗi lưu lại thông tin tài khoản: " + e.message);
            }
        });
    }

    loadProducts();
});

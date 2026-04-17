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

    const API_URL = "http://localhost:3000/api/products";
    let adminPin = ""; // Biến lưu mã PIN tạm trên RAM

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    // Tải danh sách
    const loadProducts = async () => {
        try {
            const res = await fetch(API_URL);
            const products = await res.json();
            
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

        if(!payload.title || !payload.price || !payload.img) {
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
                if(!res.ok) throw new Error(await res.text());
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
                if(!res.ok) throw new Error(await res.text());
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
        if(confirm("Xóa là mất luôn nhé! Bạn có chắc không?")) {
            if (!adminPin) {
                adminPin = prompt("Vui lòng nhập mã PIN Admin để xác nhận xóa:");
                if (!adminPin) return;
            }
            try {
                const res = await fetch(`${API_URL}/${id}`, { 
                    method: "DELETE",
                    headers: { "x-admin-pin": adminPin }
                });
                if(!res.ok) throw new Error("Thất bại");
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

    loadProducts();
});

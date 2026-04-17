document.addEventListener("DOMContentLoaded", async () => {
    const productGrid = document.getElementById("productGrid");
    if (!productGrid) return;
    
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    try {
        const response = await fetch("http://localhost:3000/api/products");
        const products = await response.json();
        
        products.forEach(product => {
            const card = document.createElement("div");
            card.className = "product-card";
            card.setAttribute('data-category', product.category || 'thoi-trang');
            card.setAttribute('data-title', product.title.toLowerCase());
            
            card.innerHTML = `
                <img class="product-img">
                <div class="product-title"></div>
                <div class="product-price"></div>
                <button class="btn-add-cart">Thêm vào giỏ</button>
            `;
            // Chống XSS bằng textContent
            const imgEl = card.querySelector('.product-img');
            imgEl.src = product.img;
            imgEl.alt = product.title;
            
            card.querySelector('.product-title').textContent = product.title;
            card.querySelector('.product-price').textContent = formatCurrency(product.price);
            card.querySelector('.product-price').setAttribute('data-price', product.price);
            
            const addBtn = card.querySelector(".btn-add-cart");
            addBtn.addEventListener('click', () => {
                if (window.addToCartObject) {
                    window.addToCartObject({ 
                        img: product.img, 
                        title: product.title, 
                        price: product.price 
                    });
                }
            });
            
            productGrid.appendChild(card);
        });
        
        setupFilters();
        
    } catch (error) {
        console.error("Lỗi khi tải sản phẩm:", error);
        productGrid.innerHTML += `<p style="width: 100%; text-align: center; color: red;">Không thể tải sản phẩm từ máy chủ. (Lỗi kết nối)</p>`;
    }
    
    // Hàm thiết lập Filter
    function setupFilters() {
        const searchInput = document.getElementById("searchInput");
        const categoryTabs = document.getElementById("categoryTabs");
        const tabBtns = document.querySelectorAll(".tab-btn");
        let currentCategory = "all";
        let currentKeyword = "";

        // Hàm lọc chung
        const applyFilters = () => {
            const allCards = document.querySelectorAll("#productGrid .product-card:not(.special-card)");
            
            allCards.forEach(card => {
                const cardCat = card.getAttribute('data-category');
                const cardTitle = card.getAttribute('data-title');
                
                const matchCategory = currentCategory === 'all' || cardCat === currentCategory;
                const matchTitle = cardTitle.includes(currentKeyword);
                
                if (matchCategory && matchTitle) {
                    card.classList.remove("hidden");
                } else {
                    card.classList.add("hidden");
                }
            });
        };

        // Bắt sự kiện Gõ phím tìm kiếm
        if(searchInput) {
            searchInput.addEventListener("input", (e) => {
                currentKeyword = e.target.value.toLowerCase().trim();
                applyFilters();
            });
        }

        // Bắt sự kiện Click chuyển tab
        if(categoryTabs) {
            tabBtns.forEach(btn => {
                btn.addEventListener("click", () => {
                    // Cập nhật giao diện tab
                    tabBtns.forEach(b => b.classList.remove("active"));
                    btn.classList.add("active");
                    
                    // Cập nhật State
                    currentCategory = btn.getAttribute("data-category");
                    applyFilters();
                });
            });
        }
    }
});

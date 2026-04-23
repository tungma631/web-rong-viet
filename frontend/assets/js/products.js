document.addEventListener("DOMContentLoaded", () => {
    const productGrid = document.getElementById("productGrid");
    if (!productGrid) return;

    const loadingMore = document.getElementById("loadingMore");
    // Lưu lại nguyên bản thẻ DOM Node để không bị mất event listener
    const specialCardNode = productGrid.querySelector(".special-card");

    let currentPage = 1;
    let currentLimit = 8;
    let currentCategory = "all";
    let currentKeyword = "";
    let isFetching = false;
    let hasMoreData = true;

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const fetchProducts = async (page, isReset = false) => {
        if (isFetching || (!hasMoreData && !isReset)) return;
        isFetching = true;

        if (isReset) {
            currentPage = 1;
            hasMoreData = true;
            // Xóa rỗng danh sách
            productGrid.innerHTML = "";
            // Nắp lại nguyên bộ Node thẻ đặc biệt vào lại để không đứt sự kiện click
            if (specialCardNode) {
                productGrid.appendChild(specialCardNode);
            }
        }

        if (loadingMore) loadingMore.style.display = "block";

        try {
            const baseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
                ? "http://127.0.0.1:3000/api/products"
                : "/api/products";
            
            const url = new URL(baseUrl, window.location.origin);
            url.searchParams.append('page', page);
            url.searchParams.append('limit', currentLimit);
            if (currentCategory !== "all") url.searchParams.append('category', currentCategory);
            if (currentKeyword) url.searchParams.append('search', currentKeyword);

            const response = await fetch(url);
            const data = await response.json(); 
            
            let products = Array.isArray(data) ? data : (data.products || []);
            hasMoreData = data.hasMore !== undefined ? data.hasMore : false;

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
                            id: product.id,
                            img: product.img,
                            title: product.title,
                            price: product.price
                        });
                    }
                });

                productGrid.appendChild(card);
            });

            currentPage = page;

            // Nếu Backend trả về hết dữ liệu rồi thì giấu spinner đi
            if (!hasMoreData && loadingMore) {
                loadingMore.style.display = "none";
            }

        } catch (error) {
            console.error("Lỗi khi tải sản phẩm:", error);
            if (isReset) {
                productGrid.innerHTML += `<p style="width: 100%; text-align: center; color: red;">Không thể tải sản phẩm từ máy chủ. (Lỗi kết nối)</p>`;
            }
        } finally {
            isFetching = false;
            // Nếu dùng Intersection Observer, cứ ném trách nhiệm ẩn hiện cho hasMoreData.
        }
    };

    // Intersection Observer cho Infinite Scroll (Tải khi cuộn đến cuối danh sách)
    const handleObserver = (entries) => {
        const target = entries[0];
        // Nếu cái loadingMore trồi lên màn hình và còn dữ liệu thì gọi fetch trang tiếp theo
        if (target.isIntersecting && hasMoreData && !isFetching) {
            fetchProducts(currentPage + 1, false);
        }
    };

    const observer = new IntersectionObserver(handleObserver, {
        root: null,
        rootMargin: "0px",
        threshold: 0.1
    });

    if (loadingMore) {
        observer.observe(loadingMore);
    }

    // Các bộ lọc: Tìm kiếm & Tab danh mục
    const searchInput = document.getElementById("searchInput");
    const categoryTabs = document.getElementById("categoryTabs");
    const tabBtns = document.querySelectorAll(".tab-btn");

    let searchTimeout = null;
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            currentKeyword = e.target.value.trim();
            // Debounce: Chờ khách ngưng gõ 500ms mới gọi hàm tải tránh spam
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                fetchProducts(1, true); // Reset về trang 1
            }, 500);
        });
    }

    if (categoryTabs) {
        tabBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                // Update UI active class
                tabBtns.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                
                // Fetch với category mới
                currentCategory = btn.getAttribute("data-category");
                fetchProducts(1, true); // Reset về trang 1
            });
        });
    }

    // Lần tải đầu tiên
    fetchProducts(1, true);

    // Kích hoạt lại các sự kiện đặc biệt (như nút Thẻ tạo ảnh)
    // Vì reset innerHTML sẽ làm những nút cũ tĩnh mất listener nếu gán bằng querySelector trong main.js
    // Ở đây ta phó mặc sự kiện bắt theo document bên ai-avatar.js.
});

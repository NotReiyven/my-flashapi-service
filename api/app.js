const API_URL = window.location.origin;
let searchPage = 0;
const limit = 40;
let wishlist = JSON.parse(localStorage.getItem('steam_wishlist')) || [];
let isLoading = false;
let isSearchMode = false;
let autocompleteTimer = null;

window.generatePixelFallback = function(imgElement, encodedName) {
    imgElement.onerror = null; 
    const seedText = decodeURIComponent(encodedName);
    const canvas = document.createElement('canvas');
    canvas.width = 460; canvas.height = 215;
    const ctx = canvas.getContext('2d');
    
    let hash = 0;
    for (let i = 0; i < seedText.length; i++) hash = seedText.charCodeAt(i) + ((hash << 5) - hash);
    
    ctx.fillStyle = `#1b2838`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const fgColor = `#2a475e`;
    const fgColor2 = `#171a21`;
    
    const cols = 12, rows = 6;
    const blockW = Math.ceil(canvas.width / cols), blockH = Math.ceil(canvas.height / rows);
    
    for(let x = 0; x < cols; x++) {
        for(let y = 0; y < rows; y++) {
            let cellHash = Math.abs(Math.sin(hash + x * 13 + y * 27)) * 100;
            if (cellHash > 65) { ctx.fillStyle = fgColor; ctx.fillRect(x * blockW, y * blockH, blockW, blockH); } 
            else if (cellHash > 35) { ctx.fillStyle = fgColor2; ctx.fillRect(x * blockW, y * blockH, blockW, blockH); }
        }
    }
    imgElement.src = canvas.toDataURL();
};

const carouselQueue = [
    { title: "Featured & Recommended", params: "limit=100&sort_by=hidden_gem", strictFilter: true },
    { title: "New & Trending", params: "limit=20&sort_by=recent", strictFilter: false },
    { title: "Top Free To Play", params: "limit=20&free_only=true&sort_by=hidden_gem", strictFilter: false },
    { title: "Action Games", params: "limit=20&q=Action&sort_by=hidden_gem", strictFilter: false },
    { title: "Indie Games", params: "limit=20&q=Indie&sort_by=hidden_gem", strictFilter: false },
    { title: "Strategy Games", params: "limit=20&q=Strategy&sort_by=recent", strictFilter: false }
];
let currentCarouselIndex = 0;

window.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    let hasFilters = false;

    if (params.has('q')) { document.getElementById('searchInput').value = params.get('q'); hasFilters = true; }
    if (params.has('genre')) { document.getElementById('genreSelect').value = params.get('genre'); hasFilters = true; }
    if (params.has('price')) { document.getElementById('priceSelect').value = params.get('price'); hasFilters = true; }
    if (params.has('sort')) { document.getElementById('sortSelect').value = params.get('sort'); hasFilters = true; }
    if (params.has('dev')) { document.getElementById('devInput').value = params.get('dev'); hasFilters = true; }

    setupAutocomplete();

    if (params.has('wishlist') && params.get('wishlist') === 'true') {
        toggleWishlistView();
    } else if (hasFilters) {
        triggerSearch(true, false);
    } else {
        loadNextCarousel();
        loadNextCarousel();
        loadNextCarousel();
    }
});

function setupAutocomplete() {
    const input = document.getElementById('searchInput');
    const dropdown = document.getElementById('autocompleteDropdown');
    
    input.addEventListener('input', (e) => {
        clearTimeout(autocompleteTimer);
        const val = e.target.value.trim();
        
        if (val.length < 2) {
            dropdown.classList.add('hidden');
            return;
        }
        
        autocompleteTimer = setTimeout(async () => {
            try {
                const res = await fetch(`${API_URL}/api/games?q=${encodeURIComponent(val)}&limit=5&sort_by=hidden_gem`);
                const data = await res.json();
                
                if (data.results.length === 0) {
                    dropdown.innerHTML = `<div class="auto-item empty">No results found</div>`;
                } else {
                    dropdown.innerHTML = data.results.map(g => `
                        <div class="auto-item" onclick="openModal(${g.app_id}); document.getElementById('autocompleteDropdown').classList.add('hidden');">
                            <span class="auto-title">${g.name}</span>
                            <span class="auto-price ${g.price === 0 ? 'free' : ''}">${g.price === 0 ? 'Free' : '$'+g.price.toFixed(2)}</span>
                        </div>
                    `).join('');
                }
                dropdown.classList.remove('hidden');
            } catch (err) {}
        }, 250);
    });

    input.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            dropdown.classList.add('hidden');
            triggerSearch(true);
        }
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
}

function updateUrlState(isWishlist) {
    const params = new URLSearchParams();
    if (isWishlist) {
        params.set('wishlist', 'true');
    } else {
        const query = document.getElementById("searchInput").value.trim();
        const genre = document.getElementById("genreSelect").value;
        const dev = document.getElementById("devInput").value.trim();
        const sort = document.getElementById("sortSelect").value;
        const price = document.getElementById("priceSelect").value;

        if (query) params.set('q', query);
        if (genre) params.set('genre', genre);
        if (dev) params.set('dev', dev);
        if (sort !== 'recent') params.set('sort', sort);
        if (price) params.set('price', price);
    }

    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.pushState({}, '', newUrl);
}

function toggleFilters() { document.getElementById("advancedFilters").classList.toggle("hidden"); }

function goHome() {
    isSearchMode = false;
    document.getElementById("searchInput").value = "";
    document.getElementById("devInput").value = "";
    document.getElementById("genreSelect").value = "";
    document.getElementById("priceSelect").value = "";
    document.getElementById("sortSelect").value = "recent";
    
    document.getElementById("homeView").classList.remove("hidden");
    document.getElementById("searchView").classList.add("hidden");
    document.getElementById("advancedFilters").classList.add("hidden");
    document.getElementById('autocompleteDropdown').classList.add('hidden');
    
    window.history.pushState({}, '', window.location.pathname);
    
    if (currentCarouselIndex === 0) {
        loadNextCarousel(); loadNextCarousel(); loadNextCarousel();
    }
}

function applyCategoryFilter(genre) {
    document.getElementById("genreSelect").value = genre;
    triggerSearch(true);
}

function toggleWishlistView() {
    isSearchMode = true;
    document.getElementById("homeView").classList.add("hidden");
    document.getElementById("searchView").classList.remove("hidden");
    document.getElementById("searchTitle").innerText = "Your Saved Games";
    updateUrlState(true);
    
    const container = document.getElementById("gamesList");
    container.innerHTML = "";
    document.getElementById("backlogStats").classList.add("hidden");
    
    if (wishlist.length === 0) {
        container.innerHTML = "<p style='color: var(--text-muted); grid-column: 1/-1;'>Your wishlist is empty.</p>";
        document.getElementById("loadMoreGridBtn").classList.add("hidden");
        return;
    }
    
    fetchGridData(`${API_URL}/api/games?ids=${wishlist.join(',')}&limit=1000`, true, true);
}

function triggerSearch(reset = false, pushState = true) {
    isSearchMode = true;
    if (reset) {
        searchPage = 0;
        document.getElementById("gamesList").innerHTML = "";
    }
    
    document.getElementById("homeView").classList.add("hidden");
    document.getElementById("searchView").classList.remove("hidden");
    document.getElementById("backlogStats").classList.add("hidden");
    document.getElementById('autocompleteDropdown').classList.add('hidden');
    
    if (pushState) updateUrlState(false);
    
    const query = document.getElementById("searchInput").value.trim();
    const genre = document.getElementById("genreSelect").value;
    const dev = document.getElementById("devInput").value.trim();
    const sort = document.getElementById("sortSelect").value;
    const price = document.getElementById("priceSelect").value;
    
    let combinedQuery = query;
    if (genre) combinedQuery = combinedQuery ? `${combinedQuery},${genre}` : genre;
    
    let url = `${API_URL}/api/games?q=${encodeURIComponent(combinedQuery)}&developer=${encodeURIComponent(dev)}&sort_by=${sort}&skip=${searchPage * limit}&limit=${limit}`;
    if (price === 'free') url += '&free_only=true';
    
    document.getElementById("searchTitle").innerText = combinedQuery || dev ? "Search Results" : "All Games";
    fetchGridData(url, reset, false);
}

function loadMoreSearchResults() {
    searchPage++;
    triggerSearch(false, false);
}

async function fetchGridData(url, reset, isWishlistContext) {
    if (isLoading) return;
    isLoading = true;
    
    const container = document.getElementById("gamesList");
    const loadBtn = document.getElementById("loadMoreGridBtn");
    loadBtn.classList.add("hidden");
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed");
        let data = await response.json();
        
        const priceFilter = document.getElementById("priceSelect").value;
        if (!isWishlistContext) {
            if (priceFilter === 'under10') data.results = data.results.filter(g => g.price > 0 && g.price < 10);
            if (priceFilter === 'under30') data.results = data.results.filter(g => g.price > 0 && g.price < 30);
        }
        
        if (reset && data.results.length === 0) {
            container.innerHTML = "<p style='color: var(--text-muted); grid-column: 1/-1;'>No games matched your criteria.</p>";
        } else {
            if (isWishlistContext && reset && data.results.length > 0) {
                let totalVal = 0;
                let genres = {};
                data.results.forEach(g => {
                    totalVal += g.price;
                    if(g.genres) {
                        g.genres.split(',').forEach(gen => {
                            let clean = gen.trim();
                            if(clean && clean !== 'nan') genres[clean] = (genres[clean] || 0) + 1;
                        });
                    }
                });
                let topGenre = Object.keys(genres).length > 0 ? Object.entries(genres).sort((a,b)=>b[1]-a[1])[0][0] : 'Mixed';
                
                const statsBanner = document.getElementById("backlogStats");
                statsBanner.innerHTML = `
                    <div class="b-stat"><span>Games Saved</span><strong>${data.results.length}</strong></div>
                    <div class="b-stat"><span>Total Value</span><strong>$${totalVal.toFixed(2)}</strong></div>
                    <div class="b-stat"><span>Top Genre</span><strong>${topGenre}</strong></div>
                `;
                statsBanner.classList.remove("hidden");
            }

            renderGridCards(data.results, container);
            if (data.results.length === limit && !isWishlistContext) loadBtn.classList.remove("hidden");
        }
    } catch (e) {
        if (reset) container.innerHTML = "<p style='color: #da373c;'>Error loading results.</p>";
    }
    isLoading = false;
}

function renderGridCards(games, container) {
    games.forEach(game => {
        const card = document.createElement("div");
        card.className = "card";
        const bannerUrl = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.app_id}/header.jpg`;
        const encodedName = encodeURIComponent(game.name || 'Unknown');
        const isWished = wishlist.includes(game.app_id);
        const tagsHtml = (game.genres || '').split(',').slice(0, 3).map(t => `<span class="tag">${t.trim()}</span>`).join('');
        
        card.innerHTML = `
            <div class="card-img-wrapper" onclick="openModal(${game.app_id})">
                <img src="${bannerUrl}" onerror="generatePixelFallback(this, '${encodedName}')" loading="lazy">
                <button class="wishlist-btn ${isWished ? 'active' : ''}" onclick="toggleWishlist(${game.app_id}, this, event)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="${isWished ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </button>
            </div>
            <div class="card-content">
                <h3 onclick="openModal(${game.app_id})">${game.name}</h3>
                <div class="dev-name">${game.developer || 'Unknown'}</div>
                <div class="tags">${tagsHtml}</div>
                <div class="card-footer">
                    <span class="rating">▲ ${game.positive_ratings}</span>
                    <span class="price">${game.price === 0 ? 'Free' : '$' + game.price.toFixed(2)}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

async function loadNextCarousel() {
    if (currentCarouselIndex >= carouselQueue.length) {
        document.getElementById("loadMoreCarouselsBtn").classList.add("hidden");
        return;
    }
    
    const config = carouselQueue[currentCarouselIndex];
    currentCarouselIndex++;
    
    const container = document.getElementById("carouselsContainer");
    const sectionId = `carousel-sec-${currentCarouselIndex}`;
    
    container.innerHTML += `
        <section class="carousel-section" id="${sectionId}">
            <div class="section-header"><h2>${config.title}</h2></div>
            <div class="carousel-wrapper">
                <button class="scroll-btn left" onclick="scrollCarousel('${sectionId}-track', -1)">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <div class="carousel-track" id="${sectionId}-track">
                    <div class="skeleton-card" style="min-width:320px;"></div>
                    <div class="skeleton-card" style="min-width:320px;"></div>
                    <div class="skeleton-card" style="min-width:320px;"></div>
                </div>
                <button class="scroll-btn right" onclick="scrollCarousel('${sectionId}-track', 1)">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
            </div>
        </section>
    `;
    
    try {
        const res = await fetch(`${API_URL}/api/games?${config.params}`);
        if (!res.ok) throw new Error("Fetch failed");
        let data = await res.json();
        
        if (config.strictFilter) {
            data.results = data.results.filter(g => g.positive_ratings > 100);
            data.results = data.results.sort(() => 0.5 - Math.random()).slice(0, 10);
        }
        renderCarouselTrack(`${sectionId}-track`, data.results);
    } catch(e) {
        document.getElementById(`${sectionId}-track`).innerHTML = "<p style='color:var(--text-muted);'>Failed to load data.</p>";
    }
}

function renderCarouselTrack(trackId, games) {
    const track = document.getElementById(trackId);
    track.innerHTML = "";
    
    games.forEach(game => {
        const card = document.createElement("div");
        card.className = "carousel-card";
        const bannerUrl = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.app_id}/header.jpg`;
        const encodedName = encodeURIComponent(game.name || 'Unknown');
        const isWished = wishlist.includes(game.app_id);
        
        card.innerHTML = `
            <img src="${bannerUrl}" onerror="generatePixelFallback(this, '${encodedName}')" onclick="openModal(${game.app_id})">
            <div class="carousel-bottom-gradient">
                <span class="c-title">${game.name}</span>
                <span class="c-price">${game.price === 0 ? 'Free' : '$' + game.price.toFixed(2)}</span>
            </div>
            <button class="wishlist-btn ${isWished ? 'active' : ''}" onclick="toggleWishlist(${game.app_id}, this, event)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="${isWished ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </button>
        `;
        track.appendChild(card);
    });
}

function scrollCarousel(trackId, direction) {
    const track = document.getElementById(trackId);
    track.scrollBy({ left: direction * 336, behavior: 'smooth' }); 
}

function toggleWishlist(appId, btnElement, event) {
    event.stopPropagation();
    const index = wishlist.indexOf(appId);
    if (index > -1) wishlist.splice(index, 1);
    else wishlist.push(appId);
    
    localStorage.setItem('steam_wishlist', JSON.stringify(wishlist));
    
    const svg = btnElement.querySelector('svg');
    if (index > -1) {
        btnElement.classList.remove('active');
        svg.setAttribute('fill', 'none');
    } else {
        btnElement.classList.add('active');
        svg.setAttribute('fill', 'currentColor');
    }
}

async function openModal(appId) {
    const modal = document.getElementById("gameModal");
    const modalBody = document.getElementById("modalBody");
    modalBody.innerHTML = `
        <button class="close-btn" onclick="closeModal()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div class="skeleton-card" style="border:none; height:400px; background: transparent;"></div>
    `;
    modal.classList.remove("hidden");
    
    try {
        const response = await fetch(`${API_URL}/api/games/${appId}`);
        if (!response.ok) throw new Error("Game not found");
        const game = await response.json();
        
        const bannerUrl = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.app_id}/header.jpg`;
        const encodedName = encodeURIComponent(game.name || 'Unknown');
        const allTags = (game.genres || '').split(',').map(tag => `<span class="tag">${tag.trim()}</span>`).join('');
        const steamLink = `https://store.steampowered.com/app/${game.app_id}/`;
        
        modalBody.innerHTML = `
            <button class="close-btn" onclick="closeModal()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <div class="modal-header-img" style="background-image: url('${bannerUrl}');">
                <img src="${bannerUrl}" onerror="generatePixelFallback(this, '${encodedName}')" style="display:none;" onload="this.previousElementSibling.style.backgroundImage = 'url('+this.src+')'">
            </div>
            
            <div class="modal-inner-content">
                <h2 class="modal-title">${game.name}</h2>
                
                <div class="modal-meta-grid">
                    <div class="meta-col">
                        <div class="meta-row"><span class="meta-label">Recent Reviews:</span> <span class="rating">${game.positive_ratings} Positive</span></div>
                        <div class="meta-row"><span class="meta-label">Release Date:</span> <span class="meta-value">${game.release_date || 'Unknown'}</span></div>
                        <div class="meta-row"><span class="meta-label">Developer:</span> <span class="meta-link" onclick="closeModal(); document.getElementById('devInput').value='${game.developer}'; triggerSearch(true);">${game.developer}</span></div>
                        <div class="meta-row"><span class="meta-label">Publisher:</span> <span class="meta-link">${game.publisher}</span></div>
                    </div>
                    <div class="meta-col tags-col">
                        <span class="meta-label">Popular user-defined tags for this product:</span>
                        <div class="tags">${allTags}</div>
                    </div>
                </div>

                <div class="modal-purchase-block">
                    <div class="purchase-info">
                        <span class="p-title">Play ${game.name}</span>
                    </div>
                    <div class="purchase-action">
                        <span class="p-price">${game.price === 0 ? 'Free to Play' : '$' + game.price.toFixed(2)}</span>
                        <a href="${steamLink}" target="_blank" class="steam-cta-btn">Play Game</a>
                    </div>
                </div>
            </div>
        `;
    } catch (err) { modalBody.innerHTML = `<button class="close-btn" onclick="closeModal()"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button><p class="error">Error loading game details.</p>`; }
}

function closeModal() { document.getElementById("gameModal").classList.add("hidden"); }
document.getElementById("gameModal").addEventListener("click", (e) => { if (e.target.id === "gameModal") closeModal(); });
/**
 * RecipeRaptor - Static Web Application Engine
 * High-performance, zero-dependency, client-side cooking dashboard
 */

(function () {
  "use strict";

  // --- State ---
  const state = {
    recipes: window.RECIPES_DATA || [],
    searchQuery: "",
    selectedProtein: "All",
    selectedCategory: "All",
    selectedIngredients: new Set(),
    ingredientMatchMode: "any", // 'any' or 'all'
    activeTag: null,
    sortBy: "default",
    favorites: new Set(JSON.parse(localStorage.getItem("reciperaptor_favorites") || "[]")),
    groceryList: JSON.parse(localStorage.getItem("reciperaptor_grocery") || "[]"),
    theme: localStorage.getItem("reciperaptor_theme") || "dark",
    currentModalRecipe: null,
    modalServings: 2,
    baseServings: 2,
    cookModeStepProgress: new Set(),
    timerInterval: null,
    timerSecondsLeft: 0,
    timerTotalSeconds: 0,
    wakeLock: null
  };

  // --- DOM Elements ---
  const el = {
    themeToggle: document.getElementById("themeToggle"),
    searchInput: document.getElementById("searchInput"),
    searchClearBtn: document.getElementById("searchClearBtn"),
    proteinPillsRow: document.getElementById("proteinPillsRow"),
    categoryPillsRow: document.getElementById("categoryPillsRow"),
    ingredientSearchInput: document.getElementById("ingredientSearchInput"),
    addIngredientBtn: document.getElementById("addIngredientBtn"),
    ingredientChipsList: document.getElementById("ingredientChipsList"),
    clearIngredientsBtn: document.getElementById("clearIngredientsBtn"),
    ingMatchModeSelect: document.getElementById("ingMatchModeSelect"),
    quickFiltersRow: document.getElementById("quickFiltersRow"),
    sortSelect: document.getElementById("sortSelect"),
    recipesGrid: document.getElementById("recipesGrid"),
    resultsCount: document.getElementById("resultsCount"),
    favCountBadge: document.getElementById("favCountBadge"),
    groceryCountBadge: document.getElementById("groceryCountBadge"),
    rouletteBtn: document.getElementById("rouletteBtn"),
    groceryBtn: document.getElementById("groceryBtn"),
    addRecipeBtn: document.getElementById("addRecipeBtn"),

    // Modals
    recipeModalBackdrop: document.getElementById("recipeModalBackdrop"),
    modalCloseBtn: document.getElementById("modalCloseBtn"),
    modalContent: document.getElementById("modalContent"),

    // Roulette Modal
    rouletteBackdrop: document.getElementById("rouletteBackdrop"),
    rouletteCloseBtn: document.getElementById("rouletteCloseBtn"),
    rouletteSpinBtn: document.getElementById("rouletteSpinBtn"),
    rouletteOpenRecipeBtn: document.getElementById("rouletteOpenRecipeBtn"),
    rouletteFilterSelect: document.getElementById("rouletteFilterSelect"),
    rouletteSlot: document.getElementById("rouletteSlot"),

    // Cook Mode
    cookModeOverlay: document.getElementById("cookModeOverlay"),
    cookModeCloseBtn: document.getElementById("cookModeCloseBtn"),
    cookModeTitle: document.getElementById("cookModeTitle"),
    cookModeStepsContainer: document.getElementById("cookModeStepsContainer"),
    cookTimerDisplay: document.getElementById("cookTimerDisplay"),
    timerStartBtn: document.getElementById("timerStartBtn"),
    timerResetBtn: document.getElementById("timerResetBtn"),
    timerPresetBtns: document.querySelectorAll(".timer-preset-btn"),

    // Grocery Drawer
    groceryDrawer: document.getElementById("groceryDrawer"),
    groceryDrawerCloseBtn: document.getElementById("groceryDrawerCloseBtn"),
    groceryListContainer: document.getElementById("groceryListContainer"),
    copyGroceryBtn: document.getElementById("copyGroceryBtn"),
    clearGroceryBtn: document.getElementById("clearGroceryBtn"),

    // Add Recipe Modal
    addRecipeBackdrop: document.getElementById("addRecipeBackdrop"),
    addRecipeCloseBtn: document.getElementById("addRecipeCloseBtn"),
    addRecipeForm: document.getElementById("addRecipeForm"),
    copyRecipeJsonBtn: document.getElementById("copyRecipeJsonBtn"),
    recipeJsonOutput: document.getElementById("recipeJsonOutput"),

    // Toast Container
    toastContainer: document.getElementById("toastContainer")
  };

  // --- Sound Effects using Web Audio API (No external sound files required) ---
  const AudioEngine = {
    ctx: null,
    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
    },
    beep(freq = 440, duration = 0.1, type = "sine") {
      try {
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {
        // audio muted or restricted
      }
    },
    chime() {
      this.beep(523.25, 0.15, "triangle"); // C5
      setTimeout(() => this.beep(659.25, 0.15, "triangle"), 120); // E5
      setTimeout(() => this.beep(783.99, 0.25, "triangle"), 240); // G5
    },
    alertChime() {
      this.beep(880, 0.2, "square");
      setTimeout(() => this.beep(880, 0.2, "square"), 250);
      setTimeout(() => this.beep(880, 0.4, "square"), 500);
    }
  };

  // --- Toast Notification ---
  function showToast(msg, icon = "🦖") {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(msg)}</span>`;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // --- Helper: Escape HTML ---
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // --- Theme Management ---
  function initTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    updateThemeIcon();
  }

  function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem("reciperaptor_theme", state.theme);
    document.documentElement.setAttribute("data-theme", state.theme);
    updateThemeIcon();
    showToast(`Switched to ${state.theme} mode`, state.theme === "dark" ? "🌙" : "☀️");
  }

  function updateThemeIcon() {
    el.themeToggle.innerHTML = state.theme === "dark"
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }

  // --- Quick Common Ingredients List ---
  const COMMON_INGREDIENTS = [
    "chicken", "rice", "garlic", "onion", "soy sauce", "spinach", 
    "tofu", "salmon", "turkey", "eggs", "cheese", "tomato", 
    "potato", "pasta", "zucchini", "broccoli", "lemon", "avocado", 
    "mushrooms", "bell pepper", "beans", "bread", "pork"
  ];

  // --- Render Filter Bars ---
  function renderFilterBars() {
    // 1. Proteins
    const proteinCounts = { All: state.recipes.length };
    state.recipes.forEach(r => {
      const p = r.protein || "Vegetarian";
      proteinCounts[p] = (proteinCounts[p] || 0) + 1;
    });

    const proteinIcons = {
      "All": "🦖",
      "Chicken": "🍗",
      "Fish & Seafood": "🐟",
      "Beef": "🥩",
      "Pork": "🥓",
      "Turkey": "🦃",
      "Lamb": "🐑",
      "Tofu & Plant-Based": "🌱",
      "Eggs": "🍳",
      "Vegetarian": "🥗"
    };

    el.proteinPillsRow.innerHTML = Object.keys(proteinCounts).map(prot => {
      const count = proteinCounts[prot];
      const icon = proteinIcons[prot] || "🍽️";
      const activeClass = state.selectedProtein === prot ? "active" : "";
      return `<button class="pill-chip ${activeClass}" data-protein="${escapeHtml(prot)}">
        <span>${icon}</span>
        <span>${escapeHtml(prot)}</span>
        <span class="pill-count">(${count})</span>
      </button>`;
    }).join("");

    // 2. Categories
    const categoryCounts = { All: state.recipes.length };
    state.recipes.forEach(r => {
      const c = r.category || "Mains & Grills";
      categoryCounts[c] = (categoryCounts[c] || 0) + 1;
    });

    el.categoryPillsRow.innerHTML = Object.keys(categoryCounts).map(cat => {
      const count = categoryCounts[cat];
      const activeClass = state.selectedCategory === cat ? "active" : "";
      return `<button class="pill-chip ${activeClass}" data-category="${escapeHtml(cat)}">
        <span>${escapeHtml(cat)}</span>
        <span class="pill-count">(${count})</span>
      </button>`;
    }).join("");

    // 3. Quick Ingredients Chips
    renderIngredientChips();

    // 4. Badges
    updateHeaderBadges();
  }

  function renderIngredientChips() {
    el.ingredientChipsList.innerHTML = COMMON_INGREDIENTS.map(ing => {
      const isSelected = state.selectedIngredients.has(ing.toLowerCase());
      return `<button class="ing-chip ${isSelected ? 'selected' : ''}" data-ing="${escapeHtml(ing)}">
        ${isSelected ? '✓ ' : '+ '}${escapeHtml(ing)}
      </button>`;
    }).join("");
  }

  function updateHeaderBadges() {
    el.favCountBadge.textContent = state.favorites.size;
    el.groceryCountBadge.textContent = state.groceryList.length;
  }

  // --- Filtering & Sorting Core Engine ---
  function getFilteredRecipes() {
    const query = state.searchQuery.toLowerCase().trim();
    const queryTerms = query ? query.split(/\s+/).filter(Boolean) : [];

    return state.recipes.filter(recipe => {
      // 1. Protein filter
      if (state.selectedProtein !== "All" && recipe.protein !== state.selectedProtein) {
        return false;
      }

      // 2. Category filter
      if (state.selectedCategory !== "All" && recipe.category !== state.selectedCategory) {
        return false;
      }

      // 3. Quick Tag / Preset filter
      if (state.activeTag) {
        if (state.activeTag === "favorites") {
          if (!state.favorites.has(recipe.id)) return false;
        } else if (state.activeTag === "high-protein") {
          if ((recipe.macros?.protein_g || 0) < 35) return false;
        } else if (state.activeTag === "quick") {
          const totalMin = parseInt(recipe.totalTime) || 30;
          if (totalMin > 25) return false;
        } else if (state.activeTag === "low-cal") {
          if ((recipe.calories || 0) > 400) return false;
        } else if (state.activeTag === "succinct") {
          if (!recipe.succinct) return false;
        }
      }

      // 4. Ingredient Picker Filter
      if (state.selectedIngredients.size > 0) {
        const recipeIngs = (recipe.ingredientKeywords || []).map(k => k.toLowerCase());
        const recipeRawIngs = (recipe.ingredients || []).join(" ").toLowerCase();

        const matchCount = Array.from(state.selectedIngredients).filter(ing => {
          return recipeIngs.includes(ing) || recipeRawIngs.includes(ing);
        }).length;

        if (state.ingredientMatchMode === "all") {
          if (matchCount < state.selectedIngredients.size) return false;
        } else {
          // 'any' mode: must match at least one selected ingredient
          if (matchCount === 0) return false;
        }
      }

      // 5. Keyword search query across all details
      if (queryTerms.length > 0) {
        const titleStr = (recipe.title || "").toLowerCase();
        const ingStr = (recipe.ingredients || []).join(" ").toLowerCase();
        const instStr = (recipe.instructions || []).join(" ").toLowerCase();
        const tagsStr = (recipe.tags || []).join(" ").toLowerCase();
        const notesStr = (recipe.notes || "").toLowerCase();
        const combined = `${titleStr} ${ingStr} ${instStr} ${tagsStr} ${notesStr} ${recipe.category} ${recipe.protein}`.toLowerCase();

        const matchesAll = queryTerms.every(term => combined.includes(term));
        if (!matchesAll) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sorting
      if (state.sortBy === "title-asc") {
        return a.title.localeCompare(b.title);
      } else if (state.sortBy === "protein-desc") {
        return (b.macros?.protein_g || 0) - (a.macros?.protein_g || 0);
      } else if (state.sortBy === "calories-asc") {
        return (a.calories || 0) - (b.calories || 0);
      } else if (state.sortBy === "time-asc") {
        const tA = parseInt(a.totalTime) || 30;
        const tB = parseInt(b.totalTime) || 30;
        return tA - tB;
      }
      return 0; // Default
    });
  }

  // --- Render Recipe Cards Grid ---
  function renderRecipes() {
    const list = getFilteredRecipes();
    el.resultsCount.innerHTML = `Showing <strong>${list.length}</strong> of ${state.recipes.length} recipes`;

    if (list.length === 0) {
      el.recipesGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🦖🔍</div>
          <h3>No Recipes Found</h3>
          <p>No culinary matches found for your current filters or ingredients. Try broadening your search or resetting filters!</p>
          <button class="btn btn-primary" id="resetFiltersBtn">Reset All Filters</button>
        </div>
      `;
      document.getElementById("resetFiltersBtn")?.addEventListener("click", resetAllFilters);
      return;
    }

    el.recipesGrid.innerHTML = list.map(recipe => {
      const isFav = state.favorites.has(recipe.id);
      const prot = recipe.macros?.protein_g || 0;
      const carbs = recipe.macros?.carbs_g || 0;
      const fat = recipe.macros?.fat_g || 0;
      const totalMacroGrams = (prot + carbs + fat) || 1;
      const pPct = Math.round((prot / totalMacroGrams) * 100);
      const cPct = Math.round((carbs / totalMacroGrams) * 100);
      const fPct = Math.round((fat / totalMacroGrams) * 100);

      // Ingredient match badge if active
      let matchBadgeHtml = "";
      if (state.selectedIngredients.size > 0) {
        const recipeIngs = (recipe.ingredientKeywords || []).map(k => k.toLowerCase());
        const recipeRawIngs = (recipe.ingredients || []).join(" ").toLowerCase();
        const matches = Array.from(state.selectedIngredients).filter(ing => {
          return recipeIngs.includes(ing) || recipeRawIngs.includes(ing);
        }).length;
        if (matches > 0) {
          matchBadgeHtml = `<span class="badge badge-match">✨ ${matches}/${state.selectedIngredients.size} Match</span>`;
        }
      }

      // Short preview text
      let previewText = "";
      if (recipe.ingredients && recipe.ingredients.length > 0) {
        previewText = recipe.ingredients.slice(0, 4).join(", ");
      } else if (recipe.instructions && recipe.instructions.length > 0) {
        previewText = recipe.instructions[0];
      }

      return `
        <div class="recipe-card" data-id="${escapeHtml(recipe.id)}">
          <div>
            <div class="card-top">
              <div class="card-badges">
                <span class="badge badge-protein">${escapeHtml(recipe.protein || 'Meal')}</span>
                <span class="badge badge-category">${escapeHtml(recipe.category || 'Mains')}</span>
                ${recipe.succinct ? '<span class="badge badge-succinct">⚡ Quick Note</span>' : ''}
                ${matchBadgeHtml}
              </div>
              <button class="favorite-btn ${isFav ? 'favorited' : ''}" data-fav-id="${escapeHtml(recipe.id)}" title="Favorite recipe">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>
            </div>

            <h3 class="recipe-title">${escapeHtml(recipe.title)}</h3>
            <p class="recipe-quick-desc">${escapeHtml(previewText)}</p>

            <div class="card-nutrition">
              <div class="nutrition-headline">
                <div>
                  <span class="calories-val">${recipe.calories || 0}</span>
                  <span class="calories-label">kcal</span>
                </div>
                <div class="protein-efficiency">
                  ${Math.round(((prot * 4) / (recipe.calories || 400)) * 100)}% cal from protein
                </div>
              </div>
              <div class="macro-bar">
                <div class="macro-bar-segment macro-bar-protein" style="width: ${pPct}%" title="Protein ${prot}g (${pPct}%)"></div>
                <div class="macro-bar-segment macro-bar-carbs" style="width: ${cPct}%" title="Carbs ${carbs}g (${cPct}%)"></div>
                <div class="macro-bar-segment macro-bar-fat" style="width: ${fPct}%" title="Fat ${fat}g (${fPct}%)"></div>
              </div>
              <div class="macros-legend">
                <div class="macro-stat-item">
                  <div class="macro-dot macro-dot-protein"></div>
                  <span><strong>${prot}g</strong> P</span>
                </div>
                <div class="macro-stat-item">
                  <div class="macro-dot macro-dot-carbs"></div>
                  <span><strong>${carbs}g</strong> C</span>
                </div>
                <div class="macro-stat-item">
                  <div class="macro-dot macro-dot-fat"></div>
                  <span><strong>${fat}g</strong> F</span>
                </div>
              </div>
            </div>
          </div>

          <div class="card-footer">
            <div class="meta-time">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>${escapeHtml(recipe.totalTime || '25 mins')}</span>
            </div>
            <div class="card-actions">
              <button class="btn-card-action open-detail-btn" data-id="${escapeHtml(recipe.id)}">Details</button>
              <button class="btn-card-action quick-cook-btn" data-id="${escapeHtml(recipe.id)}" title="Cook Mode">👨‍🍳 Cook</button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  // --- Dynamic Serving Scaler ---
  function scaleIngredient(text, scaleFactor) {
    if (scaleFactor === 1) return text;
    // Replace leading numbers / fractions: e.g. "4 zuchinis" -> "8 zuchinis", "1/2 cup" -> "1 cup"
    return text.replace(/^(\d+(?:\.\d+)?|\d+\/\d+)/, (match) => {
      let val = 1;
      if (match.includes("/")) {
        const parts = match.split("/");
        val = parseFloat(parts[0]) / parseFloat(parts[1]);
      } else {
        val = parseFloat(match);
      }
      const scaled = val * scaleFactor;
      if (Number.isInteger(scaled)) return String(scaled);
      return scaled.toFixed(1).replace(/\.0$/, "");
    });
  }

  // --- Recipe Detail Modal ---
  function openRecipeModal(recipeId) {
    const recipe = state.recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    state.currentModalRecipe = recipe;
    state.baseServings = recipe.servings || 2;
    state.modalServings = state.baseServings;

    renderModalContent();
    el.recipeModalBackdrop.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeRecipeModal() {
    el.recipeModalBackdrop.classList.remove("open");
    document.body.style.overflow = "";
    state.currentModalRecipe = null;
  }

  function renderModalContent() {
    const recipe = state.currentModalRecipe;
    if (!recipe) return;

    const scaleFactor = state.modalServings / (state.baseServings || 2);
    const scaledCalories = Math.round(recipe.calories * scaleFactor);
    const scaledProtein = Math.round((recipe.macros?.protein_g || 0) * scaleFactor);
    const scaledCarbs = Math.round((recipe.macros?.carbs_g || 0) * scaleFactor);
    const scaledFat = Math.round((recipe.macros?.fat_g || 0) * scaleFactor);

    const isFav = state.favorites.has(recipe.id);

    el.modalContent.innerHTML = `
      <div class="modal-header">
        <div class="modal-header-info">
          <div class="card-badges">
            <span class="badge badge-protein">${escapeHtml(recipe.protein)}</span>
            <span class="badge badge-category">${escapeHtml(recipe.category)}</span>
            ${recipe.succinct ? '<span class="badge badge-succinct">⚡ Quick-Fire Recipe Note</span>' : ''}
          </div>
          <h2 class="modal-title">${escapeHtml(recipe.title)}</h2>
        </div>
        <button class="modal-close-btn" id="modalCloseInnerBtn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="modal-body">
        <!-- Servings Scaler & Macro Strip -->
        <div class="recipe-summary-strip">
          <div class="summary-item">
            <span class="summary-item-label">Servings</span>
            <div class="scaler-control">
              <button class="scaler-btn" id="scalerMinusBtn">−</button>
              <span class="scaler-val" id="scalerVal">${state.modalServings}</span>
              <button class="scaler-btn" id="scalerPlusBtn">+</button>
            </div>
          </div>
          <div class="summary-item">
            <span class="summary-item-label">Total Time</span>
            <span class="summary-item-val">${escapeHtml(recipe.totalTime || '25 mins')}</span>
          </div>
          <div class="summary-item">
            <span class="summary-item-label">Calories</span>
            <span class="summary-item-val" style="color: var(--raptor-green)">${scaledCalories} kcal</span>
          </div>
          <div class="summary-item">
            <span class="summary-item-label">Protein</span>
            <span class="summary-item-val" style="color: var(--macro-protein)">${scaledProtein}g</span>
          </div>
          <div class="summary-item">
            <span class="summary-item-label">Carbs</span>
            <span class="summary-item-val" style="color: var(--macro-carbs)">${scaledCarbs}g</span>
          </div>
          <div class="summary-item">
            <span class="summary-item-label">Fat</span>
            <span class="summary-item-val" style="color: var(--macro-fat)">${scaledFat}g</span>
          </div>
        </div>

        <!-- Micronutrient Grid -->
        <div class="micros-grid-section">
          <div class="section-subhead">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            <span>Micronutrient Profile (Estimated per serving)</span>
          </div>
          <div class="micros-grid">
            <div class="micro-item">
              <div class="micro-val">${(recipe.micros?.fiber_g * scaleFactor).toFixed(1)}g</div>
              <div class="micro-label">Dietary Fiber</div>
            </div>
            <div class="micro-item">
              <div class="micro-val">${Math.round(recipe.micros?.sodium_mg * scaleFactor)}mg</div>
              <div class="micro-label">Sodium</div>
            </div>
            <div class="micro-item">
              <div class="micro-val">${(recipe.micros?.iron_mg * scaleFactor).toFixed(1)}mg</div>
              <div class="micro-label">Iron</div>
            </div>
            <div class="micro-item">
              <div class="micro-val">${Math.round(recipe.micros?.potassium_mg * scaleFactor)}mg</div>
              <div class="micro-label">Potassium</div>
            </div>
            <div class="micro-item">
              <div class="micro-val">${Math.round(recipe.micros?.vitamin_c_mg * scaleFactor)}mg</div>
              <div class="micro-label">Vitamin C</div>
            </div>
            <div class="micro-item">
              <div class="micro-val">${Math.round(recipe.micros?.calcium_mg * scaleFactor)}mg</div>
              <div class="micro-label">Calcium</div>
            </div>
          </div>
        </div>

        <!-- Recipe Details Grid -->
        <div class="recipe-details-grid">
          <div class="ingredients-panel">
            <div class="panel-header">
              <h3 class="panel-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3v18M15 3v18M4 9h16M4 15h16"/></svg>
                <span>Ingredients</span>
              </h3>
              <button class="btn btn-card-action" id="modalAddGroceryBtn">🛒 + Grocery</button>
            </div>
            <ul class="ingredients-list">
              ${(recipe.ingredients || []).map(ing => `
                <li class="ingredient-row">
                  <span class="ingredient-bullet">•</span>
                  <span>${escapeHtml(scaleIngredient(ing, scaleFactor))}</span>
                </li>
              `).join("")}
            </ul>
          </div>

          <div class="instructions-panel">
            <div class="panel-header">
              <h3 class="panel-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                <span>Instructions</span>
              </h3>
            </div>
            <ol class="instructions-list">
              ${(recipe.instructions || []).map(step => `
                <li class="instruction-step">
                  <div class="step-num"></div>
                  <div>${escapeHtml(step)}</div>
                </li>
              `).join("")}
            </ol>
            ${recipe.notes ? `<div style="margin-top: 1rem; padding: 0.75rem; background: var(--bg-secondary); border-radius: var(--radius-md); font-size: 0.85rem; color: var(--text-secondary);"><strong>Notes:</strong> ${escapeHtml(recipe.notes)}</div>` : ''}
            ${recipe.sourceUrl ? `<div style="margin-top: 0.75rem; font-size: 0.85rem;"><a href="${escapeHtml(recipe.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="color: var(--raptor-cyan); text-decoration: underline;">🔗 View Original Video / Source Reference</a></div>` : ''}
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-card-action" id="modalToggleFavBtn">
            ${isFav ? '❤️ Favorited' : '🤍 Add Favorite'}
          </button>
          <button class="btn btn-card-action" id="modalPrintBtn">🖨️ Print Recipe</button>
        </div>
        <button class="btn btn-primary" id="modalStartCookBtn">
          👨‍🍳 Start Cook Mode
        </button>
      </div>
    `;

    // Modal Events
    document.getElementById("modalCloseInnerBtn").addEventListener("click", closeRecipeModal);

    document.getElementById("scalerMinusBtn").addEventListener("click", () => {
      if (state.modalServings > 1) {
        state.modalServings -= 1;
        renderModalContent();
      }
    });

    document.getElementById("scalerPlusBtn").addEventListener("click", () => {
      state.modalServings += 1;
      renderModalContent();
    });

    document.getElementById("modalAddGroceryBtn").addEventListener("click", () => {
      addRecipeToGrocery(recipe, scaleFactor);
    });

    document.getElementById("modalToggleFavBtn").addEventListener("click", () => {
      toggleFavorite(recipe.id);
      renderModalContent();
      renderRecipes();
    });

    document.getElementById("modalPrintBtn").addEventListener("click", () => {
      window.print();
    });

    document.getElementById("modalStartCookBtn").addEventListener("click", () => {
      closeRecipeModal();
      openCookMode(recipe);
    });
  }

  // --- Favorite Management ---
  function toggleFavorite(id) {
    if (state.favorites.has(id)) {
      state.favorites.delete(id);
      showToast("Removed from favorites", "🤍");
    } else {
      state.favorites.add(id);
      AudioEngine.chime();
      showToast("Added to favorites!", "❤️");
    }
    localStorage.setItem("reciperaptor_favorites", JSON.stringify(Array.from(state.favorites)));
    updateHeaderBadges();
  }

  // --- Raptor Roulette / Random Chooser ---
  let rouletteInterval = null;
  let rouletteChosenRecipe = null;

  function openRouletteModal() {
    el.rouletteBackdrop.classList.add("open");
    document.body.style.overflow = "hidden";
    spinRoulette();
  }

  function closeRouletteModal() {
    el.rouletteBackdrop.classList.remove("open");
    document.body.style.overflow = "";
    if (rouletteInterval) clearInterval(rouletteInterval);
  }

  function spinRoulette() {
    AudioEngine.init();
    const filter = el.rouletteFilterSelect.value;
    let pool = state.recipes;

    if (filter === "high-protein") {
      pool = pool.filter(r => (r.macros?.protein_g || 0) >= 35);
    } else if (filter === "quick") {
      pool = pool.filter(r => (parseInt(r.totalTime) || 30) <= 25);
    } else if (filter === "low-cal") {
      pool = pool.filter(r => (r.calories || 0) <= 400);
    } else if (filter.startsWith("prot:")) {
      const p = filter.replace("prot:", "");
      pool = pool.filter(r => r.protein === p);
    }

    if (pool.length === 0) pool = state.recipes;

    el.rouletteSlot.classList.add("spinning");
    let ticks = 0;
    const maxTicks = 20;

    if (rouletteInterval) clearInterval(rouletteInterval);

    rouletteInterval = setInterval(() => {
      const tempPick = pool[Math.floor(Math.random() * pool.length)];
      el.rouletteSlot.innerHTML = `
        <div class="roulette-protein-tag">${escapeHtml(tempPick.protein)} • ${escapeHtml(tempPick.category)}</div>
        <div class="roulette-title">${escapeHtml(tempPick.title)}</div>
        <div class="roulette-macros">
          <span>🔥 ${tempPick.calories} kcal</span>
          <span>🥩 ${tempPick.macros?.protein_g}g Protein</span>
        </div>
      `;
      AudioEngine.beep(300 + ticks * 15, 0.05, "triangle");
      ticks++;

      if (ticks >= maxTicks) {
        clearInterval(rouletteInterval);
        el.rouletteSlot.classList.remove("spinning");
        rouletteChosenRecipe = tempPick;
        AudioEngine.chime();
      }
    }, 70);
  }

  // --- Interactive Cook Mode (Distraction-Free) ---
  function openCookMode(recipe) {
    state.cookModeStepProgress.clear();
    el.cookModeTitle.textContent = `${recipe.title} (Cook Mode)`;

    const steps = recipe.instructions || ["Cook and enjoy."];
    el.cookModeStepsContainer.innerHTML = steps.map((step, idx) => `
      <div class="cook-step-item" data-step-idx="${idx}">
        <div class="cook-checkbox">✓</div>
        <div class="cook-step-text"><strong>Step ${idx + 1}:</strong> ${escapeHtml(step)}</div>
      </div>
    `).join("");

    // Setup steps click handlers
    document.querySelectorAll(".cook-step-item").forEach(item => {
      item.addEventListener("click", () => {
        const idx = parseInt(item.getAttribute("data-step-idx"));
        if (state.cookModeStepProgress.has(idx)) {
          state.cookModeStepProgress.delete(idx);
          item.classList.remove("completed");
        } else {
          state.cookModeStepProgress.add(idx);
          item.classList.add("completed");
          AudioEngine.beep(600, 0.1, "sine");
        }
      });
    });

    // Request Screen Wake Lock so display doesn't sleep while cooking
    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then(lock => {
        state.wakeLock = lock;
      }).catch(() => {});
    }

    el.cookModeOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeCookMode() {
    el.cookModeOverlay.classList.remove("active");
    document.body.style.overflow = "";
    if (state.timerInterval) clearInterval(state.timerInterval);
    if (state.wakeLock) {
      state.wakeLock.release().catch(() => {});
      state.wakeLock = null;
    }
  }

  // --- Cooking Timer ---
  function startTimer(seconds) {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerSecondsLeft = seconds;
    state.timerTotalSeconds = seconds;
    updateTimerDisplay();

    state.timerInterval = setInterval(() => {
      state.timerSecondsLeft--;
      updateTimerDisplay();

      if (state.timerSecondsLeft <= 0) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
        AudioEngine.alertChime();
        showToast("⏰ Timer Complete! Your food is ready!", "🔔");
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const mins = Math.floor(state.timerSecondsLeft / 60);
    const secs = state.timerSecondsLeft % 60;
    el.cookTimerDisplay.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  // --- Smart Grocery List ---
  function addRecipeToGrocery(recipe, scaleFactor = 1) {
    const itemsToAdd = (recipe.ingredients || []).map(ing => {
      return {
        id: "item-" + Math.random().toString(36).substring(2, 9),
        name: scaleIngredient(ing, scaleFactor),
        recipe: recipe.title,
        checked: false
      };
    });

    state.groceryList.push(...itemsToAdd);
    localStorage.setItem("reciperaptor_grocery", JSON.stringify(state.groceryList));
    updateHeaderBadges();
    AudioEngine.chime();
    showToast(`Added ${itemsToAdd.length} ingredients to Grocery List!`, "🛒");
  }

  function openGroceryDrawer() {
    renderGroceryList();
    el.groceryDrawer.classList.add("open");
  }

  function closeGroceryDrawer() {
    el.groceryDrawer.classList.remove("open");
  }

  function renderGroceryList() {
    if (state.groceryList.length === 0) {
      el.groceryListContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🛒</div>
          <p>Your grocery list is empty. Add ingredients from any recipe modal!</p>
        </div>
      `;
      return;
    }

    el.groceryListContainer.innerHTML = state.groceryList.map((item, idx) => `
      <div class="grocery-item-row ${item.checked ? 'checked' : ''}" data-idx="${idx}">
        <div class="grocery-item-left">
          <input type="checkbox" ${item.checked ? 'checked' : ''} class="grocery-checkbox" data-idx="${idx}">
          <span>${escapeHtml(item.name)}</span>
        </div>
        <button class="btn-icon grocery-delete-btn" data-idx="${idx}" style="color: var(--text-muted);">&times;</button>
      </div>
    `).join("");

    // Checkbox toggles
    el.groceryListContainer.querySelectorAll(".grocery-checkbox").forEach(cb => {
      cb.addEventListener("change", (e) => {
        const idx = parseInt(e.target.getAttribute("data-idx"));
        state.groceryList[idx].checked = e.target.checked;
        localStorage.setItem("reciperaptor_grocery", JSON.stringify(state.groceryList));
        renderGroceryList();
      });
    });

    // Delete item
    el.groceryListContainer.querySelectorAll(".grocery-delete-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = parseInt(e.target.getAttribute("data-idx"));
        state.groceryList.splice(idx, 1);
        localStorage.setItem("reciperaptor_grocery", JSON.stringify(state.groceryList));
        updateHeaderBadges();
        renderGroceryList();
      });
    });
  }

  function copyGroceryListToClipboard() {
    if (state.groceryList.length === 0) return;
    const text = "🛒 RecipeRaptor Grocery List:\n\n" +
      state.groceryList.map(item => `${item.checked ? '[x]' : '[ ]'} ${item.name}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      showToast("Grocery list copied to clipboard!", "📋");
    });
  }

  function clearGroceryList() {
    if (confirm("Clear all items from your grocery list?")) {
      state.groceryList = [];
      localStorage.setItem("reciperaptor_grocery", JSON.stringify(state.groceryList));
      updateHeaderBadges();
      renderGroceryList();
      showToast("Grocery list cleared", "🗑️");
    }
  }

  // --- Add New Recipe Form & JSON Schema Generator ---
  function openAddRecipeModal() {
    el.addRecipeBackdrop.classList.add("open");
    document.body.style.overflow = "hidden";
    updateGeneratedRecipeJson();
  }

  function closeAddRecipeModal() {
    el.addRecipeBackdrop.classList.remove("open");
    document.body.style.overflow = "";
  }

  function updateGeneratedRecipeJson() {
    const form = el.addRecipeForm;
    const title = form.recipeTitle.value.trim() || "New Recipe Title";
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const protein = form.recipeProtein.value;
    const category = form.recipeCategory.value;
    const servings = parseInt(form.recipeServings.value) || 2;
    const totalTime = form.recipeTotalTime.value.trim() || "25 mins";
    const calories = parseInt(form.recipeCalories.value) || 450;
    const protein_g = parseInt(form.recipeProteinG.value) || 35;
    const carbs_g = parseInt(form.recipeCarbsG.value) || 30;
    const fat_g = parseInt(form.recipeFatG.value) || 15;

    const rawIngs = form.recipeIngredients.value.split("\n").map(s => s.trim()).filter(Boolean);
    const rawInst = form.recipeInstructions.value.split("\n").map(s => s.trim()).filter(Boolean);

    const recipeObject = {
      id: slug,
      title: title,
      category: category,
      protein: protein,
      servings: servings,
      prepTime: "10 mins",
      cookTime: totalTime,
      totalTime: totalTime,
      calories: calories,
      macros: {
        protein_g: protein_g,
        carbs_g: carbs_g,
        fat_g: fat_g
      },
      micros: {
        fiber_g: 4.0,
        sodium_mg: 520,
        iron_mg: 2.5,
        potassium_mg: 500,
        vitamin_c_mg: 15,
        calcium_mg: 80
      },
      ingredients: rawIngs.length > 0 ? rawIngs : ["Ingredient 1", "Ingredient 2"],
      instructions: rawInst.length > 0 ? rawInst : ["Step 1 instructions here"],
      notes: form.recipeNotes.value.trim(),
      sourceUrl: form.recipeSourceUrl.value.trim(),
      succinct: rawInst.length <= 2,
      tags: [protein, category]
    };

    el.recipeJsonOutput.textContent = JSON.stringify(recipeObject, null, 2);
  }

  function resetAllFilters() {
    state.searchQuery = "";
    el.searchInput.value = "";
    el.searchClearBtn.style.display = "none";
    state.selectedProtein = "All";
    state.selectedCategory = "All";
    state.selectedIngredients.clear();
    state.activeTag = null;
    state.sortBy = "default";
    el.sortSelect.value = "default";

    // Reset UI buttons
    document.querySelectorAll(".pill-chip").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-protein") === "All" || btn.getAttribute("data-category") === "All");
    });
    document.querySelectorAll(".quick-filter-chip").forEach(btn => btn.classList.remove("active"));
    renderIngredientChips();
    renderRecipes();
    showToast("Filters reset to all recipes", "🦖");
  }

  // --- Setup Event Listeners ---
  function setupEventListeners() {
    // Theme toggle
    el.themeToggle.addEventListener("click", toggleTheme);

    // Search input
    el.searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      el.searchClearBtn.style.display = state.searchQuery ? "block" : "none";
      renderRecipes();
    });

    el.searchClearBtn.addEventListener("click", () => {
      state.searchQuery = "";
      el.searchInput.value = "";
      el.searchClearBtn.style.display = "none";
      renderRecipes();
    });

    // Keyboard shortcut '/' to search
    window.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== el.searchInput && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        el.searchInput.focus();
      } else if (e.key === "Escape") {
        closeRecipeModal();
        closeRouletteModal();
        closeCookMode();
        closeGroceryDrawer();
        closeAddRecipeModal();
      }
    });

    // Protein pills
    el.proteinPillsRow.addEventListener("click", (e) => {
      const btn = e.target.closest(".pill-chip");
      if (!btn) return;
      const prot = btn.getAttribute("data-protein");
      state.selectedProtein = prot;
      el.proteinPillsRow.querySelectorAll(".pill-chip").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderRecipes();
    });

    // Category pills
    el.categoryPillsRow.addEventListener("click", (e) => {
      const btn = e.target.closest(".pill-chip");
      if (!btn) return;
      const cat = btn.getAttribute("data-category");
      state.selectedCategory = cat;
      el.categoryPillsRow.querySelectorAll(".pill-chip").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderRecipes();
    });

    // Ingredient picker clicks
    el.ingredientChipsList.addEventListener("click", (e) => {
      const chip = e.target.closest(".ing-chip");
      if (!chip) return;
      const ing = chip.getAttribute("data-ing").toLowerCase();
      if (state.selectedIngredients.has(ing)) {
        state.selectedIngredients.delete(ing);
      } else {
        state.selectedIngredients.add(ing);
      }
      renderIngredientChips();
      renderRecipes();
    });

    // Add custom ingredient input
    el.addIngredientBtn.addEventListener("click", () => {
      const val = el.ingredientSearchInput.value.trim().toLowerCase();
      if (val) {
        state.selectedIngredients.add(val);
        el.ingredientSearchInput.value = "";
        renderIngredientChips();
        renderRecipes();
      }
    });

    el.ingredientSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        el.addIngredientBtn.click();
      }
    });

    el.clearIngredientsBtn.addEventListener("click", () => {
      state.selectedIngredients.clear();
      renderIngredientChips();
      renderRecipes();
    });

    el.ingMatchModeSelect.addEventListener("change", (e) => {
      state.ingredientMatchMode = e.target.value;
      renderRecipes();
    });

    // Quick filter chips (High protein, quick, low-cal, favorites, succinct)
    el.quickFiltersRow.addEventListener("click", (e) => {
      const chip = e.target.closest(".quick-filter-chip");
      if (!chip) return;
      const tag = chip.getAttribute("data-tag");
      if (state.activeTag === tag) {
        state.activeTag = null;
        chip.classList.remove("active");
      } else {
        state.activeTag = tag;
        el.quickFiltersRow.querySelectorAll(".quick-filter-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
      }
      renderRecipes();
    });

    // Sort select
    el.sortSelect.addEventListener("change", (e) => {
      state.sortBy = e.target.value;
      renderRecipes();
    });

    // Recipe Card grid clicks
    el.recipesGrid.addEventListener("click", (e) => {
      const favBtn = e.target.closest(".favorite-btn");
      if (favBtn) {
        e.stopPropagation();
        const id = favBtn.getAttribute("data-fav-id");
        toggleFavorite(id);
        renderRecipes();
        return;
      }

      const cookBtn = e.target.closest(".quick-cook-btn");
      if (cookBtn) {
        e.stopPropagation();
        const id = cookBtn.getAttribute("data-id");
        const recipe = state.recipes.find(r => r.id === id);
        if (recipe) openCookMode(recipe);
        return;
      }

      const card = e.target.closest(".recipe-card");
      if (card) {
        const id = card.getAttribute("data-id");
        openRecipeModal(id);
      }
    });

    // Modal backdrop click outside
    el.recipeModalBackdrop.addEventListener("click", (e) => {
      if (e.target === el.recipeModalBackdrop) closeRecipeModal();
    });

    // Roulette modal
    el.rouletteBtn.addEventListener("click", openRouletteModal);
    el.rouletteCloseBtn.addEventListener("click", closeRouletteModal);
    el.rouletteBackdrop.addEventListener("click", (e) => {
      if (e.target === el.rouletteBackdrop) closeRouletteModal();
    });
    el.rouletteSpinBtn.addEventListener("click", spinRoulette);
    el.rouletteFilterSelect.addEventListener("change", spinRoulette);
    el.rouletteOpenRecipeBtn.addEventListener("click", () => {
      if (rouletteChosenRecipe) {
        closeRouletteModal();
        openRecipeModal(rouletteChosenRecipe.id);
      }
    });

    // Cook mode
    el.cookModeCloseBtn.addEventListener("click", closeCookMode);

    // Timer presets
    el.timerPresetBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const sec = parseInt(btn.getAttribute("data-sec"));
        startTimer(sec);
      });
    });

    el.timerResetBtn.addEventListener("click", () => {
      if (state.timerInterval) clearInterval(state.timerInterval);
      state.timerInterval = null;
      state.timerSecondsLeft = 0;
      updateTimerDisplay();
    });

    // Grocery drawer
    el.groceryBtn.addEventListener("click", openGroceryDrawer);
    el.groceryDrawerCloseBtn.addEventListener("click", closeGroceryDrawer);
    el.copyGroceryBtn.addEventListener("click", copyGroceryListToClipboard);
    el.clearGroceryBtn.addEventListener("click", clearGroceryList);

    // Add recipe modal
    el.addRecipeBtn.addEventListener("click", openAddRecipeModal);
    el.addRecipeCloseBtn.addEventListener("click", closeAddRecipeModal);
    el.addRecipeBackdrop.addEventListener("click", (e) => {
      if (e.target === el.addRecipeBackdrop) closeAddRecipeModal();
    });
    el.addRecipeForm.addEventListener("input", updateGeneratedRecipeJson);
    el.copyRecipeJsonBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(el.recipeJsonOutput.textContent).then(() => {
        showToast("Recipe JSON copied! Drop it into recipes/ and run build.py", "📋");
      });
    });
  }

  // --- Initialize Application ---
  function init() {
    initTheme();
    renderFilterBars();
    renderRecipes();
    setupEventListeners();
    console.log("🦖 RecipeRaptor loaded successfully with", state.recipes.length, "recipes!");
  }

  // Start on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

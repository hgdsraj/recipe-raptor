/**
 * RecipeRaptor 2.0 Pro - Static Web Application Engine
 * Principal UX Edition: High-contrast hierarchy, interactive prep checklists,
 * collapsible kitchen pantry, mobile bottom nav, and smart NLP search.
 */

(function () {
  "use strict";

  // --- Culinary Synonyms & Normalization Dictionary ---
  const CULINARY_SYNONYMS = {
    "mashed": "mash",
    "mashing": "mash",
    "potatoes": "potato",
    "spuds": "potato",
    "spud": "potato",
    "taters": "potato",
    "tater": "potato",
    "sando": "sandwich",
    "sandos": "sandwich",
    "parm": "parmesan",
    "avo": "avocado",
    "guac": "guacamole",
    "chilli": "chili",
    "chilies": "chili",
    "bbq": "barbecue",
    "veggies": "vegetable",
    "veggie": "vegetable",
    "zuchini": "zucchini",
    "zucchinis": "zucchini",
    "slamon": "salmon",
    "salmom": "salmon",
    "brocolli": "broccoli",
    "brocolini": "broccolini",
    "chiken": "chicken",
    "burgers": "burger",
    "noodles": "noodle",
    "scallions": "scallion",
    "cilantro": "coriander",
    "shrooms": "mushroom",
    "shroom": "mushroom",
    "mushrooms": "mushroom",
    "tomatoes": "tomato",
    "pasta": "pasta",
    "rotisserie": "rotisserie",
    "fajitas": "fajita",
    "tacos": "taco",
    "wraps": "wrap"
  };

  const PROTEIN_ICONS = {
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

  function stemWord(word) {
    if (!word || word.length <= 2) return word;
    let s = word.toLowerCase().trim();
    if (CULINARY_SYNONYMS[s]) return CULINARY_SYNONYMS[s];
    if (s.endsWith("ies") && s.length > 4) return s.slice(0, -3) + "y";
    if (s.endsWith("oes") && s.length > 4) return s.slice(0, -2);
    if (/(ches|shes|sses)$/.test(s)) return s.slice(0, -2);
    if (s.endsWith("ied") && s.length > 4) return s.slice(0, -3) + "y";
    if (s.endsWith("ed") && s.length > 4) {
      if (/(bb|dd|ff|gg|mm|nn|pp|rr|tt)ed$/.test(s)) return s.slice(0, -3);
      if (s.endsWith("eed")) return s.slice(0, -1);
      return s.slice(0, -2);
    }
    if (s.endsWith("ing") && s.length > 5) {
      if (/(bb|dd|ff|gg|mm|nn|pp|rr|tt)ing$/.test(s)) return s.slice(0, -4);
      return s.slice(0, -3);
    }
    if (s.endsWith("s") && !s.endsWith("ss") && s.length > 3) {
      return s.slice(0, -1);
    }
    return s;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  function fuzzyMatches(token, targetToken) {
    if (token === targetToken) return true;
    if (targetToken.includes(token) || token.includes(targetToken)) return true;
    const maxDist = token.length >= 7 ? 2 : token.length >= 4 ? 1 : 0;
    if (maxDist === 0) return false;
    return levenshtein(token, targetToken) <= maxDist;
  }

  /**
   * Extract clean short ingredient label for card pill previews
   */
  function extractShortIngredient(rawLine) {
    if (!rawLine) return "";
    let s = String(rawLine)
      .replace(/\([^)]*\)/g, "")
      .replace(/^[\d\s\/\.\-\–¼½¾⅓⅔⅛⅜⅝⅞]+/, "")
      .replace(/^(cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|cloves?|cans?|packages?|packs?|bunches?|bunch|slices?|pieces?|stalks?|heads?|pinch|dash|large|medium|small|whole|fresh|dried|frozen|boneless|skinless|lean|extra-virgin|extra|virgin|finely|chopped|diced|minced|sliced|grated|shredded|crushed|peeled|cubed|halved|toasted|cooked|raw|organic|low-sodium|unsalted|salted|of)\b\s*/gi, "")
      .replace(/^(of|boneless|skinless|fresh|finely|chopped|diced|minced|sliced)\b\s*/gi, "")
      .split(",")[0]
      .split(";")[0]
      .trim();
    if (s.length > 26) s = s.slice(0, 24).trim() + "…";
    return s || rawLine.slice(0, 20);
  }

  // --- State ---
  const state = {
    recipes: window.RECIPES_DATA || [],
    searchQuery: "",
    selectedProtein: "All",
    selectedCategory: "All",
    selectedIngredients: new Set(),
    ingredientMatchMode: "any",
    activeTag: null,
    sortBy: "default",
    pantryOpen: false,
    favorites: new Set(JSON.parse(localStorage.getItem("reciperaptor_favorites") || "[]")),
    groceryList: JSON.parse(localStorage.getItem("reciperaptor_grocery") || "[]"),
    mealPlan: JSON.parse(localStorage.getItem("reciperaptor_mealplan") || "[]"),
    theme: localStorage.getItem("reciperaptor_theme") || "dark",
    currentModalRecipe: null,
    modalServings: 2,
    baseServings: 2,
    // Session interactive checklist state per recipe ID
    checkedModalIngs: {},
    checkedModalSteps: {},
    cookModeStepProgress: new Set(),
    cookModeIngProgress: new Set(),
    timerInterval: null,
    timerSecondsLeft: 0,
    timerTotalSeconds: 0,
    wakeLock: null
  };

  // Precompute searchable tokens on every recipe
  state.recipes.forEach(r => {
    const titleTokens = (r.title || "").toLowerCase().match(/\b\w+\b/g) || [];
    const ingTokens = (r.ingredients || []).join(" ").toLowerCase().match(/\b\w+\b/g) || [];
    const instTokens = (r.instructions || []).join(" ").toLowerCase().match(/\b\w+\b/g) || [];
    const tagTokens = [
      ...(r.tags || []),
      r.protein || "",
      r.category || "",
      r.sourceTitle || "",
      r.notes || ""
    ].join(" ").toLowerCase().match(/\b\w+\b/g) || [];

    r._tokens = {
      title: titleTokens,
      titleStemmed: titleTokens.map(stemWord),
      ingredients: ingTokens,
      ingredientsStemmed: ingTokens.map(stemWord),
      instructions: instTokens,
      instructionsStemmed: instTokens.map(stemWord),
      tags: tagTokens,
      tagsStemmed: tagTokens.map(stemWord)
    };
  });

  // --- DOM Elements ---
  const el = {
    themeToggle: document.getElementById("themeToggle"),
    searchInput: document.getElementById("searchInput"),
    searchKbdHint: document.getElementById("searchKbdHint"),
    searchClearBtn: document.getElementById("searchClearBtn"),
    pantryToggleBtn: document.getElementById("pantryToggleBtn"),
    pantryCountBadge: document.getElementById("pantryCountBadge"),
    ingredientTray: document.getElementById("ingredientTray"),
    proteinPillsRow: document.getElementById("proteinPillsRow"),
    categoryPillsRow: document.getElementById("categoryPillsRow"),
    ingredientSearchInput: document.getElementById("ingredientSearchInput"),
    addIngredientBtn: document.getElementById("addIngredientBtn"),
    ingredientChipsList: document.getElementById("ingredientChipsList"),
    clearIngredientsBtn: document.getElementById("clearIngredientsBtn"),
    ingMatchModeSelect: document.getElementById("ingMatchModeSelect"),
    quickFiltersRow: document.getElementById("quickFiltersRow"),
    activeFiltersBar: document.getElementById("activeFiltersBar"),
    activeFiltersList: document.getElementById("activeFiltersList"),
    clearAllFiltersBarBtn: document.getElementById("clearAllFiltersBarBtn"),
    sortSelect: document.getElementById("sortSelect"),
    recipesGrid: document.getElementById("recipesGrid"),
    resultsCount: document.getElementById("resultsCount"),
    totalRecipesStat: document.getElementById("totalRecipesStat"),
    avgProteinStat: document.getElementById("avgProteinStat"),
    sourceCountStat: document.getElementById("sourceCountStat"),
    favCountBadge: document.getElementById("favCountBadge"),
    favStatPill: document.getElementById("favStatPill"),
    groceryCountBadge: document.getElementById("groceryCountBadge"),
    mealPlanCountBadge: document.getElementById("mealPlanCountBadge"),
    rouletteBtn: document.getElementById("rouletteBtn"),
    mealPlanBtn: document.getElementById("mealPlanBtn"),
    groceryBtn: document.getElementById("groceryBtn"),
    addRecipeBtn: document.getElementById("addRecipeBtn"),

    // Mobile Bottom Nav
    mobNavExploreBtn: document.getElementById("mobNavExploreBtn"),
    mobNavPantryBtn: document.getElementById("mobNavPantryBtn"),
    mobNavSpinBtn: document.getElementById("mobNavSpinBtn"),
    mobNavPlanBtn: document.getElementById("mobNavPlanBtn"),
    mobNavGroceryBtn: document.getElementById("mobNavGroceryBtn"),
    mobPantryBadge: document.getElementById("mobPantryBadge"),
    mobPlanBadge: document.getElementById("mobPlanBadge"),
    mobGroceryBadge: document.getElementById("mobGroceryBadge"),

    // Meal Plan Modal
    mealPlanBackdrop: document.getElementById("mealPlanBackdrop"),
    mealPlanCloseBtn: document.getElementById("mealPlanCloseBtn"),
    mealPlanBody: document.getElementById("mealPlanBody"),
    clearMealPlanBtn: document.getElementById("clearMealPlanBtn"),
    mealPlanToGroceryBtn: document.getElementById("mealPlanToGroceryBtn"),

    // Recipe Detail Modal
    recipeModalBackdrop: document.getElementById("recipeModalBackdrop"),
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
    cookProgressMeta: document.getElementById("cookProgressMeta"),
    cookProgressBarFill: document.getElementById("cookProgressBarFill"),
    cookModeIngredientsContainer: document.getElementById("cookModeIngredientsContainer"),
    cookModeStepsContainer: document.getElementById("cookModeStepsContainer"),
    cookTimerDisplay: document.getElementById("cookTimerDisplay"),
    timerResetBtn: document.getElementById("timerResetBtn"),
    timerPresetBtns: document.querySelectorAll(".timer-preset-btn"),

    // Grocery Drawer
    groceryDrawer: document.getElementById("groceryDrawer"),
    groceryDrawerCloseBtn: document.getElementById("groceryDrawerCloseBtn"),
    grocerySubStatus: document.getElementById("grocerySubStatus"),
    customGroceryInput: document.getElementById("customGroceryInput"),
    customGroceryAddBtn: document.getElementById("customGroceryAddBtn"),
    groceryListContainer: document.getElementById("groceryListContainer"),
    copyGroceryBtn: document.getElementById("copyGroceryBtn"),
    clearCheckedGroceryBtn: document.getElementById("clearCheckedGroceryBtn"),
    clearGroceryBtn: document.getElementById("clearGroceryBtn"),

    // Add Recipe Modal
    addRecipeBackdrop: document.getElementById("addRecipeBackdrop"),
    addRecipeCloseBtn: document.getElementById("addRecipeCloseBtn"),
    addRecipeForm: document.getElementById("addRecipeForm"),
    copyRecipeJsonBtn: document.getElementById("copyRecipeJsonBtn"),
    recipeJsonOutput: document.getElementById("recipeJsonOutput"),

    toastContainer: document.getElementById("toastContainer")
  };

  // --- Sound Effects ---
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
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    },
    chime() {
      this.beep(523.25, 0.12, "triangle");
      setTimeout(() => this.beep(659.25, 0.12, "triangle"), 100);
      setTimeout(() => this.beep(783.99, 0.2, "triangle"), 200);
    },
    alertChime() {
      this.beep(880, 0.18, "square");
      setTimeout(() => this.beep(880, 0.18, "square"), 220);
      setTimeout(() => this.beep(880, 0.35, "square"), 440);
    }
  };

  function showToast(msg, icon = "🦖") {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(msg)}</span>`;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 220);
    }, 2800);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cleanMarkdownText(str) {
    if (!str) return "";
    return String(str)
      .replace(/^#+\s*/g, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/^[\*\-\•]\s*/g, "")
      .trim();
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
      ? `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
      : `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }

  const COMMON_INGREDIENTS = [
    "chicken", "rice", "garlic", "onion", "soy sauce", "spinach",
    "tofu", "salmon", "turkey", "eggs", "cheese", "tomato",
    "potato", "pasta", "zucchini", "broccoli", "lemon", "avocado",
    "mushrooms", "bell pepper", "beans", "bread", "pork"
  ];

  function togglePantryDrawer(forceState) {
    state.pantryOpen = typeof forceState === "boolean" ? forceState : !state.pantryOpen;
    if (el.ingredientTray) {
      el.ingredientTray.hidden = !state.pantryOpen;
    }
    if (el.pantryToggleBtn) {
      el.pantryToggleBtn.setAttribute("aria-expanded", String(state.pantryOpen));
      el.pantryToggleBtn.classList.toggle("active", state.pantryOpen || state.selectedIngredients.size > 0);
    }
    if (el.mobNavPantryBtn) {
      el.mobNavPantryBtn.classList.toggle("active", state.pantryOpen);
    }
  }

  function renderFilterBars() {
    // 1. Proteins
    const proteinCounts = { All: state.recipes.length };
    state.recipes.forEach(r => {
      const p = r.protein || "Vegetarian";
      proteinCounts[p] = (proteinCounts[p] || 0) + 1;
    });

    el.proteinPillsRow.innerHTML = Object.keys(proteinCounts).map(prot => {
      const count = proteinCounts[prot];
      const icon = PROTEIN_ICONS[prot] || "🍽️";
      const activeClass = state.selectedProtein === prot ? "active" : "";
      return `<button class="pill-chip ${activeClass}" data-protein="${escapeHtml(prot)}">
        <span>${icon}</span>
        <span>${escapeHtml(prot)}</span>
        <span class="pill-count">${count}</span>
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
        <span class="pill-count">${count}</span>
      </button>`;
    }).join("");

    renderIngredientChips();
    updateHeaderBadges();
  }

  function renderIngredientChips() {
    // Include any custom added ingredients alongside COMMON_INGREDIENTS
    const allChipNames = [...COMMON_INGREDIENTS];
    state.selectedIngredients.forEach(sel => {
      if (!allChipNames.some(c => stemWord(c.toLowerCase()) === sel)) {
        allChipNames.unshift(sel);
      }
    });

    el.ingredientChipsList.innerHTML = allChipNames.map(ing => {
      const isSelected = state.selectedIngredients.has(stemWord(ing.toLowerCase()));
      return `<button class="ing-chip ${isSelected ? 'selected' : ''}" data-ing="${escapeHtml(ing)}">
        ${isSelected ? '✓ ' : '+ '}${escapeHtml(ing)}
      </button>`;
    }).join("");

    const count = state.selectedIngredients.size;
    if (el.pantryCountBadge) {
      el.pantryCountBadge.textContent = count;
      el.pantryCountBadge.style.display = count > 0 ? "inline-block" : "none";
    }
    if (el.mobPantryBadge) {
      el.mobPantryBadge.textContent = count;
      el.mobPantryBadge.style.display = count > 0 ? "inline-block" : "none";
    }
    if (el.pantryToggleBtn) {
      el.pantryToggleBtn.classList.toggle("active", state.pantryOpen || count > 0);
    }
  }

  function updateHeaderBadges() {
    if (el.favCountBadge) el.favCountBadge.textContent = state.favorites.size;
    if (el.groceryCountBadge) el.groceryCountBadge.textContent = state.groceryList.length;
    if (el.mealPlanCountBadge) el.mealPlanCountBadge.textContent = state.mealPlan.length;

    if (el.mobPlanBadge) {
      el.mobPlanBadge.textContent = state.mealPlan.length;
      el.mobPlanBadge.style.display = state.mealPlan.length > 0 ? "inline-block" : "none";
    }
    if (el.mobGroceryBadge) {
      el.mobGroceryBadge.textContent = state.groceryList.length;
      el.mobGroceryBadge.style.display = state.groceryList.length > 0 ? "inline-block" : "none";
    }

    if (el.totalRecipesStat) el.totalRecipesStat.textContent = state.recipes.length;
    if (el.sourceCountStat) {
      el.sourceCountStat.textContent = state.recipes.filter(r => r.sourceUrl).length;
    }
    if (el.avgProteinStat && state.recipes.length > 0) {
      const avgP = Math.round(state.recipes.reduce((acc, r) => acc + (r.macros?.protein_g || 0), 0) / state.recipes.length);
      el.avgProteinStat.textContent = `${avgP}g`;
    }
  }

  function renderActiveFilterBreadcrumbs() {
    if (!el.activeFiltersBar || !el.activeFiltersList) return;
    const chips = [];

    if (state.searchQuery.trim()) {
      chips.push(`<button class="active-filter-tag" data-clear="search">🔍 "${escapeHtml(state.searchQuery.trim())}" <span>&times;</span></button>`);
    }
    if (state.selectedProtein !== "All") {
      const icon = PROTEIN_ICONS[state.selectedProtein] || "🥩";
      chips.push(`<button class="active-filter-tag" data-clear="protein">${icon} ${escapeHtml(state.selectedProtein)} <span>&times;</span></button>`);
    }
    if (state.selectedCategory !== "All") {
      chips.push(`<button class="active-filter-tag" data-clear="category">🍽️ ${escapeHtml(state.selectedCategory)} <span>&times;</span></button>`);
    }
    if (state.activeTag) {
      const tagLabels = {
        "high-protein": "⚡ High-Protein (>35g)",
        "quick": "⏱️ Quick (≤25m)",
        "low-cal": "🥗 Low-Cal (≤400 kcal)",
        "has-source": "🔗 Verified Source",
        "succinct": "📝 Quick-Fire",
        "favorites": "❤️ Favorites"
      };
      chips.push(`<button class="active-filter-tag" data-clear="tag">${tagLabels[state.activeTag] || state.activeTag} <span>&times;</span></button>`);
    }
    state.selectedIngredients.forEach(ing => {
      chips.push(`<button class="active-filter-tag" data-clear-ing="${escapeHtml(ing)}">🥕 ${escapeHtml(ing)} <span>&times;</span></button>`);
    });

    if (chips.length === 0) {
      el.activeFiltersBar.hidden = true;
      el.activeFiltersList.innerHTML = "";
    } else {
      el.activeFiltersBar.hidden = false;
      el.activeFiltersList.innerHTML = `<span style="color: var(--text-muted); font-weight: 700; margin-right: 2px;">Active:</span>` + chips.join("");
    }
  }

  function getSourceBadgeInfo(recipe) {
    const url = (recipe.sourceUrl || "").trim();
    if (!url) return null;
    const lower = url.toLowerCase();
    const label = recipe.sourceTitle || "Source Recipe";
    if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
      const shortLabel = label.replace(/^YouTube\s*·\s*/i, "").slice(0, 18);
      return { icon: "▶️", text: shortLabel || "YouTube", isYt: true, url, fullTitle: label };
    }
    if (lower.includes("instagram.com")) {
      return { icon: "📸", text: "Reel", isYt: true, url, fullTitle: label };
    }
    const shortWeb = label.split("·")[0].trim().slice(0, 18);
    return { icon: "🌐", text: shortWeb || "Source", isYt: false, url, fullTitle: label };
  }

  function scoreRecipeSearch(recipe, rawQueryTokens, stemmedQueryTokens) {
    if (rawQueryTokens.length === 0) return 100;
    const t = recipe._tokens;
    let totalScore = 0;

    for (let i = 0; i < rawQueryTokens.length; i++) {
      const rawQ = rawQueryTokens[i];
      const stemQ = stemmedQueryTokens[i];
      let termMatched = false;
      let termScore = 0;

      if (t.titleStemmed.includes(stemQ) || t.title.includes(rawQ)) {
        termScore += 100;
        termMatched = true;
      } else if (t.title.some(tok => tok.includes(rawQ)) || t.titleStemmed.some(tok => tok.includes(stemQ))) {
        termScore += 70;
        termMatched = true;
      } else if (t.titleStemmed.some(tok => fuzzyMatches(stemQ, tok))) {
        termScore += 50;
        termMatched = true;
      }

      if (t.ingredientsStemmed.includes(stemQ) || t.ingredients.includes(rawQ)) {
        termScore += 45;
        termMatched = true;
      } else if (t.ingredientsStemmed.some(tok => fuzzyMatches(stemQ, tok))) {
        termScore += 30;
        termMatched = true;
      }

      if (t.tagsStemmed.includes(stemQ) || t.tags.includes(rawQ)) {
        termScore += 35;
        termMatched = true;
      } else if (t.tagsStemmed.some(tok => fuzzyMatches(stemQ, tok))) {
        termScore += 20;
        termMatched = true;
      }

      if (t.instructionsStemmed.includes(stemQ) || t.instructions.includes(rawQ)) {
        termScore += 15;
        termMatched = true;
      }

      if (!termMatched) return 0;
      totalScore += termScore;
    }

    return totalScore;
  }

  function getFilteredRecipes() {
    const query = state.searchQuery.toLowerCase().trim();
    const rawQueryTokens = query ? query.match(/\b\w+\b/g) || [] : [];
    const stemmedQueryTokens = rawQueryTokens.map(stemWord);

    const scoredRecipes = [];

    for (let i = 0; i < state.recipes.length; i++) {
      const recipe = state.recipes[i];

      if (state.selectedProtein !== "All" && recipe.protein !== state.selectedProtein) continue;
      if (state.selectedCategory !== "All" && recipe.category !== state.selectedCategory) continue;

      if (state.activeTag) {
        if (state.activeTag === "favorites" && !state.favorites.has(recipe.id)) continue;
        if (state.activeTag === "high-protein" && (recipe.macros?.protein_g || 0) < 35) continue;
        if (state.activeTag === "quick" && (parseInt(recipe.totalTime) || 30) > 25) continue;
        if (state.activeTag === "low-cal" && (recipe.calories || 0) > 400) continue;
        if (state.activeTag === "has-source" && !recipe.sourceUrl) continue;
        if (state.activeTag === "succinct" && !recipe.succinct) continue;
      }

      if (state.selectedIngredients.size > 0) {
        const recipeStemmedIngs = recipe._tokens.ingredientsStemmed;
        const recipeRawIngs = (recipe.ingredients || []).join(" ").toLowerCase();

        const matchCount = Array.from(state.selectedIngredients).filter(stemmedIng => {
          return recipeStemmedIngs.includes(stemmedIng) ||
                 recipeRawIngs.includes(stemmedIng) ||
                 recipeStemmedIngs.some(tok => fuzzyMatches(stemmedIng, tok));
        }).length;

        if (state.ingredientMatchMode === "all") {
          if (matchCount < state.selectedIngredients.size) continue;
        } else {
          if (matchCount === 0) continue;
        }
      }

      const score = scoreRecipeSearch(recipe, rawQueryTokens, stemmedQueryTokens);
      if (score === 0 && rawQueryTokens.length > 0) continue;

      scoredRecipes.push({ recipe, score });
    }

    return scoredRecipes.sort((a, b) => {
      if (rawQueryTokens.length > 0 && state.sortBy === "default") {
        if (b.score !== a.score) return b.score - a.score;
      }
      if (state.sortBy === "doc-asc") return (a.recipe.docOrder || 999) - (b.recipe.docOrder || 999);
      if (state.sortBy === "title-asc") return a.recipe.title.localeCompare(b.recipe.title);
      if (state.sortBy === "protein-desc") return (b.recipe.macros?.protein_g || 0) - (a.recipe.macros?.protein_g || 0);
      if (state.sortBy === "efficiency-desc") {
        const effA = ((a.recipe.macros?.protein_g || 0) * 4) / (a.recipe.calories || 400);
        const effB = ((b.recipe.macros?.protein_g || 0) * 4) / (b.recipe.calories || 400);
        return effB - effA;
      }
      if (state.sortBy === "calories-asc") return (a.recipe.calories || 0) - (b.recipe.calories || 0);
      if (state.sortBy === "time-asc") return (parseInt(a.recipe.totalTime) || 30) - (parseInt(b.recipe.totalTime) || 30);
      return (a.recipe.docOrder || 999) - (b.recipe.docOrder || 999);
    }).map(sr => sr.recipe);
  }

  // --- Render Recipe Cards Grid ---
  function renderRecipes() {
    renderActiveFilterBreadcrumbs();
    const list = getFilteredRecipes();
    el.resultsCount.innerHTML = `Showing <strong>${list.length}</strong> of ${state.recipes.length} recipes`;

    if (list.length === 0) {
      el.recipesGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🦖🔍</div>
          <h3>No Matching Recipes Found</h3>
          <p>No recipes matched your current filter combination. Try removing a filter or resetting to browse all 200 recipes.</p>
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
      const protIcon = PROTEIN_ICONS[recipe.protein] || "🍽️";

      let matchBadgeHtml = "";
      if (state.selectedIngredients.size > 0) {
        const recipeStemmedIngs = recipe._tokens.ingredientsStemmed;
        const recipeRawIngs = (recipe.ingredients || []).join(" ").toLowerCase();
        const matches = Array.from(state.selectedIngredients).filter(stemmedIng => {
          return recipeStemmedIngs.includes(stemmedIng) ||
                 recipeRawIngs.includes(stemmedIng) ||
                 recipeStemmedIngs.some(tok => fuzzyMatches(stemmedIng, tok));
        }).length;
        if (matches > 0) {
          matchBadgeHtml = `<span class="badge badge-match">✨ ${matches}/${state.selectedIngredients.size}</span>`;
        }
      }

      // Build scannable key ingredient pills (up to 3 + "+N more")
      const rawIngs = recipe.ingredients || [];
      const previewIngs = rawIngs.slice(0, 3).map(extractShortIngredient).filter(Boolean);
      const remainingCount = Math.max(0, rawIngs.length - previewIngs.length);
      const ingPillsHtml = previewIngs.map(ing => `<span class="card-ing-pill">${escapeHtml(ing)}</span>`).join("") +
        (remainingCount > 0 ? `<span class="card-ing-pill card-ing-pill-more">+${remainingCount} more</span>` : "");

      const srcInfo = getSourceBadgeInfo(recipe);
      const sourceBadgeHtml = srcInfo
        ? `<a href="${escapeHtml(srcInfo.url)}" target="_blank" rel="noopener noreferrer" class="badge-source-link ${srcInfo.isYt ? 'badge-source-yt' : ''}" title="Open Verified Source: ${escapeHtml(srcInfo.fullTitle)}">${srcInfo.icon} ${escapeHtml(srcInfo.text)} ↗</a>`
        : "";

      const cleanTitle = cleanMarkdownText(recipe.title);

      return `
        <article class="recipe-card" data-id="${escapeHtml(recipe.id)}" data-prot="${escapeHtml(recipe.protein || 'Vegetarian')}">
          <div>
            <div class="card-top">
              <div class="card-badges">
                <span class="badge badge-protein">${protIcon} ${escapeHtml(recipe.protein || 'Meal')}</span>
                <span class="badge badge-category">${escapeHtml(recipe.category || 'Mains')}</span>
                ${matchBadgeHtml}
              </div>
              <div class="card-top-right">
                ${recipe.docOrder ? `<span class="badge-doc-num">#${recipe.docOrder}</span>` : ''}
                <button class="favorite-btn ${isFav ? 'favorited' : ''}" data-fav-id="${escapeHtml(recipe.id)}" title="${isFav ? 'Remove from Favorites' : 'Save to Favorites'}" aria-label="Favorite">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </button>
              </div>
            </div>

            <h3 class="recipe-title" title="${escapeHtml(cleanTitle)}">${escapeHtml(cleanTitle)}</h3>

            <div class="card-ing-pills">
              ${ingPillsHtml}
            </div>

            <div class="card-nutrition">
              <div class="nutrition-headline">
                <div>
                  <span class="calories-val">${recipe.calories || 0}</span>
                  <span class="calories-label">kcal</span>
                </div>
                <div class="protein-efficiency">
                  🥩 ${prot}g Protein (${Math.round(((prot * 4) / (recipe.calories || 400)) * 100)}% cal)
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
            <div class="card-meta-left">
              <div class="meta-time" title="Total prep + cook time">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>${escapeHtml(recipe.totalTime || '25m')}</span>
              </div>
              ${sourceBadgeHtml}
            </div>
            <div class="card-actions">
              <button class="btn-card-action quick-plan-btn" data-id="${escapeHtml(recipe.id)}" title="Add to Meal Planner">+Plan</button>
              <button class="btn-card-action quick-cook-btn" data-id="${escapeHtml(recipe.id)}" title="Launch Hands-Free Cook Mode">👨‍🍳 Cook</button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function scaleIngredient(text, scaleFactor) {
    if (scaleFactor === 1) return text;
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

  function openRecipeModal(recipeId) {
    const recipe = state.recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    state.currentModalRecipe = recipe;
    state.baseServings = recipe.servings || 2;
    state.modalServings = state.baseServings;

    if (!state.checkedModalIngs[recipe.id]) {
      state.checkedModalIngs[recipe.id] = new Set();
    }
    if (!state.checkedModalSteps[recipe.id]) {
      state.checkedModalSteps[recipe.id] = new Set();
    }

    if (history.replaceState) {
      history.replaceState(null, "", `#recipe=${encodeURIComponent(recipe.id)}`);
    }

    renderModalContent();
    el.recipeModalBackdrop.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeRecipeModal() {
    el.recipeModalBackdrop.classList.remove("open");
    document.body.style.overflow = "";
    state.currentModalRecipe = null;
    if (history.replaceState && window.location.hash.startsWith("#recipe=")) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  function renderModalContent(preserveScroll = false) {
    const recipe = state.currentModalRecipe;
    if (!recipe) return;

    const prevBodyScroll = preserveScroll ? (el.modalContent.querySelector(".modal-body")?.scrollTop || 0) : 0;
    const prevBackdropScroll = preserveScroll ? (el.recipeModalBackdrop?.scrollTop || 0) : 0;

    const scaleFactor = state.modalServings / (state.baseServings || 2);
    const scaledCalories = Math.round(recipe.calories * scaleFactor);
    const scaledProtein = Math.round((recipe.macros?.protein_g || 0) * scaleFactor);
    const scaledCarbs = Math.round((recipe.macros?.carbs_g || 0) * scaleFactor);
    const scaledFat = Math.round((recipe.macros?.fat_g || 0) * scaleFactor);

    const isFav = state.favorites.has(recipe.id);
    const srcInfo = getSourceBadgeInfo(recipe);
    const protIcon = PROTEIN_ICONS[recipe.protein] || "🍽️";

    const checkedIngs = state.checkedModalIngs[recipe.id] || new Set();
    const checkedSteps = state.checkedModalSteps[recipe.id] || new Set();
    const totalIngs = (recipe.ingredients || []).length;
    const uncheckedCount = Math.max(0, totalIngs - checkedIngs.size);

    el.modalContent.innerHTML = `
      <div class="modal-header">
        <div class="modal-header-info">
          <div class="card-badges">
            <span class="badge badge-protein">${protIcon} ${escapeHtml(recipe.protein)}</span>
            <span class="badge badge-category">${escapeHtml(recipe.category)}</span>
            ${recipe.docOrder ? `<span class="badge badge-category">Doc #${recipe.docOrder}</span>` : ''}
          </div>
          <h2 class="modal-title">${escapeHtml(cleanMarkdownText(recipe.title))}</h2>
        </div>
        <button class="modal-close-btn" id="modalCloseInnerBtn" title="Close Modal (Esc)" aria-label="Close Recipe Modal">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          <span class="modal-close-label">Close</span>
        </button>
      </div>

      <div class="modal-body">
        ${srcInfo ? `
        <div class="modal-source-banner">
          <div>
            <div style="font-size: 0.68rem; text-transform: uppercase; font-weight: 800; color: var(--raptor-cyan); letter-spacing: 0.05em;">Verified Source Reference</div>
            <div style="font-size: 0.86rem; font-weight: 600; color: var(--text-primary);">${srcInfo.icon} ${escapeHtml(srcInfo.fullTitle)}</div>
          </div>
          <a href="${escapeHtml(srcInfo.url)}" target="_blank" rel="noopener noreferrer" class="modal-source-btn">
            <span>Open Original Source</span>
            <span>↗</span>
          </a>
        </div>
        ` : ''}

        <!-- Balanced 6-Column Portion & Macro Strip -->
        <div class="recipe-summary-strip">
          <div class="summary-item">
            <span class="summary-item-label">Servings</span>
            <div class="scaler-control">
              <button class="scaler-btn" id="scalerMinusBtn" aria-label="Decrease servings">−</button>
              <span class="scaler-val" id="scalerVal">${state.modalServings}</span>
              <button class="scaler-btn" id="scalerPlusBtn" aria-label="Increase servings">+</button>
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

        <!-- Compact 1-Line Micronutrient Strip -->
        <div class="micros-compact-strip">
          <div class="micros-strip-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            <span>Micronutrients / serving:</span>
          </div>
          <div class="micros-pills-group">
            <span class="micro-pill"><strong>${((recipe.micros?.fiber_g || 0) * scaleFactor).toFixed(1)}g</strong>Fiber</span>
            <span class="micro-pill"><strong>${Math.round((recipe.micros?.sodium_mg || 0) * scaleFactor)}mg</strong>Sodium</span>
            <span class="micro-pill"><strong>${Math.round((recipe.micros?.potassium_mg || 0) * scaleFactor)}mg</strong>Potassium</span>
            <span class="micro-pill"><strong>${((recipe.micros?.iron_mg || 0) * scaleFactor).toFixed(1)}mg</strong>Iron</span>
            <span class="micro-pill"><strong>${Math.round((recipe.micros?.vitamin_c_mg || 0) * scaleFactor)}mg</strong>Vit C</span>
            <span class="micro-pill"><strong>${Math.round((recipe.micros?.calcium_mg || 0) * scaleFactor)}mg</strong>Calcium</span>
          </div>
        </div>

        <!-- Interactive Two-Column Ingredients & Instructions -->
        <div class="recipe-details-grid">
          <div class="ingredients-panel">
            <div class="panel-header">
              <h3 class="panel-title">
                <span>🥗 Ingredients</span>
                <span class="prep-progress-pill" id="ingPrepProgressPill">${checkedIngs.size}/${totalIngs} prepped</span>
              </h3>
              <button class="btn btn-card-action" id="modalAddGroceryBtn" title="Add unchecked ingredients to your Grocery List">
                🛒 + Grocery (${uncheckedCount || totalIngs})
              </button>
            </div>
            <div style="font-size: 0.73rem; color: var(--text-muted); margin-bottom: 0.5rem;">
              Tap an ingredient to check it off as you prep, or click <strong>+🛒</strong> to add a single item:
            </div>
            <ul class="ingredients-list">
              ${(recipe.ingredients || []).map((ing, idx) => {
                const scaledText = scaleIngredient(ing, scaleFactor);
                const isChecked = checkedIngs.has(idx);
                return `
                  <li class="ingredient-row ${isChecked ? 'checked' : ''}" data-ing-idx="${idx}">
                    <div class="ing-row-left">
                      <span class="ing-check-box">✓</span>
                      <span class="ing-text">${escapeHtml(scaledText)}</span>
                    </div>
                    <button class="ing-single-add-btn" data-single-ing="${escapeHtml(scaledText)}" title="Add just this ingredient to Grocery List">+🛒</button>
                  </li>
                `;
              }).join("")}
            </ul>
          </div>

          <div class="instructions-panel">
            <div class="panel-header">
              <h3 class="panel-title">
                <span>👨‍🍳 Step-by-Step Instructions</span>
                <span class="prep-progress-pill" id="stepPrepProgressPill">${checkedSteps.size}/${(recipe.instructions || []).length} done</span>
              </h3>
            </div>
            <div style="font-size: 0.73rem; color: var(--text-muted); margin-bottom: 0.5rem;">
              Tap any step below to mark it complete as you cook:
            </div>
            <ol class="instructions-list">
              ${(recipe.instructions || []).map((step, idx) => {
                const isStepDone = checkedSteps.has(idx);
                return `
                  <li class="instruction-step ${isStepDone ? 'completed' : ''}" data-modal-step-idx="${idx}">
                    <div class="step-num">${isStepDone ? '✓' : idx + 1}</div>
                    <div class="step-text">${escapeHtml(step)}</div>
                  </li>
                `;
              }).join("")}
            </ol>
            ${recipe.notes ? `<div style="margin-top: 0.85rem; padding: 0.7rem 0.85rem; background: var(--bg-secondary); border-left: 3px solid var(--raptor-amber); border-radius: var(--radius-sm); font-size: 0.82rem; color: var(--text-secondary);"><strong>💡 Chef / Personal Notes:</strong> ${escapeHtml(recipe.notes)}</div>` : ''}
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <div class="modal-footer-left">
          <button class="btn btn-card-action modal-footer-close-btn" id="modalFooterCloseBtn" title="Close Recipe">✕ Close</button>
          <button class="btn btn-card-action" id="modalToggleFavBtn">
            ${isFav ? '❤️ Saved' : '🤍 Save'}
          </button>
          <button class="btn btn-card-action" id="modalAddPlanBtn">📅 +Plan</button>
          <button class="btn btn-card-action" id="modalShareBtn">🔗 Share</button>
          <button class="btn btn-card-action modal-print-btn" id="modalPrintBtn">🖨️ Print</button>
        </div>
        <button class="btn btn-primary" id="modalStartCookBtn">
          👨‍🍳 Cook Mode
        </button>
      </div>
    `;

    if (preserveScroll) {
      const newBody = el.modalContent.querySelector(".modal-body");
      if (newBody) newBody.scrollTop = prevBodyScroll;
      if (el.recipeModalBackdrop) el.recipeModalBackdrop.scrollTop = prevBackdropScroll;
    }

    document.getElementById("modalCloseInnerBtn").addEventListener("click", closeRecipeModal);
    document.getElementById("modalFooterCloseBtn")?.addEventListener("click", closeRecipeModal);

    document.getElementById("scalerMinusBtn").addEventListener("click", () => {
      if (state.modalServings > 1) {
        state.modalServings -= 1;
        renderModalContent(true);
      }
    });

    document.getElementById("scalerPlusBtn").addEventListener("click", () => {
      state.modalServings += 1;
      renderModalContent(true);
    });

    // Interactive Ingredient Checklist & Single-Item Grocery Quick-Add (In-Place DOM Update - Zero Scroll Jump)
    el.modalContent.querySelectorAll(".ingredient-row").forEach(row => {
      row.addEventListener("click", (e) => {
        const singleBtn = e.target.closest(".ing-single-add-btn");
        if (singleBtn) {
          e.stopPropagation();
          const ingText = singleBtn.getAttribute("data-single-ing");
          addSingleItemToGrocery(ingText, recipe.title);
          return;
        }
        const idx = parseInt(row.getAttribute("data-ing-idx"));
        if (checkedIngs.has(idx)) {
          checkedIngs.delete(idx);
          row.classList.remove("checked");
        } else {
          checkedIngs.add(idx);
          row.classList.add("checked");
          AudioEngine.beep(520, 0.05, "sine");
        }
        const newUnchecked = Math.max(0, totalIngs - checkedIngs.size);
        const ingPill = document.getElementById("ingPrepProgressPill");
        if (ingPill) ingPill.textContent = `${checkedIngs.size}/${totalIngs} prepped`;
        const grocBtn = document.getElementById("modalAddGroceryBtn");
        if (grocBtn) grocBtn.textContent = `🛒 + Grocery (${newUnchecked || totalIngs})`;
      });
    });

    // Interactive Numbered Steps in Modal (In-Place DOM Update - Zero Scroll Jump)
    const totalStepsCount = (recipe.instructions || []).length;
    el.modalContent.querySelectorAll(".instruction-step").forEach(stepRow => {
      stepRow.addEventListener("click", () => {
        const idx = parseInt(stepRow.getAttribute("data-modal-step-idx"));
        const numBadge = stepRow.querySelector(".step-num");
        if (checkedSteps.has(idx)) {
          checkedSteps.delete(idx);
          stepRow.classList.remove("completed");
          if (numBadge) numBadge.textContent = String(idx + 1);
        } else {
          checkedSteps.add(idx);
          stepRow.classList.add("completed");
          if (numBadge) numBadge.textContent = "✓";
          AudioEngine.beep(620, 0.06, "sine");
        }
        const stepPill = document.getElementById("stepPrepProgressPill");
        if (stepPill) stepPill.textContent = `${checkedSteps.size}/${totalStepsCount} done`;
      });
    });

    document.getElementById("modalAddGroceryBtn").addEventListener("click", () => {
      addRecipeToGrocery(recipe, scaleFactor, checkedIngs);
    });

    document.getElementById("modalToggleFavBtn").addEventListener("click", () => {
      toggleFavorite(recipe.id);
      renderModalContent(true);
      renderRecipes();
    });

    document.getElementById("modalAddPlanBtn").addEventListener("click", () => {
      addRecipeToMealPlan(recipe.id, state.modalServings);
    });

    document.getElementById("modalShareBtn").addEventListener("click", () => {
      const shareUrl = `${window.location.origin}${window.location.pathname}#recipe=${encodeURIComponent(recipe.id)}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("Direct recipe link copied to clipboard!", "🔗");
      });
    });

    document.getElementById("modalPrintBtn").addEventListener("click", () => {
      window.print();
    });

    document.getElementById("modalStartCookBtn").addEventListener("click", () => {
      const currentServings = state.modalServings;
      closeRecipeModal();
      openCookMode(recipe, currentServings);
    });
  }

  function toggleFavorite(id) {
    if (state.favorites.has(id)) {
      state.favorites.delete(id);
      showToast("Removed from saved favorites", "🤍");
    } else {
      state.favorites.add(id);
      AudioEngine.chime();
      showToast("Saved to favorites!", "❤️");
    }
    localStorage.setItem("reciperaptor_favorites", JSON.stringify(Array.from(state.favorites)));
    updateHeaderBadges();
  }

  // --- Raptor Roulette ---
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
    const maxTicks = 18;

    if (rouletteInterval) clearInterval(rouletteInterval);

    rouletteInterval = setInterval(() => {
      const tempPick = pool[Math.floor(Math.random() * pool.length)];
      el.rouletteSlot.innerHTML = `
        <div class="roulette-protein-tag">${escapeHtml(tempPick.protein)} • ${escapeHtml(tempPick.category)}</div>
        <div class="roulette-title">${escapeHtml(tempPick.title)}</div>
        <div class="roulette-macros">
          <span>🔥 ${tempPick.calories} kcal</span>
          <span>🥩 ${tempPick.macros?.protein_g}g Protein</span>
          <span>⏱️ ${escapeHtml(tempPick.totalTime || '25m')}</span>
        </div>
      `;
      AudioEngine.beep(300 + ticks * 16, 0.04, "triangle");
      ticks++;

      if (ticks >= maxTicks) {
        clearInterval(rouletteInterval);
        el.rouletteSlot.classList.remove("spinning");
        rouletteChosenRecipe = tempPick;
        AudioEngine.chime();
      }
    }, 65);
  }

  // --- Cook Mode (With Ingredients Reference & Live Step Progress Bar) ---
  function openCookMode(recipe, servingsOverride) {
    state.cookModeStepProgress.clear();
    state.cookModeIngProgress.clear();

    const scaleFactor = (servingsOverride || recipe.servings || 2) / (recipe.servings || 2);
    el.cookModeTitle.textContent = recipe.title;

    const ings = recipe.ingredients || [];
    if (el.cookModeIngredientsContainer) {
      el.cookModeIngredientsContainer.innerHTML = ings.map((ing, idx) => `
        <li class="cook-ing-item" data-cook-ing="${idx}">
          <span class="ing-check-box">✓</span>
          <span>${escapeHtml(scaleIngredient(ing, scaleFactor))}</span>
        </li>
      `).join("");

      el.cookModeIngredientsContainer.querySelectorAll(".cook-ing-item").forEach(item => {
        item.addEventListener("click", () => {
          item.classList.toggle("checked");
          const box = item.querySelector(".ing-check-box");
          if (item.classList.contains("checked")) {
            box.style.background = "var(--raptor-green)";
            box.style.borderColor = "var(--raptor-green)";
            box.style.color = "#fff";
          } else {
            box.style.background = "";
            box.style.borderColor = "";
            box.style.color = "transparent";
          }
        });
      });
    }

    const steps = recipe.instructions || ["Cook and enjoy."];
    const updateCookProgressUI = () => {
      const done = state.cookModeStepProgress.size;
      const total = steps.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      if (el.cookProgressMeta) {
        el.cookProgressMeta.textContent = `Step ${done} of ${total} completed (${pct}%)`;
      }
      if (el.cookProgressBarFill) {
        el.cookProgressBarFill.style.width = `${pct}%`;
      }
    };

    updateCookProgressUI();

    el.cookModeStepsContainer.innerHTML = steps.map((step, idx) => `
      <div class="cook-step-item" data-step-idx="${idx}">
        <div class="cook-checkbox">${idx + 1}</div>
        <div class="cook-step-text">${escapeHtml(step)}</div>
      </div>
    `).join("");

    el.cookModeStepsContainer.querySelectorAll(".cook-step-item").forEach(item => {
      item.addEventListener("click", () => {
        const idx = parseInt(item.getAttribute("data-step-idx"));
        const box = item.querySelector(".cook-checkbox");
        if (state.cookModeStepProgress.has(idx)) {
          state.cookModeStepProgress.delete(idx);
          item.classList.remove("completed");
          if (box) box.textContent = String(idx + 1);
        } else {
          state.cookModeStepProgress.add(idx);
          item.classList.add("completed");
          if (box) box.textContent = "✓";
          AudioEngine.beep(600, 0.08, "sine");
        }
        updateCookProgressUI();
      });
    });

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
        showToast("⏰ Kitchen Timer Complete!", "🔔");
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const mins = Math.floor(state.timerSecondsLeft / 60);
    const secs = state.timerSecondsLeft % 60;
    el.cookTimerDisplay.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  // --- Weekly Meal Planner & Macro Calculator ---
  function addRecipeToMealPlan(recipeId, servings = null) {
    const recipe = state.recipes.find(r => r.id === recipeId);
    if (!recipe) return;
    state.mealPlan.push({
      uid: "mp-" + Math.random().toString(36).substring(2, 9),
      id: recipe.id,
      servings: servings || recipe.servings || 2
    });
    localStorage.setItem("reciperaptor_mealplan", JSON.stringify(state.mealPlan));
    updateHeaderBadges();
    AudioEngine.chime();
    showToast(`Added "${recipe.title}" to Meal Plan!`, "📅");
  }

  function openMealPlanModal() {
    renderMealPlan();
    el.mealPlanBackdrop.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeMealPlanModal() {
    el.mealPlanBackdrop.classList.remove("open");
    document.body.style.overflow = "";
  }

  function renderMealPlan() {
    if (!el.mealPlanBody) return;
    if (state.mealPlan.length === 0) {
      el.mealPlanBody.innerHTML = `
        <div class="empty-state" style="padding: 2.5rem 1rem;">
          <div class="empty-state-icon">📅🥗</div>
          <h3>Your Meal Plan is Empty</h3>
          <p>Click <strong>+Plan</strong> on any recipe card or modal to stack meals and calculate cumulative daily/weekly macros.</p>
        </div>
      `;
      return;
    }

    let totCal = 0, totP = 0, totC = 0, totF = 0, totFib = 0;
    const resolved = state.mealPlan.map((entry, idx) => {
      const r = state.recipes.find(x => x.id === entry.id);
      if (!r) return null;
      totCal += r.calories || 0;
      totP += r.macros?.protein_g || 0;
      totC += r.macros?.carbs_g || 0;
      totF += r.macros?.fat_g || 0;
      totFib += r.micros?.fiber_g || 0;
      return { entry, r, idx };
    }).filter(Boolean);

    const eff = totCal > 0 ? Math.round(((totP * 4) / totCal) * 100) : 0;

    el.mealPlanBody.innerHTML = `
      <div class="recipe-summary-strip">
        <div class="summary-item">
          <span class="summary-item-label">Planned Meals</span>
          <span class="summary-item-val">${resolved.length}</span>
        </div>
        <div class="summary-item">
          <span class="summary-item-label">Total Calories</span>
          <span class="summary-item-val" style="color: var(--raptor-green)">${totCal} kcal</span>
        </div>
        <div class="summary-item">
          <span class="summary-item-label">Total Protein</span>
          <span class="summary-item-val" style="color: var(--macro-protein)">${totP}g (${eff}%)</span>
        </div>
        <div class="summary-item">
          <span class="summary-item-label">Total Carbs</span>
          <span class="summary-item-val" style="color: var(--macro-carbs)">${totC}g</span>
        </div>
        <div class="summary-item">
          <span class="summary-item-label">Total Fat</span>
          <span class="summary-item-val" style="color: var(--macro-fat)">${totF}g</span>
        </div>
        <div class="summary-item">
          <span class="summary-item-label">Total Fiber</span>
          <span class="summary-item-val">${totFib.toFixed(1)}g</span>
        </div>
      </div>

      <div>
        ${resolved.map(({ r, idx }) => `
          <div class="meal-plan-row">
            <div class="meal-plan-row-info">
              <div class="meal-plan-row-title" data-open-id="${escapeHtml(r.id)}">${escapeHtml(r.title)}</div>
              <div class="meal-plan-row-meta">
                🔥 ${r.calories} kcal · 🥩 ${r.macros?.protein_g || 0}g P · 🌾 ${r.macros?.carbs_g || 0}g C · 🥑 ${r.macros?.fat_g || 0}g F · ⏱️ ${escapeHtml(r.totalTime || '25m')}
              </div>
            </div>
            <button class="btn-card-action mp-remove-btn" data-mp-idx="${idx}" style="color: var(--raptor-coral);">&times; Remove</button>
          </div>
        `).join("")}
      </div>
    `;

    el.mealPlanBody.querySelectorAll(".meal-plan-row-title").forEach(t => {
      t.addEventListener("click", () => {
        const id = t.getAttribute("data-open-id");
        closeMealPlanModal();
        openRecipeModal(id);
      });
    });

    el.mealPlanBody.querySelectorAll(".mp-remove-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-mp-idx"));
        state.mealPlan.splice(idx, 1);
        localStorage.setItem("reciperaptor_mealplan", JSON.stringify(state.mealPlan));
        updateHeaderBadges();
        renderMealPlan();
      });
    });
  }

  // --- Grocery List ---
  function addSingleItemToGrocery(itemText, recipeTitle = "Custom") {
    if (!itemText) return;
    state.groceryList.push({
      id: "item-" + Math.random().toString(36).substring(2, 9),
      name: itemText,
      recipe: recipeTitle,
      checked: false
    });
    localStorage.setItem("reciperaptor_grocery", JSON.stringify(state.groceryList));
    updateHeaderBadges();
    AudioEngine.beep(660, 0.08, "triangle");
    showToast(`Added "${itemText}" to Grocery List`, "🛒");
  }

  function addRecipeToGrocery(recipe, scaleFactor = 1, checkedSet = new Set()) {
    const rawIngs = recipe.ingredients || [];
    const filteredIngs = rawIngs.filter((_, idx) => !checkedSet.has(idx));
    const targetIngs = filteredIngs.length > 0 ? filteredIngs : rawIngs;

    const itemsToAdd = targetIngs.map(ing => ({
      id: "item-" + Math.random().toString(36).substring(2, 9),
      name: scaleIngredient(ing, scaleFactor),
      recipe: recipe.title,
      checked: false
    }));

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
    const total = state.groceryList.length;
    const checkedCount = state.groceryList.filter(i => i.checked).length;
    if (el.grocerySubStatus) {
      el.grocerySubStatus.textContent = total === 0 ? "0 items" : `${total - checkedCount} remaining · ${checkedCount} checked`;
    }

    if (total === 0) {
      el.groceryListContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🛒</div>
          <p>Your grocery list is empty. Add individual ingredients or full recipes from any recipe modal!</p>
        </div>
      `;
      return;
    }

    el.groceryListContainer.innerHTML = state.groceryList.map((item, idx) => `
      <div class="grocery-item-row ${item.checked ? 'checked' : ''}" data-idx="${idx}">
        <label class="grocery-item-left" style="cursor: pointer;">
          <input type="checkbox" ${item.checked ? 'checked' : ''} class="grocery-checkbox" data-idx="${idx}" style="margin-top: 3px;">
          <div>
            <span>${escapeHtml(item.name)}</span>
            ${item.recipe ? `<small class="grocery-item-recipe-tag">${escapeHtml(item.recipe)}</small>` : ''}
          </div>
        </label>
        <button class="btn-icon grocery-delete-btn" data-idx="${idx}" style="color: var(--text-muted);">&times;</button>
      </div>
    `).join("");

    el.groceryListContainer.querySelectorAll(".grocery-checkbox").forEach(cb => {
      cb.addEventListener("change", (e) => {
        const idx = parseInt(e.target.getAttribute("data-idx"));
        state.groceryList[idx].checked = e.target.checked;
        localStorage.setItem("reciperaptor_grocery", JSON.stringify(state.groceryList));
        const row = e.target.closest(".grocery-item-row");
        if (row) row.classList.toggle("checked", e.target.checked);
        const tot = state.groceryList.length;
        const chk = state.groceryList.filter(i => i.checked).length;
        if (el.grocerySubStatus) {
          el.grocerySubStatus.textContent = tot === 0 ? "0 items" : `${tot - chk} remaining · ${chk} checked`;
        }
      });
    });

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
      state.groceryList.map(item => `${item.checked ? '[x]' : '[ ]'} ${item.name}${item.recipe ? ` (${item.recipe})` : ''}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      showToast("Grocery list copied to clipboard!", "📋");
    });
  }

  function clearGroceryList() {
    if (state.groceryList.length === 0) return;
    state.groceryList = [];
    localStorage.setItem("reciperaptor_grocery", JSON.stringify(state.groceryList));
    updateHeaderBadges();
    renderGroceryList();
    showToast("Grocery list cleared", "🗑️");
  }

  // --- Add Recipe Modal ---
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
    if (el.searchKbdHint) el.searchKbdHint.style.display = "";
    state.selectedProtein = "All";
    state.selectedCategory = "All";
    state.selectedIngredients.clear();
    state.activeTag = null;
    state.sortBy = "default";
    el.sortSelect.value = "default";

    document.querySelectorAll(".pill-chip").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-protein") === "All" || btn.getAttribute("data-category") === "All");
    });
    document.querySelectorAll(".quick-filter-chip").forEach(btn => btn.classList.remove("active"));
    renderIngredientChips();
    renderRecipes();
    showToast("Reset to all 200 recipes", "🦖");
  }

  // --- Setup Event Listeners ---
  function setupEventListeners() {
    el.themeToggle.addEventListener("click", toggleTheme);

    el.searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      const hasVal = Boolean(state.searchQuery);
      el.searchClearBtn.style.display = hasVal ? "inline-flex" : "none";
      if (el.searchKbdHint) el.searchKbdHint.style.display = hasVal ? "none" : "";
      renderRecipes();
    });

    el.searchClearBtn.addEventListener("click", () => {
      state.searchQuery = "";
      el.searchInput.value = "";
      el.searchClearBtn.style.display = "none";
      if (el.searchKbdHint) el.searchKbdHint.style.display = "";
      renderRecipes();
    });

    if (el.pantryToggleBtn) {
      el.pantryToggleBtn.addEventListener("click", () => togglePantryDrawer());
    }

    if (el.favStatPill) {
      el.favStatPill.addEventListener("click", () => {
        const favChip = el.quickFiltersRow?.querySelector('[data-tag="favorites"]');
        if (favChip) favChip.click();
      });
    }

    if (el.activeFiltersList) {
      el.activeFiltersList.addEventListener("click", (e) => {
        const btn = e.target.closest(".active-filter-tag");
        if (!btn) return;
        const clearType = btn.getAttribute("data-clear");
        const clearIng = btn.getAttribute("data-clear-ing");

        if (clearType === "search") {
          el.searchClearBtn.click();
        } else if (clearType === "protein") {
          state.selectedProtein = "All";
          el.proteinPillsRow.querySelectorAll(".pill-chip").forEach(b => {
            b.classList.toggle("active", b.getAttribute("data-protein") === "All");
          });
          renderRecipes();
        } else if (clearType === "category") {
          state.selectedCategory = "All";
          el.categoryPillsRow.querySelectorAll(".pill-chip").forEach(b => {
            b.classList.toggle("active", b.getAttribute("data-category") === "All");
          });
          renderRecipes();
        } else if (clearType === "tag") {
          state.activeTag = null;
          el.quickFiltersRow.querySelectorAll(".quick-filter-chip").forEach(c => c.classList.remove("active"));
          renderRecipes();
        } else if (clearIng) {
          state.selectedIngredients.delete(clearIng);
          renderIngredientChips();
          renderRecipes();
        }
      });
    }

    if (el.clearAllFiltersBarBtn) {
      el.clearAllFiltersBarBtn.addEventListener("click", resetAllFilters);
    }

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
        closeMealPlanModal();
      }
    });

    el.proteinPillsRow.addEventListener("click", (e) => {
      const btn = e.target.closest(".pill-chip");
      if (!btn) return;
      const prot = btn.getAttribute("data-protein");
      state.selectedProtein = prot;
      el.proteinPillsRow.querySelectorAll(".pill-chip").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderRecipes();
    });

    el.categoryPillsRow.addEventListener("click", (e) => {
      const btn = e.target.closest(".pill-chip");
      if (!btn) return;
      const cat = btn.getAttribute("data-category");
      state.selectedCategory = cat;
      el.categoryPillsRow.querySelectorAll(".pill-chip").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderRecipes();
    });

    el.ingredientChipsList.addEventListener("click", (e) => {
      const chip = e.target.closest(".ing-chip");
      if (!chip) return;
      const ing = stemWord(chip.getAttribute("data-ing").toLowerCase());
      if (state.selectedIngredients.has(ing)) {
        state.selectedIngredients.delete(ing);
      } else {
        state.selectedIngredients.add(ing);
      }
      renderIngredientChips();
      renderRecipes();
    });

    el.addIngredientBtn.addEventListener("click", () => {
      const val = stemWord(el.ingredientSearchInput.value.trim().toLowerCase());
      if (val) {
        state.selectedIngredients.add(val);
        el.ingredientSearchInput.value = "";
        renderIngredientChips();
        renderRecipes();
      }
    });

    el.ingredientSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
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

    el.sortSelect.addEventListener("change", (e) => {
      state.sortBy = e.target.value;
      renderRecipes();
    });

    el.recipesGrid.addEventListener("click", (e) => {
      const sourceLink = e.target.closest(".badge-source-link");
      if (sourceLink) {
        e.stopPropagation();
        return;
      }

      const favBtn = e.target.closest(".favorite-btn");
      if (favBtn) {
        e.stopPropagation();
        const id = favBtn.getAttribute("data-fav-id");
        toggleFavorite(id);
        if (state.activeTag === "favorites") {
          renderRecipes();
        } else {
          const isFavNow = state.favorites.has(id);
          favBtn.classList.toggle("favorited", isFavNow);
          const svg = favBtn.querySelector("svg");
          if (svg) svg.setAttribute("fill", isFavNow ? "currentColor" : "none");
        }
        return;
      }

      const planBtn = e.target.closest(".quick-plan-btn");
      if (planBtn) {
        e.stopPropagation();
        const id = planBtn.getAttribute("data-id");
        addRecipeToMealPlan(id);
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

    el.recipeModalBackdrop.addEventListener("click", (e) => {
      if (e.target === el.recipeModalBackdrop) closeRecipeModal();
    });

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

    el.cookModeCloseBtn.addEventListener("click", closeCookMode);

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

    if (el.mealPlanBtn) {
      el.mealPlanBtn.addEventListener("click", openMealPlanModal);
      el.mealPlanCloseBtn.addEventListener("click", closeMealPlanModal);
      el.mealPlanBackdrop.addEventListener("click", (e) => {
        if (e.target === el.mealPlanBackdrop) closeMealPlanModal();
      });
      el.clearMealPlanBtn.addEventListener("click", () => {
        state.mealPlan = [];
        localStorage.setItem("reciperaptor_mealplan", "[]");
        updateHeaderBadges();
        renderMealPlan();
        showToast("Meal plan cleared", "🗑️");
      });
      el.mealPlanToGroceryBtn.addEventListener("click", () => {
        if (state.mealPlan.length === 0) return;
        state.mealPlan.forEach(entry => {
          const r = state.recipes.find(x => x.id === entry.id);
          if (r) addRecipeToGrocery(r, 1);
        });
        closeMealPlanModal();
        openGroceryDrawer();
      });
    }

    el.groceryBtn.addEventListener("click", openGroceryDrawer);
    el.groceryDrawerCloseBtn.addEventListener("click", closeGroceryDrawer);
    el.copyGroceryBtn.addEventListener("click", copyGroceryListToClipboard);
    el.clearGroceryBtn.addEventListener("click", clearGroceryList);

    if (el.clearCheckedGroceryBtn) {
      el.clearCheckedGroceryBtn.addEventListener("click", () => {
        state.groceryList = state.groceryList.filter(item => !item.checked);
        localStorage.setItem("reciperaptor_grocery", JSON.stringify(state.groceryList));
        updateHeaderBadges();
        renderGroceryList();
        showToast("Cleared checked items", "✓");
      });
    }

    if (el.customGroceryAddBtn && el.customGroceryInput) {
      el.customGroceryAddBtn.addEventListener("click", () => {
        const val = el.customGroceryInput.value.trim();
        if (val) {
          addSingleItemToGrocery(val, "Custom Item");
          el.customGroceryInput.value = "";
          renderGroceryList();
        }
      });
      el.customGroceryInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          el.customGroceryAddBtn.click();
        }
      });
    }

    // Mobile Bottom Navigation Listeners
    if (el.mobNavExploreBtn) {
      el.mobNavExploreBtn.addEventListener("click", () => {
        closeRecipeModal();
        closeRouletteModal();
        closeMealPlanModal();
        closeGroceryDrawer();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
    if (el.mobNavPantryBtn) {
      el.mobNavPantryBtn.addEventListener("click", () => {
        closeRecipeModal();
        closeRouletteModal();
        closeMealPlanModal();
        closeGroceryDrawer();
        togglePantryDrawer(true);
        el.pantryToggleBtn?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    if (el.mobNavSpinBtn) {
      el.mobNavSpinBtn.addEventListener("click", () => {
        closeRecipeModal();
        closeMealPlanModal();
        closeGroceryDrawer();
        openRouletteModal();
      });
    }
    if (el.mobNavPlanBtn) {
      el.mobNavPlanBtn.addEventListener("click", () => {
        closeRecipeModal();
        closeRouletteModal();
        closeGroceryDrawer();
        openMealPlanModal();
      });
    }
    if (el.mobNavGroceryBtn) {
      el.mobNavGroceryBtn.addEventListener("click", () => {
        closeRecipeModal();
        closeRouletteModal();
        closeMealPlanModal();
        openGroceryDrawer();
      });
    }

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

  function checkDeepLinkHash() {
    if (window.location.hash && window.location.hash.startsWith("#recipe=")) {
      const id = decodeURIComponent(window.location.hash.replace("#recipe=", ""));
      if (id) openRecipeModal(id);
    }
  }

  function init() {
    initTheme();
    renderFilterBars();
    renderRecipes();
    setupEventListeners();
    checkDeepLinkHash();
    window.addEventListener("hashchange", checkDeepLinkHash);
    console.log("🦖 RecipeRaptor 2.0 Pro loaded with", state.recipes.length, "recipes!");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/**
 * RecipeRaptor - Static Web Application Engine
 * High-performance, zero-dependency, client-side cooking dashboard
 * Features Smart Linguistic Stemming, Culinary Synonyms, & Fuzzy Search
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

  /**
   * Smart Word Stemmer: Normalizes plurals, conjugations, and culinary variations
   */
  function stemWord(word) {
    if (!word || word.length <= 2) return word;
    let s = word.toLowerCase().trim();

    // Check synonym dictionary first
    if (CULINARY_SYNONYMS[s]) return CULINARY_SYNONYMS[s];

    // Plurals: ies -> y (e.g. berries -> berry)
    if (s.endsWith("ies") && s.length > 4) return s.slice(0, -3) + "y";

    // Plurals: oes -> o (potatoes -> potato, tomatoes -> tomato)
    if (s.endsWith("oes") && s.length > 4) return s.slice(0, -2);

    // Plurals: s/es (boxes -> box, dishes -> dish, sauces -> sauce)
    if (/(ches|shes|sses)$/.test(s)) return s.slice(0, -2);

    // Past tense / Participles: -ed (mashed -> mash, roasted -> roast, baked -> bake)
    if (s.endsWith("ied") && s.length > 4) return s.slice(0, -3) + "y";
    if (s.endsWith("ed") && s.length > 4) {
      if (/(bb|dd|ff|gg|mm|nn|pp|rr|tt)ed$/.test(s)) return s.slice(0, -3);
      if (s.endsWith("eed")) return s.slice(0, -1);
      return s.slice(0, -2);
    }

    // Gerund: -ing (mashing -> mash, roasting -> roast, boiling -> boil)
    if (s.endsWith("ing") && s.length > 5) {
      if (/(bb|dd|ff|gg|mm|nn|pp|rr|tt)ing$/.test(s)) return s.slice(0, -4);
      return s.slice(0, -3);
    }

    // General plural: strip trailing 's' if not double-s (e.g. carrots -> carrot, wings -> wing)
    if (s.endsWith("s") && !s.endsWith("ss") && s.length > 3) {
      return s.slice(0, -1);
    }

    return s;
  }

  /**
   * Levenshtein Distance for fuzzy typo tolerance
   */
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

  /**
   * Fuzzy Match Token: allows 1 typo for words 4-6 chars, 2 typos for 7+ chars
   */
  function fuzzyMatches(token, targetToken) {
    if (token === targetToken) return true;
    if (targetToken.includes(token) || token.includes(targetToken)) return true;
    const maxDist = token.length >= 7 ? 2 : token.length >= 4 ? 1 : 0;
    if (maxDist === 0) return false;
    return levenshtein(token, targetToken) <= maxDist;
  }

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
    mealPlan: JSON.parse(localStorage.getItem("reciperaptor_mealplan") || "[]"),
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

  // Precompute searchable tokens on every recipe for blazing performance
  state.recipes.forEach(r => {
    const titleTokens = (r.title || "").toLowerCase().match(/\b\w+\b/g) || [];
    const ingTokens = (r.ingredients || []).join(" ").toLowerCase().match(/\b\w+\b/g) || [];
    const instTokens = (r.instructions || []).join(" ").toLowerCase().match(/\b\w+\b/g) || [];
    const tagTokens = (r.tags || []).join(" ").toLowerCase().match(/\b\w+\b/g) || [];

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
    totalRecipesStat: document.getElementById("totalRecipesStat"),
    avgProteinStat: document.getElementById("avgProteinStat"),
    sourceCountStat: document.getElementById("sourceCountStat"),
    favCountBadge: document.getElementById("favCountBadge"),
    groceryCountBadge: document.getElementById("groceryCountBadge"),
    mealPlanCountBadge: document.getElementById("mealPlanCountBadge"),
    rouletteBtn: document.getElementById("rouletteBtn"),
    mealPlanBtn: document.getElementById("mealPlanBtn"),
    groceryBtn: document.getElementById("groceryBtn"),
    addRecipeBtn: document.getElementById("addRecipeBtn"),

    // Meal Plan Modal
    mealPlanBackdrop: document.getElementById("mealPlanBackdrop"),
    mealPlanCloseBtn: document.getElementById("mealPlanCloseBtn"),
    mealPlanBody: document.getElementById("mealPlanBody"),
    clearMealPlanBtn: document.getElementById("clearMealPlanBtn"),
    mealPlanToGroceryBtn: document.getElementById("mealPlanToGroceryBtn"),

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

  // --- Sound Effects using Web Audio API ---
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
      } catch (e) {}
    },
    chime() {
      this.beep(523.25, 0.15, "triangle");
      setTimeout(() => this.beep(659.25, 0.15, "triangle"), 120);
      setTimeout(() => this.beep(783.99, 0.25, "triangle"), 240);
    },
    alertChime() {
      this.beep(880, 0.2, "square");
      setTimeout(() => this.beep(880, 0.2, "square"), 250);
      setTimeout(() => this.beep(880, 0.4, "square"), 500);
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
      setTimeout(() => toast.remove(), 250);
    }, 3200);
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
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }

  const COMMON_INGREDIENTS = [
    "chicken", "rice", "garlic", "onion", "soy sauce", "spinach", 
    "tofu", "salmon", "turkey", "eggs", "cheese", "tomato", 
    "potato", "pasta", "zucchini", "broccoli", "lemon", "avocado", 
    "mushrooms", "bell pepper", "beans", "bread", "pork"
  ];

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

    renderIngredientChips();
    updateHeaderBadges();
  }

  function renderIngredientChips() {
    el.ingredientChipsList.innerHTML = COMMON_INGREDIENTS.map(ing => {
      const isSelected = state.selectedIngredients.has(stemWord(ing.toLowerCase()));
      return `<button class="ing-chip ${isSelected ? 'selected' : ''}" data-ing="${escapeHtml(ing)}">
        ${isSelected ? '✓ ' : '+ '}${escapeHtml(ing)}
      </button>`;
    }).join("");
  }

  function updateHeaderBadges() {
    el.favCountBadge.textContent = state.favorites.size;
    el.groceryCountBadge.textContent = state.groceryList.length;
    if (el.mealPlanCountBadge) el.mealPlanCountBadge.textContent = state.mealPlan.length;
    if (el.totalRecipesStat) el.totalRecipesStat.textContent = state.recipes.length;
    if (el.sourceCountStat) {
      el.sourceCountStat.textContent = state.recipes.filter(r => r.sourceUrl).length;
    }
    if (el.avgProteinStat && state.recipes.length > 0) {
      const avgP = Math.round(state.recipes.reduce((acc, r) => acc + (r.macros?.protein_g || 0), 0) / state.recipes.length);
      el.avgProteinStat.textContent = `${avgP}g`;
    }
  }

  function getSourceBadgeInfo(recipe) {
    const url = (recipe.sourceUrl || "").trim();
    if (!url) return null;
    const lower = url.toLowerCase();
    const label = recipe.sourceTitle || "Source Recipe";
    if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
      const shortLabel = label.replace(/^YouTube\s*·\s*/i, "").slice(0, 22);
      return { icon: "▶️", text: shortLabel || "YouTube", isYt: true, url, fullTitle: label };
    }
    if (lower.includes("instagram.com")) {
      return { icon: "📸", text: "Instagram Reel", isYt: true, url, fullTitle: label };
    }
    const shortWeb = label.split("·")[0].trim().slice(0, 22);
    return { icon: "🌐", text: shortWeb || "Web Recipe", isYt: false, url, fullTitle: label };
  }

  /**
   * Smart Search Score Calculator
   * Matches raw tokens, stemmed tokens, and fuzzy distances across recipe fields
   */
  function scoreRecipeSearch(recipe, rawQueryTokens, stemmedQueryTokens) {
    if (rawQueryTokens.length === 0) return 100;

    const t = recipe._tokens;
    let totalScore = 0;

    for (let i = 0; i < rawQueryTokens.length; i++) {
      const rawQ = rawQueryTokens[i];
      const stemQ = stemmedQueryTokens[i];
      let termMatched = false;
      let termScore = 0;

      // 1. Title match (highest weight)
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

      // 2. Ingredients match (high weight)
      if (t.ingredientsStemmed.includes(stemQ) || t.ingredients.includes(rawQ)) {
        termScore += 45;
        termMatched = true;
      } else if (t.ingredientsStemmed.some(tok => fuzzyMatches(stemQ, tok))) {
        termScore += 30;
        termMatched = true;
      }

      // 3. Protein & Category & Tags match
      if (t.tagsStemmed.includes(stemQ) || t.tags.includes(rawQ)) {
        termScore += 35;
        termMatched = true;
      }

      // 4. Instructions match
      if (t.instructionsStemmed.includes(stemQ) || t.instructions.includes(rawQ)) {
        termScore += 15;
        termMatched = true;
      }

      // If a term in multi-word query doesn't match anywhere, penalize or exclude
      if (!termMatched) {
        return 0; // Strict AND condition across terms for accurate matching
      }

      totalScore += termScore;
    }

    return totalScore;
  }

  // --- Filtering & Sorting Core Engine ---
  function getFilteredRecipes() {
    const query = state.searchQuery.toLowerCase().trim();
    const rawQueryTokens = query ? query.match(/\b\w+\b/g) || [] : [];
    const stemmedQueryTokens = rawQueryTokens.map(stemWord);

    const scoredRecipes = [];

    for (let i = 0; i < state.recipes.length; i++) {
      const recipe = state.recipes[i];

      // 1. Protein filter
      if (state.selectedProtein !== "All" && recipe.protein !== state.selectedProtein) {
        continue;
      }

      // 2. Category filter
      if (state.selectedCategory !== "All" && recipe.category !== state.selectedCategory) {
        continue;
      }

      // 3. Quick Tag / Preset filter
      if (state.activeTag) {
        if (state.activeTag === "favorites") {
          if (!state.favorites.has(recipe.id)) continue;
        } else if (state.activeTag === "high-protein") {
          if ((recipe.macros?.protein_g || 0) < 35) continue;
        } else if (state.activeTag === "quick") {
          const totalMin = parseInt(recipe.totalTime) || 30;
          if (totalMin > 25) continue;
        } else if (state.activeTag === "low-cal") {
          if ((recipe.calories || 0) > 400) continue;
        } else if (state.activeTag === "has-source") {
          if (!recipe.sourceUrl) continue;
        } else if (state.activeTag === "succinct") {
          if (!recipe.succinct) continue;
        }
      }

      // 4. Ingredient Picker Filter
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

      // 5. Smart Search relevance calculation
      const score = scoreRecipeSearch(recipe, rawQueryTokens, stemmedQueryTokens);
      if (score === 0 && rawQueryTokens.length > 0) {
        continue;
      }

      scoredRecipes.push({ recipe, score });
    }

    // Sort results
    return scoredRecipes.sort((a, b) => {
      // If user typed a search query, rank by smart search score first!
      if (rawQueryTokens.length > 0 && state.sortBy === "default") {
        if (b.score !== a.score) return b.score - a.score;
      }

      if (state.sortBy === "doc-asc") {
        return (a.recipe.docOrder || 999) - (b.recipe.docOrder || 999);
      } else if (state.sortBy === "title-asc") {
        return a.recipe.title.localeCompare(b.recipe.title);
      } else if (state.sortBy === "protein-desc") {
        return (b.recipe.macros?.protein_g || 0) - (a.recipe.macros?.protein_g || 0);
      } else if (state.sortBy === "efficiency-desc") {
        const effA = ((a.recipe.macros?.protein_g || 0) * 4) / (a.recipe.calories || 400);
        const effB = ((b.recipe.macros?.protein_g || 0) * 4) / (b.recipe.calories || 400);
        return effB - effA;
      } else if (state.sortBy === "calories-asc") {
        return (a.recipe.calories || 0) - (b.recipe.calories || 0);
      } else if (state.sortBy === "time-asc") {
        const tA = parseInt(a.recipe.totalTime) || 30;
        const tB = parseInt(b.recipe.totalTime) || 30;
        return tA - tB;
      }
      return (a.recipe.docOrder || 999) - (b.recipe.docOrder || 999);
    }).map(sr => sr.recipe);
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
          matchBadgeHtml = `<span class="badge badge-match">✨ ${matches}/${state.selectedIngredients.size} Match</span>`;
        }
      }

      let previewText = "";
      if (recipe.ingredients && recipe.ingredients.length > 0) {
        previewText = recipe.ingredients.slice(0, 4).join(", ");
      } else if (recipe.instructions && recipe.instructions.length > 0) {
        previewText = recipe.instructions[0];
      }

      const srcInfo = getSourceBadgeInfo(recipe);
      const sourceBadgeHtml = srcInfo
        ? `<a href="${escapeHtml(srcInfo.url)}" target="_blank" rel="noopener noreferrer" class="badge-source-link ${srcInfo.isYt ? 'badge-source-yt' : ''}" title="Open Source: ${escapeHtml(srcInfo.fullTitle)}">${srcInfo.icon} ${escapeHtml(srcInfo.text)} ↗</a>`
        : "";

      return `
        <div class="recipe-card" data-id="${escapeHtml(recipe.id)}">
          <div>
            <div class="card-top">
              <div class="card-badges">
                <span class="badge badge-protein">${escapeHtml(recipe.protein || 'Meal')}</span>
                <span class="badge badge-category">${escapeHtml(recipe.category || 'Mains')}</span>
                ${sourceBadgeHtml}
                ${matchBadgeHtml}
              </div>
              <button class="favorite-btn ${isFav ? 'favorited' : ''}" data-fav-id="${escapeHtml(recipe.id)}" title="Favorite recipe">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>
            </div>

            <h3 class="recipe-title">${escapeHtml(cleanMarkdownText(recipe.title))}</h3>
            <p class="recipe-quick-desc">${escapeHtml(cleanMarkdownText(previewText))}</p>

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
              <button class="btn-card-action quick-plan-btn" data-id="${escapeHtml(recipe.id)}" title="Add to Meal Plan">📅 +Plan</button>
              <button class="btn-card-action open-detail-btn" data-id="${escapeHtml(recipe.id)}">Details</button>
              <button class="btn-card-action quick-cook-btn" data-id="${escapeHtml(recipe.id)}" title="Cook Mode">👨‍🍳 Cook</button>
            </div>
          </div>
        </div>
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

  function renderModalContent() {
    const recipe = state.currentModalRecipe;
    if (!recipe) return;

    const scaleFactor = state.modalServings / (state.baseServings || 2);
    const scaledCalories = Math.round(recipe.calories * scaleFactor);
    const scaledProtein = Math.round((recipe.macros?.protein_g || 0) * scaleFactor);
    const scaledCarbs = Math.round((recipe.macros?.carbs_g || 0) * scaleFactor);
    const scaledFat = Math.round((recipe.macros?.fat_g || 0) * scaleFactor);

    const isFav = state.favorites.has(recipe.id);
    const srcInfo = getSourceBadgeInfo(recipe);

    el.modalContent.innerHTML = `
      <div class="modal-header">
        <div class="modal-header-info">
          <div class="card-badges">
            <span class="badge badge-protein">${escapeHtml(recipe.protein)}</span>
            <span class="badge badge-category">${escapeHtml(recipe.category)}</span>
            ${recipe.docOrder ? `<span class="badge badge-category">Doc #${recipe.docOrder}</span>` : ''}
          </div>
          <h2 class="modal-title">${escapeHtml(cleanMarkdownText(recipe.title))}</h2>
        </div>
        <button class="modal-close-btn" id="modalCloseInnerBtn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="modal-body">
        ${srcInfo ? `
        <div class="modal-source-banner">
          <div>
            <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 800; color: var(--raptor-cyan); letter-spacing: 0.05em;">Verified Source Reference</div>
            <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary); margin-top: 2px;">${srcInfo.icon} ${escapeHtml(srcInfo.fullTitle)}</div>
          </div>
          <a href="${escapeHtml(srcInfo.url)}" target="_blank" rel="noopener noreferrer" class="modal-source-btn">
            <span>🔗 Open Original Source</span>
            <span>↗</span>
          </a>
        </div>
        ` : ''}
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
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-card-action" id="modalToggleFavBtn">
            ${isFav ? '❤️ Favorited' : '🤍 Favorite'}
          </button>
          <button class="btn btn-card-action" id="modalAddPlanBtn">📅 + Meal Plan</button>
          <button class="btn btn-card-action" id="modalShareBtn">🔗 Share Link</button>
          <button class="btn btn-card-action" id="modalPrintBtn">🖨️ Print</button>
        </div>
        <button class="btn btn-primary" id="modalStartCookBtn">
          👨‍🍳 Start Cook Mode
        </button>
      </div>
    `;

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
      closeRecipeModal();
      openCookMode(recipe);
    });
  }

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

  // --- Cook Mode ---
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
        showToast("⏰ Timer Complete! Your food is ready!", "🔔");
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
          <p>Click <strong>📅 +Plan</strong> on any recipe card or modal to stack meals and track your total macros &amp; calories.</p>
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

    el.groceryListContainer.querySelectorAll(".grocery-checkbox").forEach(cb => {
      cb.addEventListener("change", (e) => {
        const idx = parseInt(e.target.getAttribute("data-idx"));
        state.groceryList[idx].checked = e.target.checked;
        localStorage.setItem("reciperaptor_grocery", JSON.stringify(state.groceryList));
        renderGroceryList();
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
    showToast("Filters reset to all recipes", "🦖");
  }

  // --- Setup Event Listeners ---
  function setupEventListeners() {
    el.themeToggle.addEventListener("click", toggleTheme);

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
      // Allow clicking source links directly without opening the modal
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
        renderRecipes();
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
    console.log("🦖 RecipeRaptor loaded with Smart NLP Search &", state.recipes.length, "recipes!");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

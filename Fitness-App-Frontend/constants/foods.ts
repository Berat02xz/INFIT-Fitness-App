// ─── Gamified Food List ──────────────────────────────────────────────────────
// Pick-an-emoji food logging. Each entry is one tap = one logged item, with
// approximate nutrition per typical serving. Combos (multiple emojis) represent
// a full meal (e.g. 🍚🥩 = steak & rice). Numbers are rough, newbie-friendly
// estimates — not lab-accurate — so logging stays fast and fun.

export interface FoodItem {
  id: string;
  emoji: string;
  name: string;
  /** kcal per serving */
  calories: number;
  protein: number;  // g
  carbs: number;    // g
  fats: number;     // g
  /** loose serving hint shown in the UI */
  serving?: string;
  /** extra search keywords */
  tags?: string[];
  /** surfaced in the quick-add row on the nutrition screen */
  featured?: boolean;
}

export const FOODS: FoodItem[] = [
  // ── Fruit ──
  { id: "apple", emoji: "🍎", name: "Apple", calories: 95, protein: 0, carbs: 25, fats: 0, serving: "1 medium", tags: ["fruit"], featured: true },
  { id: "banana", emoji: "🍌", name: "Banana", calories: 105, protein: 1, carbs: 27, fats: 0, serving: "1 medium", tags: ["fruit"], featured: true },
  { id: "orange", emoji: "🍊", name: "Orange", calories: 62, protein: 1, carbs: 15, fats: 0, serving: "1 medium", tags: ["fruit", "citrus"] },
  { id: "strawberries", emoji: "🍓", name: "Strawberries", calories: 50, protein: 1, carbs: 12, fats: 0, serving: "1 cup", tags: ["fruit", "berries"] },
  { id: "grapes", emoji: "🍇", name: "Grapes", calories: 104, protein: 1, carbs: 27, fats: 0, serving: "1 cup", tags: ["fruit"] },
  { id: "watermelon", emoji: "🍉", name: "Watermelon", calories: 86, protein: 2, carbs: 22, fats: 0, serving: "2 cups", tags: ["fruit"] },
  { id: "avocado", emoji: "🥑", name: "Avocado", calories: 240, protein: 3, carbs: 12, fats: 22, serving: "1 whole", tags: ["fruit", "healthy fat"] },

  // ── Veg & salad ──
  { id: "salad", emoji: "🥗", name: "Green Salad", calories: 150, protein: 4, carbs: 12, fats: 9, serving: "1 bowl", tags: ["vegetables", "healthy"], featured: true },
  { id: "broccoli", emoji: "🥦", name: "Broccoli", calories: 55, protein: 4, carbs: 11, fats: 0, serving: "1 cup", tags: ["vegetables", "greens"] },
  { id: "carrot", emoji: "🥕", name: "Carrot", calories: 25, protein: 1, carbs: 6, fats: 0, serving: "1 medium", tags: ["vegetables"] },
  { id: "potato", emoji: "🥔", name: "Potato", calories: 161, protein: 4, carbs: 37, fats: 0, serving: "1 medium", tags: ["vegetables", "carbs"] },
  { id: "corn", emoji: "🌽", name: "Corn", calories: 88, protein: 3, carbs: 19, fats: 1, serving: "1 cob", tags: ["vegetables"] },

  // ── Protein ──
  { id: "chicken", emoji: "🍗", name: "Chicken", calories: 220, protein: 33, carbs: 0, fats: 9, serving: "1 breast", tags: ["protein", "meat", "poultry"], featured: true },
  { id: "steak", emoji: "🥩", name: "Steak", calories: 280, protein: 26, carbs: 0, fats: 19, serving: "150g", tags: ["protein", "meat", "beef"], featured: true },
  { id: "eggs", emoji: "🍳", name: "Eggs", calories: 155, protein: 13, carbs: 1, fats: 11, serving: "2 eggs", tags: ["protein", "breakfast"], featured: true },
  { id: "bacon", emoji: "🥓", name: "Bacon", calories: 180, protein: 12, carbs: 0, fats: 14, serving: "3 strips", tags: ["protein", "meat", "pork"] },
  { id: "fish", emoji: "🐟", name: "Fish", calories: 200, protein: 30, carbs: 0, fats: 8, serving: "1 fillet", tags: ["protein", "seafood", "salmon"] },
  { id: "shrimp", emoji: "🍤", name: "Shrimp", calories: 120, protein: 23, carbs: 1, fats: 2, serving: "100g", tags: ["protein", "seafood"] },
  { id: "tofu", emoji: "🧈", name: "Tofu", calories: 144, protein: 16, carbs: 3, fats: 8, serving: "150g", tags: ["protein", "vegan", "vegetarian"] },
  { id: "beans", emoji: "🫘", name: "Beans", calories: 200, protein: 13, carbs: 36, fats: 1, serving: "1 cup", tags: ["protein", "vegan", "legumes"] },

  // ── Carbs / grains ──
  { id: "rice", emoji: "🍚", name: "Rice", calories: 205, protein: 4, carbs: 45, fats: 0, serving: "1 cup", tags: ["carbs", "grain"], featured: true },
  { id: "bread", emoji: "🍞", name: "Bread", calories: 80, protein: 3, carbs: 15, fats: 1, serving: "1 slice", tags: ["carbs", "grain"] },
  { id: "pasta", emoji: "🍝", name: "Pasta", calories: 350, protein: 12, carbs: 65, fats: 4, serving: "1 plate", tags: ["carbs", "grain", "spaghetti"] },
  { id: "oats", emoji: "🥣", name: "Oatmeal", calories: 160, protein: 6, carbs: 27, fats: 3, serving: "1 bowl", tags: ["carbs", "breakfast", "cereal"] },
  { id: "bagel", emoji: "🥯", name: "Bagel", calories: 245, protein: 10, carbs: 48, fats: 2, serving: "1 bagel", tags: ["carbs", "breakfast"] },
  { id: "croissant", emoji: "🥐", name: "Croissant", calories: 230, protein: 5, carbs: 26, fats: 12, serving: "1 piece", tags: ["carbs", "breakfast", "pastry"] },
  { id: "pancakes", emoji: "🥞", name: "Pancakes", calories: 350, protein: 8, carbs: 55, fats: 11, serving: "3 pancakes", tags: ["breakfast", "carbs"] },

  // ── Dairy ──
  { id: "cheese", emoji: "🧀", name: "Cheese", calories: 113, protein: 7, carbs: 1, fats: 9, serving: "1 slice", tags: ["dairy"] },
  { id: "milk", emoji: "🥛", name: "Milk", calories: 122, protein: 8, carbs: 12, fats: 5, serving: "1 glass", tags: ["dairy", "drink"] },
  { id: "yogurt", emoji: "🍦", name: "Yogurt", calories: 150, protein: 9, carbs: 17, fats: 4, serving: "1 cup", tags: ["dairy", "breakfast"] },

  // ── Meals (combos) ──
  { id: "steak_rice", emoji: "🥩🍚", name: "Steak & Rice", calories: 485, protein: 30, carbs: 45, fats: 19, serving: "1 plate", tags: ["meal", "dinner"], featured: true },
  { id: "chicken_rice", emoji: "🍗🍚", name: "Chicken & Rice", calories: 425, protein: 37, carbs: 45, fats: 9, serving: "1 plate", tags: ["meal", "dinner", "lunch"], featured: true },
  { id: "chicken_salad", emoji: "🍗🥗", name: "Chicken Salad", calories: 370, protein: 37, carbs: 12, fats: 18, serving: "1 bowl", tags: ["meal", "lunch", "healthy"] },
  { id: "eggs_bacon", emoji: "🍳🥓", name: "Eggs & Bacon", calories: 335, protein: 25, carbs: 1, fats: 25, serving: "1 plate", tags: ["meal", "breakfast"] },
  { id: "eggs_toast", emoji: "🍳🍞", name: "Eggs on Toast", calories: 235, protein: 16, carbs: 16, fats: 12, serving: "1 plate", tags: ["meal", "breakfast"] },
  { id: "fish_veg", emoji: "🐟🥦", name: "Fish & Veggies", calories: 255, protein: 34, carbs: 11, fats: 8, serving: "1 plate", tags: ["meal", "dinner", "healthy"] },

  // ── Fast food / treats ──
  { id: "burger", emoji: "🍔", name: "Burger", calories: 550, protein: 25, carbs: 45, fats: 30, serving: "1 burger", tags: ["fast food", "meal"], featured: true },
  { id: "pizza", emoji: "🍕", name: "Pizza", calories: 285, protein: 12, carbs: 36, fats: 10, serving: "1 slice", tags: ["fast food"], featured: true },
  { id: "fries", emoji: "🍟", name: "Fries", calories: 365, protein: 4, carbs: 48, fats: 17, serving: "1 medium", tags: ["fast food", "snack"] },
  { id: "hotdog", emoji: "🌭", name: "Hot Dog", calories: 290, protein: 11, carbs: 23, fats: 17, serving: "1 hot dog", tags: ["fast food"] },
  { id: "taco", emoji: "🌮", name: "Taco", calories: 210, protein: 9, carbs: 21, fats: 10, serving: "1 taco", tags: ["fast food", "meal"] },
  { id: "burrito", emoji: "🌯", name: "Burrito", calories: 420, protein: 16, carbs: 52, fats: 16, serving: "1 burrito", tags: ["fast food", "meal"] },
  { id: "sushi", emoji: "🍣", name: "Sushi", calories: 255, protein: 9, carbs: 38, fats: 7, serving: "6 pieces", tags: ["meal", "seafood", "japanese"] },
  { id: "ramen", emoji: "🍜", name: "Ramen", calories: 440, protein: 12, carbs: 60, fats: 16, serving: "1 bowl", tags: ["meal", "noodles", "soup"] },
  { id: "sandwich", emoji: "🥪", name: "Sandwich", calories: 320, protein: 15, carbs: 35, fats: 13, serving: "1 sandwich", tags: ["meal", "lunch"] },

  // ── Snacks & sweets ──
  { id: "donut", emoji: "🍩", name: "Donut", calories: 250, protein: 3, carbs: 31, fats: 13, serving: "1 donut", tags: ["snack", "sweet", "dessert"] },
  { id: "cookie", emoji: "🍪", name: "Cookie", calories: 160, protein: 2, carbs: 22, fats: 8, serving: "1 cookie", tags: ["snack", "sweet", "dessert"] },
  { id: "chocolate", emoji: "🍫", name: "Chocolate", calories: 230, protein: 3, carbs: 25, fats: 13, serving: "1 bar", tags: ["snack", "sweet", "dessert"] },
  { id: "icecream", emoji: "🍨", name: "Ice Cream", calories: 270, protein: 5, carbs: 31, fats: 14, serving: "1 scoop", tags: ["snack", "sweet", "dessert"] },
  { id: "popcorn", emoji: "🍿", name: "Popcorn", calories: 110, protein: 3, carbs: 22, fats: 2, serving: "1 bowl", tags: ["snack"] },
  { id: "nuts", emoji: "🥜", name: "Nuts", calories: 200, protein: 7, carbs: 7, fats: 18, serving: "1 handful", tags: ["snack", "healthy fat"] },

  // ── Drinks ──
  { id: "coffee", emoji: "☕", name: "Coffee", calories: 5, protein: 0, carbs: 1, fats: 0, serving: "1 cup", tags: ["drink"] },
  { id: "smoothie", emoji: "🥤", name: "Smoothie", calories: 210, protein: 5, carbs: 42, fats: 3, serving: "1 cup", tags: ["drink", "breakfast"] },
  { id: "soda", emoji: "🧋", name: "Soda / Boba", calories: 230, protein: 0, carbs: 58, fats: 0, serving: "1 cup", tags: ["drink", "sweet"] },
  { id: "beer", emoji: "🍺", name: "Beer", calories: 154, protein: 2, carbs: 13, fats: 0, serving: "1 can", tags: ["drink", "alcohol"] },
];

/** Foods shown in the gamified quick-add row. */
export const FEATURED_FOODS = FOODS.filter((f) => f.featured);

/** Simple name/tag search over the food list. */
export function searchFoods(query: string, limit = 30): FoodItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: FoodItem[] = [];
  for (const f of FOODS) {
    const hit =
      f.name.toLowerCase().includes(q) ||
      f.emoji.includes(q) ||
      (f.tags?.some((t) => t.includes(q)) ?? false);
    if (hit) {
      out.push(f);
      if (out.length >= limit) break;
    }
  }
  return out;
}

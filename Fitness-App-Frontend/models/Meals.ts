import { Database, Model, Q } from "@nozbe/watermelondb";
import { field, text } from "@nozbe/watermelondb/decorators";
import database from "@/database/database";
import UserData from "./DTO/UserDTO";
import UserDTO from "./DTO/UserDTO";
import { User } from "./User";

export class Meal extends Model {
  static table = "meals";

  @field("user_id") userId: string;
  @field("meal_name") mealName: string;
  @field("calories") calories: number;
  @field("protein") protein: number;
  @field("carbohydrates") carbohydrates: number;
  @field("fats") fats: number;
  @field("label") label: string;
  @field("created_at") createdAt: number;
  @field("health_score") healthScore: number;
  @field("one_emoji") oneEmoji:string;
 

static async createMeal(database: Database, mealData: { userId: string; mealName: string; calories: number; protein: number; carbohydrates: number; fats: number; label: string; createdAt: number; healthScore: number; oneEmoji:string; }): Promise<Meal> {
  return await database.write(async () => {
    return await database.get<Meal>("meals").create((meal) => {
      meal.userId = mealData.userId;
      meal.mealName = mealData.mealName;
      meal.calories = mealData.calories;
      meal.protein = mealData.protein;
      meal.carbohydrates = mealData.carbohydrates;
      meal.fats = mealData.fats;
      meal.label = mealData.label;
      meal.createdAt = mealData.createdAt;
      meal.healthScore = mealData.healthScore;
      meal.oneEmoji = mealData.oneEmoji;
    });
  });
}

static async getAllMeals(database: Database): Promise<Meal[]> {
  return await database.get<Meal>("meals").query().fetch();
}

static async getTodayMeals(database: Database, userId?: string): Promise<Meal[]> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime();

  const query = userId 
    ? Q.and(
        Q.where("user_id", userId),
        Q.where("created_at", Q.between(startOfDay, endOfDay))
      )
    : Q.where("created_at", Q.between(startOfDay, endOfDay));

  return await database.get<Meal>("meals").query(query).fetch();
}

static async deleteMealsForUser(database: Database, userId: string): Promise<void> {
  await database.write(async () => {
    const userMeals = await database.get<Meal>("meals").query(Q.where("user_id", userId)).fetch();
    await Promise.all(userMeals.map((meal) => meal.destroyPermanently()));
  });
}

static async DaySumCalories(database: Database, userId?: string, date?: Date): Promise<number> {
  const startOfDay = date ? new Date(date.setHours(0, 0, 0, 0)).getTime() : 0;
  const endOfDay = date ? new Date(date.setHours(23, 59, 59, 999)).getTime() : 0;

  const query = userId
    ? Q.and(
        Q.where("user_id", userId),
        Q.where("created_at", Q.between(startOfDay, endOfDay))
      )
    : Q.where("created_at", Q.between(startOfDay, endOfDay));

  const meals = await database.get<Meal>("meals").query(query).fetch();
  return meals.reduce((sum, meal) => sum + meal.calories, 0);
}

static async DaySuccesfulCalorieIntake(database: Database, userId: string, date?: Date): Promise<boolean> {
  const targetDate = date || new Date();
  const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0)).getTime();
  const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999)).getTime();

  // Check if there are any meals for this day
  const mealsQuery = Q.and(
    Q.where("user_id", userId),
    Q.where("created_at", Q.between(startOfDay, endOfDay))
  );
  const meals = await database.get<Meal>("meals").query(mealsQuery).fetch();
  
  // If no meals, day is unsuccessful
  if (meals.length === 0) {
    return false;
  }

  // If meals exist, check if total calories are within ±20% of target
  const user = await database.get<User>("user").query(Q.where("user_id", userId)).fetch();
  const caloricIntake = user[0]?.caloricIntake || 0;
  // Calculate total calories using the meals we already fetched or helper
  const totalCalories = meals.reduce((acc, m) => acc + m.calories, 0);
  
  // 70% of goal met
  const lowerBound = caloricIntake * 0.7;
  return totalCalories > 0 && totalCalories >= lowerBound;
}

static async deleteMealById(database: Database, id: string): Promise<void> {
  await database.write(async () => {
    const meal = await database.get<Meal>("meals").find(id);
    await meal.destroyPermanently();
  });
}

// Most recent scanned meals (label "scan"), de-duped by name, newest first.
static async getRecentScannedMeals(database: Database, userId: string, limit = 10): Promise<Meal[]> {
  const meals = await database
    .get<Meal>("meals")
    .query(
      Q.and(Q.where("user_id", userId), Q.where("label", "scan")),
      Q.sortBy("created_at", Q.desc)
    )
    .fetch();

  const seen = new Set<string>();
  const out: Meal[] = [];
  for (const m of meals) {
    const key = (m.mealName || "").toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}

// Calories per day for the CURRENT calendar month. Returns one entry per day of
// the month (index 0 = the 1st); days after today are 0 (future). `todayIndex`
// is today's day-of-month minus one.
static async getMonthCalorieTotals(
  database: Database,
  userId: string
): Promise<{ totals: number[]; todayIndex: number }> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIndex = now.getDate() - 1;
  const monthStart = new Date(year, month, 1).getTime();
  const monthEnd = new Date(year, month + 1, 1).getTime();

  const meals = await database
    .get<Meal>("meals")
    .query(Q.and(Q.where("user_id", userId), Q.where("created_at", Q.between(monthStart, monthEnd))))
    .fetch();

  const dayMs = 24 * 60 * 60 * 1000;
  const totals = new Array<number>(daysInMonth).fill(0);
  for (const m of meals) {
    const idx = Math.floor((m.createdAt - monthStart) / dayMs);
    if (idx >= 0 && idx < daysInMonth) totals[idx] += m.calories;
  }
  return { totals, todayIndex };
}

}

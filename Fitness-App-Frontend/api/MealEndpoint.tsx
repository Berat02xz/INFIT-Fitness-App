import axiosInstance from "./AxiosInstance";

export const MealEndpoint = {
  createMeal: async (mealData: {
    UserId: string;
    MealName: string;
    Calories: number;
    Carbohydrates: number;
    Fats: number;
    Label: string;
    Emojis?: string[];
    OneEmoji?: string;
    oneEmoji?: string;
  }) => {
    const response = await axiosInstance.post("/api/Meal/AddMeal", mealData);
    return response.data;
  },

  getMeals: async (userId: string) => {
    const response = await axiosInstance.get(`/api/Meal/GetMealsByUserId/${userId}`);
    return response.data;
  },

  deleteMeal: async (mealId: string) => {
    const response = await axiosInstance.delete(`/api/Meal/DeleteMeal/${mealId}`);
    return response.data;
  },
};

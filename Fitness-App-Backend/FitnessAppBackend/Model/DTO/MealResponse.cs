namespace FitnessAppBackend.Model.DTO
{
    public class MealResponse
    {
        public bool IsMeal { get; set; }
        public string ShortMealName { get; set; } = string.Empty;
        public int CaloriesAmount { get; set; }
        public int Protein { get; set; }
        public int Carbs { get; set; }
        public int Fat { get; set; } 
        public int HealthScoreOutOf10 { get; set; }
        public string MealQuality { get; set; } = string.Empty;
        public List<string> Emojis { get; set; } = [];
        public string OneEmoji => string.Concat(Emojis);
    }
}

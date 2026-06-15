using System.Globalization;

namespace FitnessAppBackend.Service
{
    public static class MealEmojiFormatter
    {
        public const string FallbackEmoji = "🍽️";
        public const int MaxEmojis = 4;

        public static List<string> Normalize(IEnumerable<string>? emojis)
        {
            var normalized = emojis?
                .Where(emoji => !string.IsNullOrWhiteSpace(emoji))
                .SelectMany(emoji => SplitTextElements(emoji.Trim()))
                .Distinct()
                .Take(MaxEmojis)
                .ToList() ?? [];

            return normalized.Count > 0 ? normalized : [FallbackEmoji];
        }

        public static string Combine(IEnumerable<string>? emojis)
        {
            return string.Concat(Normalize(emojis));
        }

        private static IEnumerable<string> SplitTextElements(string value)
        {
            var enumerator = StringInfo.GetTextElementEnumerator(value);
            while (enumerator.MoveNext())
            {
                if (enumerator.Current is string element && !string.IsNullOrWhiteSpace(element))
                {
                    yield return element;
                }
            }
        }
    }
}

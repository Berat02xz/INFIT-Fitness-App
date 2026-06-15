const FALLBACK_MEAL_EMOJI = "🍽️";
const MAX_MEAL_EMOJIS = 4;

export function splitMealEmojis(value: string | null | undefined): string[] {
  const text = value?.trim();
  if (!text) return [];

  const Segmenter = (Intl as any).Segmenter;
  if (Segmenter) {
    const segments = new Segmenter(undefined, { granularity: "grapheme" }).segment(text);
    return Array.from(segments, (entry: any) => entry.segment)
      .filter((glyph) => glyph.trim())
      .slice(0, MAX_MEAL_EMOJIS);
  }

  return Array.from(text)
    .filter((glyph) => glyph !== "\uFE0F")
    .slice(0, MAX_MEAL_EMOJIS);
}

export function normalizeMealEmojis(value: unknown): string {
  const values = Array.isArray(value) ? value : [value];
  const glyphs = values.flatMap((entry) =>
    typeof entry === "string" ? splitMealEmojis(entry) : []
  );

  return glyphs.slice(0, MAX_MEAL_EMOJIS).join("") || FALLBACK_MEAL_EMOJI;
}

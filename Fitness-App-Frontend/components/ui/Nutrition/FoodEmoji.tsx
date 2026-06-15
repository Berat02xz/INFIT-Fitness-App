import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { splitMealEmojis } from "@/utils/mealEmojis";

// ─── Food emoji ──────────────────────────────────────────────────────────────
// Renders a food's emoji consistently everywhere (dial, logged bubbles, detail).
// A combo food encodes two glyphs in one string (e.g. "🥩🍚"); we split on real
// glyph boundaries and stack them as a little overlapped "plate" of two so they
// read as one dish and never appear cut off.

export default function FoodEmoji({
  emoji,
  size,
}: {
  emoji: string;
  size: number;
}): React.JSX.Element {
  const glyphs = useMemo(() => splitMealEmojis(emoji), [emoji]);

  if (glyphs.length >= 2) {
    const g = size * (glyphs.length === 2 ? 0.66 : 0.52);
    const box = size * 1.38;
    const positions =
      glyphs.length === 2
        ? [
            { x: -0.34, y: -0.24, rotate: "-14deg" },
            { x: 0.34, y: 0.24, rotate: "13deg" },
          ]
        : glyphs.length === 3
          ? [
              { x: 0, y: -0.38, rotate: "-4deg" },
              { x: -0.38, y: 0.3, rotate: "-12deg" },
              { x: 0.38, y: 0.3, rotate: "12deg" },
            ]
          : [
              { x: -0.34, y: -0.34, rotate: "-10deg" },
              { x: 0.34, y: -0.34, rotate: "8deg" },
              { x: -0.34, y: 0.34, rotate: "8deg" },
              { x: 0.34, y: 0.34, rotate: "-8deg" },
            ];

    return (
      <View style={[styles.combo, { width: box, height: box }]}>
        {glyphs.map((glyph, index) => {
          const position = positions[index];
          return (
            <Text
              key={`${glyph}-${index}`}
              allowFontScaling={false}
              style={[
                styles.glyph,
                {
                  fontSize: g,
                  transform: [
                    { translateX: g * position.x },
                    { translateY: g * position.y },
                    { rotate: position.rotate },
                  ],
                },
              ]}
            >
              {glyph}
            </Text>
          );
        })}
      </View>
    );
  }

  return (
    <Text allowFontScaling={false} style={{ fontSize: size, textAlign: "center" }}>
      {emoji}
    </Text>
  );
}

const styles = StyleSheet.create({
  combo: { alignItems: "center", justifyContent: "center" },
  glyph: { position: "absolute" },
});

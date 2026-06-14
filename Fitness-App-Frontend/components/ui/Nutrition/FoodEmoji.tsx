import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

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
  const glyphs = useMemo(() => Array.from(emoji), [emoji]);

  if (glyphs.length >= 2) {
    const g = size * 0.66;
    const box = size * 1.34;
    return (
      <View style={[styles.combo, { width: box, height: box }]}>
        <Text
          allowFontScaling={false}
          style={[
            styles.glyph,
            { fontSize: g, transform: [{ translateX: -g * 0.36 }, { translateY: -g * 0.25 }, { rotate: "-14deg" }] },
          ]}
        >
          {glyphs[0]}
        </Text>
        <Text
          allowFontScaling={false}
          style={[
            styles.glyph,
            { fontSize: g, transform: [{ translateX: g * 0.36 }, { translateY: g * 0.25 }, { rotate: "13deg" }] },
          ]}
        >
          {glyphs[1]}
        </Text>
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

import React, { useEffect, useRef } from "react";
import { Animated, Text, TextStyle } from "react-native";

interface Props {
  text: string;
  style?: TextStyle;
  /** Milliseconds between each word's animation start */
  staggerMs?: number;
  /** How long each word's fade takes */
  durationMs?: number;
}

/**
 * Renders text as a sequence of words that fade in as the text string grows.
 * Safe for streaming: as `text` grows, only the newly-added words animate;
 * previously-shown words remain at opacity 1.
 *
 * Works at block level (wraps like a paragraph). Use inside a <View>.
 */
export default function AnimatedWords({
  text,
  style,
  staggerMs = 32,
  durationMs = 210,
}: Props): React.JSX.Element {
  // Split on whitespace, keeping the delimiter so spaces are preserved
  const tokens = text ? text.split(/(\s+)/) : [];

  // Ref-based anim array — grows synchronously during render (ref mutation is OK)
  const animsRef = useRef<Animated.Value[]>([]);
  // How many tokens have been triggered for animation already
  const triggeredRef = useRef(0);

  // Grow anim array synchronously so it always matches tokens length
  while (animsRef.current.length < tokens.length) {
    animsRef.current.push(new Animated.Value(0));
  }

  // After each render where new tokens appeared, kick off their animation
  useEffect(() => {
    const from = triggeredRef.current;
    const to = animsRef.current.length;
    if (to <= from) return;

    const newAnims = animsRef.current.slice(from);
    Animated.stagger(
      staggerMs,
      newAnims.map((a) =>
        Animated.timing(a, { toValue: 1, duration: durationMs, useNativeDriver: true }),
      ),
    ).start();

    triggeredRef.current = to;
  });

  const anims = animsRef.current;

  return (
    <Text style={style}>
      {tokens.map((token, i) => (
        <Animated.Text key={i} style={{ opacity: anims[i] ?? 1 }}>
          {token}
        </Animated.Text>
      ))}
    </Text>
  );
}

import React from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Linking } from "react-native";
import { ExerciseApi } from "@/api/ExerciseApi";
import { theme } from "@/constants/theme";

// ─── HTML parser + renderer ───────────────────────────────────────────────────
// Shared between the full Chatbot screen and any other consumer (e.g. islands).
// The AI endpoint returns lightweight HTML; we parse it into a node tree and
// render it as styled React Native elements.

type TextNode = { type: "text"; value: string };
type ElementNode = { type: "element"; tag: string; children: HtmlNode[] };
type HtmlNode = TextNode | ElementNode;

const ALLOWED_TAGS = new Set([
  "food", "exercise", "b", "i", "p", "ul", "li",
  "table", "tr", "td", "th", "thead", "tbody", "h1", "span", "br",
]);

function parseHtmlToNodes(html: string): HtmlNode[] {
  const root: ElementNode = { type: "element", tag: "root", children: [] };
  const stack: ElementNode[] = [root];
  const tagRx = /<\/?\s*([a-zA-Z0-9]+)(?:\s[^>]*)?\s*\/?\s*>/g;
  let lastIdx = 0;

  const top = () => stack[stack.length - 1];
  const pushText = (v: string) => { if (v) top().children.push({ type: "text", value: v }); };

  let m: RegExpExecArray | null;
  while ((m = tagRx.exec(html)) !== null) {
    const token = m[0];
    const tag = (m[1] || "").toLowerCase();
    pushText(html.slice(lastIdx, m.index));
    lastIdx = m.index + token.length;

    const isClosing = token[1] === "/";
    const isSelf = tag === "br" || token.includes("/>");

    if (!ALLOWED_TAGS.has(tag)) { pushText(token); continue; }
    if (isSelf) { if (tag === "br") pushText("\n"); continue; }
    if (!isClosing) {
      const node: ElementNode = { type: "element", tag, children: [] };
      top().children.push(node);
      stack.push(node);
    } else {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) { stack.splice(i); break; }
      }
    }
  }
  pushText(html.slice(lastIdx));
  return root.children;
}

function collectText(nodes: HtmlNode[]): string {
  return nodes.map((n) => (n.type === "text" ? n.value : collectText(n.children))).join("");
}

/** Strip all HTML tags and normalise whitespace — used by the island for plain-text display. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function renderNodes(
  nodes: HtmlNode[],
  prefix: string,
  inTable = false,
): React.ReactNode[] {
  let k = 0;
  const key = () => `${prefix}-${k++}`;
  const out: React.ReactNode[] = [];

  for (const node of nodes) {
    if (node.type === "text") {
      const v = node.value.replace(/\s+/g, " ");
      if (!v.trim()) continue;
      out.push(
        <Text key={key()} style={inTable ? s.tableText : s.msgText}>{v}</Text>,
      );
      continue;
    }

    const { tag, children } = node;
    switch (tag) {
      case "food":
        out.push(
          <TouchableOpacity key={key()} style={s.foodPill} activeOpacity={0.7} onPress={() => {}}>
            <MaterialCommunityIcons name="magnify" size={12} color="#30D158" />
            <Text style={s.foodPillText}>{collectText(children).trim()}</Text>
          </TouchableOpacity>,
        );
        break;

      case "exercise": {
        const name = collectText(children).trim();
        out.push(
          <TouchableOpacity
            key={key()} style={s.exercisePill} activeOpacity={0.7}
            onPress={async () => {
              try {
                const { exercises } = await ExerciseApi.searchExercises(name, 1);
                if (exercises.length > 0) {
                  const ex = exercises[0];
                  router.push({ pathname: "/ExerciseDetail", params: { exerciseId: ex.exerciseId, name: ex.name, gifUrl: ex.gifUrl || "" } });
                } else {
                  Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(name + " exercise")}`);
                }
              } catch {
                Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(name + " exercise")}`);
              }
            }}
          >
            <MaterialCommunityIcons name="dumbbell" size={12} color="#FF9F0A" />
            <Text style={s.exercisePillText}>{name}</Text>
          </TouchableOpacity>,
        );
        break;
      }

      case "h1":
        out.push(
          <View key={key()} style={s.h1Wrap}>
            <Text style={s.h1}>{collectText(children).trim()}</Text>
          </View>,
        );
        break;

      case "p":
        out.push(
          <View key={key()} style={s.paragraph}>
            <View style={s.inline}>{renderNodes(children, key(), inTable)}</View>
          </View>,
        );
        break;

      case "ul":
        out.push(<View key={key()} style={s.list}>{renderNodes(children, key(), inTable)}</View>);
        break;

      case "li":
        out.push(
          <View key={key()} style={s.listItem}>
            <Text style={inTable ? s.tableText : s.msgText}>{"• "}</Text>
            <View style={s.inline}>{renderNodes(children, key(), inTable)}</View>
          </View>,
        );
        break;

      case "table":
        out.push(
          <ScrollView key={key()} horizontal showsHorizontalScrollIndicator={false} style={s.tableScroll}>
            <View style={s.table}>{renderNodes(children, key(), true)}</View>
          </ScrollView>,
        );
        break;

      case "thead":
      case "tbody":
        out.push(...renderNodes(children, key(), inTable));
        break;

      case "tr":
        out.push(<View key={key()} style={s.tableRow}>{renderNodes(children, key(), inTable)}</View>);
        break;

      case "td":
      case "th":
        out.push(
          <View key={key()} style={[s.tableCell, tag === "th" ? s.tableHeaderCell : undefined]}>
            <View style={s.inline}>{renderNodes(children, key(), inTable)}</View>
          </View>,
        );
        break;

      case "b":
        out.push(
          <Text key={key()} style={[inTable ? s.tableText : s.msgText, { fontFamily: theme.bold }]}>
            {collectText(children)}
          </Text>,
        );
        break;

      case "i":
        out.push(
          <Text key={key()} style={[inTable ? s.tableText : s.msgText, { fontStyle: "italic" }]}>
            {collectText(children)}
          </Text>,
        );
        break;

      default:
        out.push(<Text key={key()} style={inTable ? s.tableText : s.msgText}>{collectText(children)}</Text>);
    }
  }
  return out;
}

/** Parse AI HTML response and return a renderable React node. */
export function parseHtmlResponse(html: string): React.ReactNode {
  if (!html) return null;
  const nodes = parseHtmlToNodes(html);
  const rendered = renderNodes(nodes, "html");
  return rendered.length
    ? <View style={s.inline}>{rendered}</View>
    : <Text style={s.msgText}>{html}</Text>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const C = { text: "#FFFFFF", sub: "#8E8E93", border: "#2C2C2E", card: "#1C1C1E" };

const s = StyleSheet.create({
  msgText: { fontSize: 15, fontFamily: theme.regular, color: C.text, lineHeight: 22 },
  inline: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4, width: "100%" },

  foodPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(48,209,88,0.15)", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 12, marginVertical: 2, borderWidth: 1, borderColor: "rgba(48,209,88,0.3)",
  },
  foodPillText: { fontSize: 11, fontFamily: theme.medium, color: "#30D158" },

  exercisePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,159,10,0.15)", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 12, marginVertical: 2, borderWidth: 1, borderColor: "rgba(255,159,10,0.3)",
  },
  exercisePillText: { fontSize: 11, fontFamily: theme.medium, color: "#FF9F0A" },

  h1Wrap: { width: "100%", marginTop: 12, marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  h1: { fontSize: 20, fontFamily: theme.bold, color: C.text, letterSpacing: -0.4, lineHeight: 26 },

  paragraph: { width: "100%", marginVertical: 4 },
  list: { marginVertical: 4 },
  listItem: { flexDirection: "row", alignItems: "flex-start", marginVertical: 2 },

  tableScroll: { marginVertical: 8 },
  table: { borderRadius: 10, borderWidth: 1, borderColor: C.border, overflow: "hidden", backgroundColor: C.card },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#3A3A3C" },
  tableCell: { width: 110, paddingVertical: 8, paddingHorizontal: 8, borderRightWidth: 1, borderRightColor: "#3A3A3C", justifyContent: "center" },
  tableHeaderCell: { backgroundColor: "#2C2C2E" },
  tableText: { fontSize: 11, fontFamily: theme.regular, color: "#D1D1D6", lineHeight: 14 },
});

import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { DrumPicker } from "@/components/ui/Onboarding/DrumPicker";
import { theme } from "@/constants/theme";

// ─── Settings editors ────────────────────────────────────────────────────────
// Self-contained editor views shown inside the ask-bar island. Weight / height /
// age reuse the onboarding ruler DrumPicker; the rest are simple option lists.
// Each editor owns its local state and calls back with the chosen value — the
// Profile screen does the DB write, closes the island and celebrates.

type Unit = "metric" | "imperial";

const PRIMARY = "#AAFB05";
const ITEM_WIDTH = 14;

// Heights the island should expand to for each editor type. Rows with a sub-label
// (e.g. calorie plans) are taller, so callers pass `hasSub` for those.
export const RULER_EDITOR_HEIGHT = 296;
export const optionEditorHeight = (count: number, hasSub = false) =>
  66 + count * (hasSub ? 64 : 50);

// ── ranges (mirroring onboarding) ──
const W_METRIC = Array.from({ length: 171 }, (_, i) => i + 30); // 30–200 kg
const W_IMPERIAL = Array.from({ length: 375 }, (_, i) => i + 66); // 66–440 lb
const H_METRIC = Array.from({ length: 151 }, (_, i) => i + 100); // 100–250 cm
const H_IMPERIAL = Array.from({ length: 37 }, (_, i) => i + 48); // 48–84 in
const AGE_ITEMS = Array.from({ length: 88 }, (_, i) => i + 13); // 13–100 yrs

const clampIdx = (v: number, len: number) => Math.max(0, Math.min(v, len - 1));
const fmtImperialHeight = (totalInches: number) =>
  `${Math.floor(totalInches / 12)}'${totalInches % 12}"`;

// ── shared pieces ──
function Title({ children }: { children: string }) {
  return <Text style={st.title}>{children}</Text>;
}

function Tick({ value, tall, med }: { value: number; tall: number; med: number }) {
  const isTall = value % tall === 0;
  const isMed = value % med === 0 && !isTall;
  const h = isTall ? 44 : isMed ? 30 : 22;
  return (
    <View style={st.tickWrap}>
      <View style={[st.tick, { height: h, opacity: isTall ? 1 : isMed ? 0.7 : 0.4 }]} />
    </View>
  );
}

function Ruler({
  items,
  selectedIndex,
  onChange,
  tall,
  med,
  drumKey,
}: {
  items: number[];
  selectedIndex: number;
  onChange: (i: number) => void;
  tall: number;
  med: number;
  drumKey: string;
}) {
  return (
    <View style={st.pickerWrap}>
      <View style={st.centerLine} pointerEvents="none" />
      <DrumPicker
        key={drumKey}
        data={items}
        itemWidth={ITEM_WIDTH}
        defaultIndex={selectedIndex}
        height={96}
        onChange={onChange}
        renderItem={(item: number) => <Tick value={item} tall={tall} med={med} />}
      />
    </View>
  );
}

function UnitToggle({
  unit,
  metricLabel,
  imperialLabel,
  onChange,
}: {
  unit: Unit;
  metricLabel: string;
  imperialLabel: string;
  onChange: (u: Unit) => void;
}) {
  return (
    <View style={st.toggle}>
      <TouchableOpacity
        style={[st.toggleBtn, unit === "metric" && st.toggleBtnActive]}
        onPress={() => onChange("metric")}
        activeOpacity={0.8}
      >
        <Text style={[st.toggleText, unit === "metric" && st.toggleTextActive]}>{metricLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[st.toggleBtn, unit === "imperial" && st.toggleBtnActive]}
        onPress={() => onChange("imperial")}
        activeOpacity={0.8}
      >
        <Text style={[st.toggleText, unit === "imperial" && st.toggleTextActive]}>{imperialLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function SaveButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={st.save} onPress={onPress} activeOpacity={0.85}>
      <Text style={st.saveText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Weight ──
export function WeightEditor({
  initialWeight,
  initialUnit,
  onSave,
}: {
  initialWeight: number;
  initialUnit: Unit;
  onSave: (weight: number, unit: Unit) => void;
}) {
  const [unit, setUnit] = useState<Unit>(initialUnit);
  const items = unit === "metric" ? W_METRIC : W_IMPERIAL;
  const min = unit === "metric" ? 30 : 66;
  const [idx, setIdx] = useState(() => clampIdx(Math.round(initialWeight) - min, items.length));
  const val = items[idx] ?? min;

  const toggle = (u: Unit) => {
    if (u === unit) return;
    const cur = items[idx] ?? min;
    if (u === "imperial") setIdx(clampIdx(Math.round(cur * 2.20462) - 66, W_IMPERIAL.length));
    else setIdx(clampIdx(Math.round(cur / 2.20462) - 30, W_METRIC.length));
    setUnit(u);
  };

  return (
    <View style={st.center}>
      <Title>Weight</Title>
      <View style={st.pill}>
        <Text style={st.pillValue}>{val}</Text>
        <Text style={st.pillUnit}>{unit === "metric" ? "kg" : "lb"}</Text>
      </View>
      <Ruler items={items} selectedIndex={idx} onChange={setIdx} tall={10} med={5} drumKey={unit} />
      <UnitToggle unit={unit} metricLabel="kg" imperialLabel="lb" onChange={toggle} />
      <SaveButton label="Save Weight" onPress={() => onSave(val, unit)} />
    </View>
  );
}

// ── Height ── (value is cm in metric, total inches in imperial)
export function HeightEditor({
  initialValue,
  initialUnit,
  onSave,
}: {
  initialValue: number;
  initialUnit: Unit;
  onSave: (value: number, unit: Unit) => void;
}) {
  const [unit, setUnit] = useState<Unit>(initialUnit);
  const items = unit === "metric" ? H_METRIC : H_IMPERIAL;
  const min = unit === "metric" ? 100 : 48;
  const [idx, setIdx] = useState(() => clampIdx(Math.round(initialValue) - min, items.length));
  const val = items[idx] ?? min;

  const toggle = (u: Unit) => {
    if (u === unit) return;
    const cur = items[idx] ?? min;
    if (u === "imperial") setIdx(clampIdx(Math.round(cur / 2.54) - 48, H_IMPERIAL.length));
    else setIdx(clampIdx(Math.round(cur * 2.54) - 100, H_METRIC.length));
    setUnit(u);
  };

  return (
    <View style={st.center}>
      <Title>Height</Title>
      <View style={st.pill}>
        <Text style={st.pillValue}>{unit === "imperial" ? fmtImperialHeight(val) : val}</Text>
        <Text style={st.pillUnit}>{unit === "metric" ? "cm" : ""}</Text>
      </View>
      <Ruler
        items={items}
        selectedIndex={idx}
        onChange={setIdx}
        tall={unit === "imperial" ? 12 : 10}
        med={unit === "imperial" ? 6 : 5}
        drumKey={unit}
      />
      <UnitToggle unit={unit} metricLabel="cm" imperialLabel="ft" onChange={toggle} />
      <SaveButton label="Save Height" onPress={() => onSave(val, unit)} />
    </View>
  );
}

// ── Age ──
export function AgeEditor({
  initialAge,
  onSave,
}: {
  initialAge: number;
  onSave: (age: number) => void;
}) {
  const [idx, setIdx] = useState(() => clampIdx(Math.round(initialAge) - 13, AGE_ITEMS.length));
  const val = AGE_ITEMS[idx] ?? initialAge;
  return (
    <View style={st.center}>
      <Title>Age</Title>
      <View style={st.pill}>
        <Text style={st.pillValue}>{val}</Text>
        <Text style={st.pillUnit}>yrs</Text>
      </View>
      <Ruler items={AGE_ITEMS} selectedIndex={idx} onChange={setIdx} tall={10} med={5} drumKey="age" />
      <View style={{ height: 14 }} />
      <SaveButton label="Save Age" onPress={() => onSave(val)} />
    </View>
  );
}

// ── Generic option list (fitness level / equipment / calorie goal) ──
export type EditorOption = { label: string; value: string; sub?: string; badge?: string };

export function OptionEditor({
  title,
  options,
  selectedValue,
  onSelect,
}: {
  title: string;
  options: EditorOption[];
  selectedValue?: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View>
      <Title>{title}</Title>
      <View style={st.optList}>
        {options.map((o) => {
          const active = selectedValue === o.value;
          return (
            <TouchableOpacity
              key={o.value}
              style={[st.opt, active && st.optActive]}
              onPress={() => onSelect(o.value)}
              activeOpacity={0.8}
            >
              <View style={st.optTextWrap}>
                <Text style={[st.optLabel, active && st.optLabelActive]} numberOfLines={1}>{o.label}</Text>
                {o.sub ? <Text style={st.optSub}>{o.sub}</Text> : null}
              </View>
              {o.badge ? (
                <View style={st.badge}>
                  <Text style={st.badgeText}>{o.badge}</Text>
                </View>
              ) : null}
              {active ? <Ionicons name="checkmark-circle" size={18} color={PRIMARY} style={st.optCheck} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  center: { alignItems: "center" },
  title: { color: "#fff", fontFamily: theme.bold, fontSize: 15, alignSelf: "center", marginBottom: 4 },

  pill: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: "#1A1B1E",
    paddingVertical: 5,
    paddingHorizontal: 18,
    borderRadius: 30,
    marginTop: 4,
  },
  pillValue: { color: "#fff", fontFamily: theme.bold, fontSize: 30, letterSpacing: -1 },
  pillUnit: { color: "#8A8A8E", fontFamily: theme.medium, fontSize: 12, marginLeft: 5 },

  pickerWrap: { height: 96, width: "100%", justifyContent: "center", alignItems: "center", marginTop: 6 },
  centerLine: { position: "absolute", width: 3, height: 60, borderRadius: 2, backgroundColor: PRIMARY, zIndex: 1 },
  tickWrap: { width: ITEM_WIDTH, height: 96, justifyContent: "center", alignItems: "center" },
  tick: { width: 2, borderRadius: 1, backgroundColor: "#fff" },

  toggle: { flexDirection: "row", backgroundColor: "#1A1B1E", padding: 3, borderRadius: 30, marginTop: 10 },
  toggleBtn: { paddingVertical: 7, paddingHorizontal: 18, borderRadius: 24 },
  toggleBtnActive: { backgroundColor: "#fff" },
  toggleText: { fontFamily: theme.bold, fontSize: 12, color: "#8A8A8E" },
  toggleTextActive: { color: "#000" },

  save: {
    backgroundColor: PRIMARY,
    paddingVertical: 10,
    borderRadius: 24,
    alignItems: "center",
    alignSelf: "stretch",
    marginTop: 12,
  },
  saveText: { color: "#000", fontFamily: theme.bold, fontSize: 13 },

  // Push the list below the floating avatar / close-button zone, and keep rows
  // narrow + centred so they never sit under the avatar (left) or X (right).
  optList: { gap: 6, marginTop: 16, alignItems: "center" },
  opt: {
    width: "84%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#16181B",
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  optActive: { borderColor: PRIMARY, backgroundColor: "rgba(170,251,5,0.10)" },
  optTextWrap: { alignItems: "center", flexShrink: 1 },
  optLabel: { color: "#fff", fontFamily: theme.semibold, fontSize: 13.5, textAlign: "center" },
  optLabelActive: { color: PRIMARY },
  optSub: { color: "#8A8A8E", fontFamily: theme.regular, fontSize: 11, marginTop: 2, textAlign: "center" },
  optCheck: { position: "absolute", right: 14 },
  badge: { backgroundColor: PRIMARY, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9 },
  badgeText: { color: "#000", fontFamily: theme.bold, fontSize: 10 },
});

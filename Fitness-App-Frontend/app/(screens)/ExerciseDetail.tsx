import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import { ExerciseApi, type ExerciseInfo } from "@/api/ExerciseApi";
import FadeTranslate from "@/components/ui/FadeTranslate";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_W } = Dimensions.get("window");

const D = {
  bg: "#000000",
  primary: "#AAFB05",
  primaryDim: "rgba(170,251,5,0.15)",
  text: "#FFFFFF",
  sub: "#999999",
  muted: "#333333",
  card: "#121212",
  cardAlt: "#1C1C1E",
};

export default function ExerciseDetail() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    exerciseId: string;
    name: string;
    sets: string;
    reps: string;
    restSeconds: string;
    category: string;
    gifUrl: string;
  }>();

  const [exerciseInfo, setExerciseInfo] = useState<ExerciseInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.exerciseId) { setLoading(false); return; }
    (async () => {
      try {
        const info = await ExerciseApi.getExerciseById(params.exerciseId);
        setExerciseInfo(info);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [params.exerciseId]);

  const imageUri = exerciseInfo?.gifUrl || params.gifUrl || null;
  const displayName = exerciseInfo?.name || params.name || "Exercise";

  const cleanStepText = (text: string) => {
    let cleaned = text.replace(/^(?:Step\s*\d+\s*:\s*|\d+\.\s*)/i, "").trim();
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    return cleaned;
  };

  const capitalize = (str: string) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

  const tags: string[] = [];
  if (params.category || exerciseInfo?.bodyParts?.[0]) tags.push(capitalize(params.category || exerciseInfo?.bodyParts?.[0] || ""));
  exerciseInfo?.targetMuscles?.forEach(m => tags.push(capitalize(m)));
  exerciseInfo?.equipments?.forEach(eq => tags.push(capitalize(eq)));

  // Ensure unique tags
  const uniqueTags = Array.from(new Set(tags));

  return (
    <View style={s.container}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header Image Component (rounded bottom) */}
        <View style={[s.headerWrap]}>
          <LinearGradient
            colors={["#FFFFFF", "#EEEEEE"]} // Light background usually suits transparent gifs best
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.headerGradient}
          />
          
          <TouchableOpacity
            style={[s.backBtn, { top: insets.top + 8 }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>

          {/* Render GIF */}
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={s.heroImg}
              resizeMode="contain"
            />
          ) : (
            <View style={s.heroFallback}>
              <Ionicons name="barbell-outline" size={64} color="#333" />
            </View>
          )}

          {/* Fade overlay for header title readability (as the background is light gradient + image) */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.8)", "#000000"]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          <View style={s.headerOverlayContent}>
            <FadeTranslate order={0} direction="y" translateYFrom={15}>
              <Text style={s.headerTitle}>{capitalize(displayName)}</Text>
              <View style={s.tagsRowHeader}>
                {uniqueTags.map((t) => (
                  <View key={t} style={s.whiteTag}>
                    <Text style={s.whiteTagText}>{t}</Text>
                  </View>
                ))}
              </View>
            </FadeTranslate>
          </View>
        </View>

        {/* Content Wrapper */}
        <View style={s.contentWrapper}>
          <FadeTranslate order={0.1} delay={100} direction="y" translateYFrom={15}>
            {params.sets && (
              <>
                <Text style={s.sectionSubtitle}>WORKOUT STATS</Text>
                <View style={s.statsCard}>
                  <View style={s.statCol}>
                    <View style={s.statIconWrap}>
                       <Ionicons name="layers" size={14} color="#AAFB05" />
                    </View>
                    <View>
                      <Text style={s.statLabel}>Sets</Text>
                      <Text style={s.statVal}>{params.sets}</Text>
                    </View>
                  </View>

                  <View style={s.statDivider} />

                  <View style={s.statCol}>
                    <View style={s.statIconWrap}>
                       <Ionicons name="repeat" size={14} color="#AAFB05" />
                    </View>
                    <View>
                      <Text style={s.statLabel}>Reps</Text>
                      <Text style={s.statVal}>{params.reps}</Text>
                    </View>
                  </View>

                  <View style={s.statDivider} />

                  <View style={s.statCol}>
                    <View style={s.statIconWrap}>
                       <Ionicons name="timer" size={14} color="#AAFB05" />
                    </View>
                    <View>
                      <Text style={s.statLabel}>Rest</Text>
                      <Text style={s.statVal}>{params.restSeconds}s</Text>
                    </View>
                  </View>
                </View>
              </>
            )}

            {loading ? (
              <ActivityIndicator color={D.primary} style={{ marginTop: 40 }} />
            ) : exerciseInfo?.instructions?.length ? (
              <View style={s.descSection}>
                <Text style={s.sectionSubtitle}>EXECUTION GUIDE</Text>
                <View style={s.instructionsCard}>
                   {exerciseInfo.instructions.map((step, i) => {
                      const cleanStep = cleanStepText(step);
                      return (
                         <View key={i} style={[s.stepRow, i === exerciseInfo.instructions!.length - 1 ? { marginBottom: 0 } : { marginBottom: 20 }]}>
                           <View style={s.stepNumberWrap}>
                             <Text style={s.stepNumber}>{i + 1}</Text>
                           </View>
                           <View style={s.stepTextContainer}>
                             <Text style={s.descText}>{cleanStep}</Text>
                           </View>
                         </View>
                      );
                   })}
                </View>
              </View>
            ) : null}
          </FadeTranslate>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  backBtn: {
    position: "absolute",
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { },
  
  headerWrap: {
    width: SCREEN_W,
    height: SCREEN_W * 1.15,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroImg: {
    width: "80%",
    height: "80%",
    marginBottom: 60,
  },
  heroFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  headerOverlayContent: {
    position: "absolute",
    bottom: 24,
    left: 24,
    right: 24,
    zIndex: 2,
  },
  headerTitle: {
    fontFamily: theme.black,
    fontSize: 32,
    color: "#FFFFFF",
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  tagsRowHeader: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  whiteTag: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 4,
  },
  whiteTagText: {
    color: "#000000",
    fontFamily: theme.bold,
    fontSize: 12,
  },

  contentWrapper: {
    backgroundColor: "#000000",
    paddingHorizontal: 24,
    paddingTop: 32,
    minHeight: 500,
  },
  sectionSubtitle: {
    fontFamily: theme.bold,
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 2,
    marginBottom: 12,
    textTransform: "uppercase",
  },

  statsCard: {
    flexDirection: "row",
    backgroundColor: "#161616",
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  statCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(170,251,5,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: {
    fontSize: 12,
    fontFamily: theme.medium,
    color: "rgba(255,255,255,0.45)",
    marginBottom: 3,
  },
  statVal: {
    fontSize: 16,
    fontFamily: theme.bold,
    color: "#FFFFFF",
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginHorizontal: 8,
  },

  descSection: {
    marginTop: 8,
  },
  instructionsCard: {
    backgroundColor: "#161616",
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stepNumberWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(170,251,5,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    marginTop: 2,
  },
  stepNumber: {
    fontSize: 14,
    fontFamily: theme.bold,
    color: "#AAFB05",
  },
  stepTextContainer: {
    flex: 1,
  },
  descText: {
    fontSize: 15,
    fontFamily: theme.medium,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 24,
  },
});

import FadeTranslate from "@/components/ui/FadeTranslate";
import * as Clipboard from 'expo-clipboard';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Paywall } from '@/components/ui/RevenueCat/Paywall';
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Platform,
  Keyboard,
  ScrollView,
  Animated,
  BackHandler,
  Modal,
  Share,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { theme } from "@/constants/theme";
import { router, useFocusEffect } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { GetUserDetails } from "@/api/UserDataEndpoint";
import { Meal } from "@/models/Meals";
import database from "@/database/database";
import { getUserIdFromToken } from "@/api/TokenDecoder";
import { AIEndpoint } from "@/api/AIEndpoint";
import { SavedMessage } from "@/models/SavedMessage";
import { ExerciseApi } from "@/api/ExerciseApi";
import { Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "@/utils/haptics";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const NUTRITION_KEYWORDS = ["meal", "nutrition", "food", "recipes", "eat", "diet", "calorie", "protein", "carbs", "fat", "hungry", "breakfast", "lunch", "dinner"];
const FITNESS_KEYWORDS = ["fitness", "workout", "gym", "exercise", "training", "muscle", "cardio", "strength", "run", "lift", "weight"];

const GREETING_SUGGESTIONS = [
  { icon: "clock-fast", text: "15 min meals", color: "#22C55E" },
  { icon: "dumbbell", text: "Workout plan", color: "#EF4444" },
  { icon: "chef-hat", text: "Quick breakfast", color: "#F97316" },
  { icon: "fire", text: "How to burn calories", color: "#EF4444" },
  { icon: "food-apple", text: "Healthy snacks", color: "#22C55E" },
  { icon: "weight-lifter", text: "How to Build muscle", color: "#3B82F6" },
  { icon: "run-fast", text: "Cardio tips", color: "#F97316" },
  { icon: "food-drumstick", text: "High protein food", color: "#A855F7" },
  { icon: "scale-bathroom", text: "Lose weight plan", color: "#EC4899" },
  { icon: "yoga", text: "Stretching properly", color: "#14B8A6" },
  { icon: "food-variant", text: "Meal prep", color: "#22C55E" },
  { icon: "lightning-bolt", text: "Pre-workout tips list", color: "#FBBF24" },
  { icon: "sleep", text: "Recovery tips", color: "#6366F1" },
  { icon: "water", text: "Hydration importance", color: "#0EA5E9" },
  { icon: "arm-flex", text: "Arm workout", color: "#EF4444" },
];

const GREETING_VARIANTS = [
  () => `What can I help with?`,
  () => `How can I assist you?`,
  () => `What can I do for you?`,
  () => `How may I help you today?`,
  () => `What would you like to know?`,
];

const AI_VIDEOS = [
  require('@/assets/videos/AI.mp4'),
];

const PROFILE_AVATAR = require('@/assets/avatars/avatar1.jpg');



const THINKING_MESSAGES = [
  "Thinking...",
  "Reasoning...",
  "Analyzing your data...",
];

// Persist chat messages across component remounts (e.g. navigating to ExerciseDetail and back)
let _cachedMessages: Message[] = [];

type ChatbotProps = {
  /** When hosted outside the tab (e.g. workout chat mode), close instead of switching tabs. */
  onRequestClose?: () => void;
  /** Auto-send this message once on mount (seeded from the workout ask bar). */
  initialMessage?: string;
};

export default function Chatbot({ onRequestClose, initialMessage }: ChatbotProps = {}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation() as any;
  const [messages, setMessages] = useState<Message[]>(_cachedMessages);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showSavedMessages, setShowSavedMessages] = useState(false);
  const [savedMessages, setSavedMessages] = useState<SavedMessage[]>([]);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
  const [subscriptionPlan, setSubscriptionPlan] = useState("Free");
  const [showPaywall, setShowPaywall] = useState(false);
  const [dailyMessageCount, setDailyMessageCount] = useState(0);
  const FREE_DAILY_LIMIT = 10;
  const [greetingMessage, setGreetingMessage] = useState("What can I help with?");
  const [randomSuggestions, setRandomSuggestions] = useState<typeof GREETING_SUGGESTIONS>([]);
  // Pick one random video on mount and keep it for the session
  const selectedVideo = useRef(AI_VIDEOS[Math.floor(Math.random() * AI_VIDEOS.length)]).current;
  const videoPlayer = useVideoPlayer(selectedVideo, (player) => {
    player.loop = true;
    player.muted = true;
    player.volume = 0;
    player.audioMixingMode = 'mixWithOthers';
    if (Platform.OS === 'web') {
       player.play();
    }
  });
  const flatListRef = useRef<FlatList>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const thinkingOpacity = useRef(new Animated.Value(0.4)).current;

  // Keep module-level cache in sync with messages state
  useEffect(() => {
    _cachedMessages = messages;
  }, [messages]);

  // Load user data and handle back button/gesture
  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      
      const loadUserData = async () => {
        try {
          const user = await GetUserDetails();
          if (user?.name) {
            // Set random greeting
            const randomGreeting = GREETING_VARIANTS[Math.floor(Math.random() * GREETING_VARIANTS.length)];
            setGreetingMessage(randomGreeting());
          }
          if (user?.role) {
            setSubscriptionPlan(user.role);
          }
          // Pick 4 random suggestions
          const shuffled = [...GREETING_SUGGESTIONS].sort(() => Math.random() - 0.5);
          setRandomSuggestions(shuffled.slice(0, 4));
        } catch (error) {
          console.error("Error loading user data:", error);
        }
      };

      // Always ensure video plays when screen comes into focus
      if (videoPlayer) {
          videoPlayer.loop = true;
          videoPlayer.muted = true;
          videoPlayer.volume = 0;
          videoPlayer.audioMixingMode = 'mixWithOthers';
          // Small delay to ensure video is ready on web
           if(Platform.OS === 'web'){
               setTimeout(() => {
                if (mounted) {
                  videoPlayer.play();
                }
              }, 100);
           } else {
               videoPlayer.play();
           }
      }

      loadUserData();

      // Load today's message count from storage
      const loadDailyCount = async () => {
        try {
          const today = new Date().toISOString().split('T')[0];
          const stored = await AsyncStorage.getItem('chatbot_daily_count');
          if (stored) {
            const { date, count } = JSON.parse(stored);
            if (date === today) {
              setDailyMessageCount(count);
            } else {
              // New day — reset
              await AsyncStorage.setItem('chatbot_daily_count', JSON.stringify({ date: today, count: 0 }));
              setDailyMessageCount(0);
            }
          }
        } catch (e) {
          console.log('Failed to load daily count', e);
        }
      };
      loadDailyCount();

      const onBackPress = () => {
        if (onRequestClose) {
          onRequestClose();
          return true;
        }
        navigation.navigate("nutrition");
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        mounted = false;
        subscription.remove();
        // Pause when leaving screen to ensure clean state on return
        // try {
        //   videoPlayer.pause();
        // } catch (error) {
        //   console.log('Video player cleanup skipped:', error);
        // }
      };
    }, [videoPlayer])
  );

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e: any) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e?.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Animate loading state
  useEffect(() => {
    if (!isLoading) {
      thinkingOpacity.setValue(0.4);
      return;
    }

    // Start the spinning animation for the sync icon
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: false,
      })
    ).start();

    // Start the thinking text opacity animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(thinkingOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(thinkingOpacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    return () => {
      spinAnim.setValue(0);
      thinkingOpacity.setValue(0.4);
    };
  }, [isLoading]);

  const detectMessageCategory = (text: string): "nutrition" | "fitness" | "general" => {
    const lowerText = text.toLowerCase();
    const hasNutrition = NUTRITION_KEYWORDS.some(keyword => lowerText.includes(keyword));
    const hasFitness = FITNESS_KEYWORDS.some(keyword => lowerText.includes(keyword));

    if (hasNutrition && !hasFitness) return "nutrition";
    if (hasFitness && !hasNutrition) return "fitness";
    if (hasNutrition && hasFitness) return "nutrition"; // prioritize nutrition if both
    return "general";
  };

  const getContextualData = async (category: "nutrition" | "fitness" | "general") => {
    if (category === "general") return null;

    try {
      const userId = await getUserIdFromToken();
      if (!userId) return null;

      if (category === "nutrition") {
        const user = await GetUserDetails();
        const todayMeals = await Meal.getTodayMeals(database, userId);
        
        const totalCalories = todayMeals.reduce((sum, meal) => sum + meal.calories, 0);
        const totalProtein = todayMeals.reduce((sum, meal) => sum + meal.protein, 0);
        const totalCarbs = todayMeals.reduce((sum, meal) => sum + meal.carbohydrates, 0);
        const totalFats = todayMeals.reduce((sum, meal) => sum + meal.fats, 0);

        return {
          userWeight: user?.weight,
          userHeight: user?.height,
          bmr: user?.bmr,
          dailyCalorieGoal: user?.caloricIntake,
          caloriesConsumedToday: totalCalories,
          caloriesRemaining: (user?.caloricIntake || 0) - totalCalories,
          proteinToday: Math.round(totalProtein),
          carbsToday: Math.round(totalCarbs),
          fatsToday: Math.round(totalFats),
          mealsToday: todayMeals.length,
          mealsList: todayMeals.map(m => m.mealName).join(", "),
          goal: user?.goal,
          activityLevel: user?.activityLevel,
          unit: user?.unit,
        };
      }

      if (category === "fitness") {
        const user = await GetUserDetails();
        return {
          userWeight: user?.weight,
          userHeight: user?.height,
          goal: user?.goal,
          fitnessLevel: user?.fitnessLevel,
          activityLevel: user?.activityLevel,
          equipmentAccess: user?.equipmentAccess,
          bmr: user?.bmr,
          unit: user?.unit,
        };
      }
    } catch (error) {
      console.error("Error fetching contextual data:", error);
    }

    return null;
  };

  const highlightKeywords = (text: string) => {
    const words = text.split(/(\s+)/);
    return words.map((word, index) => {
      const cleanWord = word.toLowerCase().replace(/[.,!?]/g, "");
      const isNutrition = NUTRITION_KEYWORDS.includes(cleanWord);
      const isFitness = FITNESS_KEYWORDS.includes(cleanWord);

      if (isNutrition || isFitness) {
        return (
          <Text key={index} style={styles.boldKeyword}>
            {word}
          </Text>
        );
      }
      return <Text key={index}>{word}</Text>;
    });
  };

  // Parse HTML response and render styled components
  type HtmlNode = { type: 'text'; value: string } | { type: 'element'; tag: string; children: HtmlNode[] };

  const parseHtmlToNodes = (html: string): HtmlNode[] => {
    const allowedTags = new Set(['food', 'exercise', 'b', 'i', 'p', 'ul', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'h1', 'span', 'br']);
    const root: { type: 'element'; tag: 'root'; children: HtmlNode[] } = { type: 'element', tag: 'root', children: [] };
    const stack: Array<{ type: 'element'; tag: string; children: HtmlNode[] }> = [root];

    const tagTokenRegex = /<\/?\s*([a-zA-Z0-9]+)(?:\s[^>]*?)?\s*\/?\s*>/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    const pushText = (text: string) => {
      if (!text) return;
      stack[stack.length - 1].children.push({ type: 'text', value: text });
    };

    while ((match = tagTokenRegex.exec(html)) !== null) {
      const token = match[0];
      const tag = (match[1] || '').toLowerCase();
      const index = match.index;

      pushText(html.slice(lastIndex, index));
      lastIndex = index + token.length;

      const isClosing = /^\//.test(token.slice(1));
      const isSelfClosing = /\/?>\s*$/.test(token) && (tag === 'br' || token.includes('/>'));

      if (!allowedTags.has(tag)) {
        // Treat unknown tags as text instead of skipping
        pushText(token);
        continue;
      }

      if (isSelfClosing) {
        if (tag === 'br') pushText('\n');
        continue;
      }

      if (!isClosing) {
        const node: HtmlNode = { type: 'element', tag, children: [] };
        stack[stack.length - 1].children.push(node);
        stack.push(node as any);
      } else {
        for (let i = stack.length - 1; i > 0; i--) {
          if (stack[i].tag === tag) {
            stack.splice(i);
            break;
          }
        }
      }
    }

    pushText(html.slice(lastIndex));
    return root.children;
  };

  const collectText = (nodes: HtmlNode[]): string => {
    return nodes.map(n => (n.type === 'text' ? n.value : collectText(n.children))).join('');
  };

  const renderHtmlNodes = (nodes: HtmlNode[], keyPrefix: string, isInTable: boolean = false): React.ReactNode[] => {
    let keyCounter = 0;
    const nextKey = () => `${keyPrefix}-${keyCounter++}`;

    const out: React.ReactNode[] = [];
    for (const node of nodes) {
      if (node.type === 'text') {
        if (!node.value) continue;
        const normalized = node.value.replace(/\s+/g, ' ');
        if (!normalized.trim()) continue;
        out.push(<Text key={nextKey()} style={isInTable ? styles.tableText : styles.messageText}>{normalized}</Text>);
        continue;
      }

      const tag = node.tag;
      const children = node.children;

      switch (tag) {
        case 'food':
          out.push(
            <TouchableOpacity key={nextKey()} style={styles.foodPill} activeOpacity={0.7} onPress={() => {}}>
              <MaterialCommunityIcons name="magnify" size={12} color="#15803D" />
              <Text style={styles.foodPillText}>{collectText(children).trim()}</Text>
            </TouchableOpacity>
          );
          break;
        case 'exercise': {
          const exerciseName = collectText(children).trim();
          const handleExercisePillPress = async () => {
            try {
              const { exercises } = await ExerciseApi.searchExercises(exerciseName, 1);
              if (exercises.length > 0) {
                const ex = exercises[0];
                router.push({
                  pathname: "/ExerciseDetail",
                  params: {
                    exerciseId: ex.exerciseId,
                    name: ex.name,
                    gifUrl: ex.gifUrl || "",
                  },
                });
              } else {
                Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(exerciseName + " exercise")}`);
              }
            } catch {
              Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(exerciseName + " exercise")}`);
            }
          };
          out.push(
            <TouchableOpacity key={nextKey()} style={styles.exercisePill} activeOpacity={0.7} onPress={handleExercisePillPress}>
              <MaterialCommunityIcons name="magnify" size={12} color="#C2410C" />
              <Text style={styles.exercisePillText}>{exerciseName}</Text>
            </TouchableOpacity>
          );
          break;
        }
        case 'h1':
          out.push(
            <View key={nextKey()} style={styles.h1Container}>
              <Text style={styles.h1Text}>{collectText(children).trim()}</Text>
            </View>
          );
          break;
        case 'p':
          out.push(
            <View key={nextKey()} style={styles.paragraph}>
              <View style={styles.inlineWrap}>{renderHtmlNodes(children, nextKey(), isInTable)}</View>
            </View>
          );
          break;
        case 'ul':
          out.push(<View key={nextKey()} style={styles.listContainer}>{renderHtmlNodes(children, nextKey(), isInTable)}</View>);
          break;
        case 'li':
          out.push(
            <View key={nextKey()} style={styles.listItem}>
              <Text style={isInTable ? styles.tableText : styles.messageText}>• </Text>
              <View style={styles.inlineWrap}>{renderHtmlNodes(children, nextKey(), isInTable)}</View>
            </View>
          );
          break;
        case 'table':
          out.push(
            <ScrollView key={nextKey()} horizontal showsHorizontalScrollIndicator={false} style={styles.tableScrollView}>
              <View style={styles.tableContainer}>{renderHtmlNodes(children, nextKey(), true)}</View>
            </ScrollView>
          );
          break;
        case 'thead':
        case 'tbody':
          out.push(...renderHtmlNodes(children, nextKey(), isInTable));
          break;
        case 'tr':
          out.push(<View key={nextKey()} style={styles.tableRow}>{renderHtmlNodes(children, nextKey(), isInTable)}</View>);
          break;
        case 'td':
        case 'th':
          out.push(
            <View key={nextKey()} style={[styles.tableCell, tag === 'th' ? styles.tableHeaderCell : null]}>
              <View style={styles.inlineWrap}>{renderHtmlNodes(children, nextKey(), isInTable)}</View>
            </View>
          );
          break;
        case 'b':
          out.push(<Text key={nextKey()} style={[isInTable ? styles.tableText : styles.messageText, { fontFamily: theme.bold }]}>{collectText(children)}</Text>);
          break;
        case 'i':
          out.push(<Text key={nextKey()} style={[isInTable ? styles.tableText : styles.messageText, { fontStyle: 'italic' }]}>{collectText(children)}</Text>);
          break;
        case 'span':
          out.push(<Text key={nextKey()} style={isInTable ? styles.tableText : styles.messageText}>{collectText(children)}</Text>);
          break;
        default:
          out.push(...renderHtmlNodes(children, nextKey(), isInTable));
      }
    }

    return out;
  };

  const parseHtmlResponse = (html: string) => {
    if (!html) return null;
    const nodes = parseHtmlToNodes(html);
    const rendered = renderHtmlNodes(nodes, 'html');
    // Wrap root-level content in inline container to allow mixed inline elements
    return rendered.length ? <View style={styles.inlineWrap}>{rendered}</View> : <Text style={styles.messageText}>{html}</Text>;
  };

  const loadSavedMessages = async () => {
    try {
      const userId = await getUserIdFromToken();
      if (!userId) return;
      
      const saved = await SavedMessage.getSavedMessages(database, userId);
      setSavedMessages(saved);
    } catch (error) {
      console.error("Error loading saved messages:", error);
    }
  };

  const toggleSavedMessages = async () => {
    if (!showSavedMessages) {
      await loadSavedMessages();
    }
    setShowSavedMessages(!showSavedMessages);
  };

  const saveMessage = async (message: Message) => {
    try {
      const userId = await getUserIdFromToken();
      if (!userId) return;

      // If already saved, delete it (toggle behavior)
      if (savedMessageIds.has(message.id)) {
        // Find the saved message with matching text
        const savedMessage = savedMessages.find(m => m.messageText === message.text);
        if (savedMessage) {
          await SavedMessage.deleteMessage(database, savedMessage.id);
          setSavedMessageIds(prev => {
            const newSet = new Set([...prev]);
            newSet.delete(message.id);
            return newSet;
          });
        }
      } else {
        // Save new message
        await SavedMessage.saveMessage(
          database,
          userId,
          message.text,
          message.isUser ? 'user' : 'ai'
        );
        
        // Add message ID to saved set
        setSavedMessageIds(prev => new Set([...prev, message.id]));
      }
      
      await loadSavedMessages();
    } catch (error) {
      console.error("Error saving message:", error);
    }
  };

  const deleteSavedMessage = async (messageId: string) => {
    try {
      await SavedMessage.deleteMessage(database, messageId);
      await loadSavedMessages();
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputText.trim();
    if (!textToSend || isLoading) return;
    haptics.light();

    // Enforce daily limit for FREE users
    const isFree = subscriptionPlan === 'FREE' || subscriptionPlan === 'Free';
    if (isFree && dailyMessageCount >= FREE_DAILY_LIMIT) {
      setShowPaywall(true);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: textToSend,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);
    Keyboard.dismiss();

    // Increment daily count for free users
    const isFreeUser = subscriptionPlan === 'FREE' || subscriptionPlan === 'Free';
    if (isFreeUser) {
      const newCount = dailyMessageCount + 1;
      setDailyMessageCount(newCount);
      try {
        const today = new Date().toISOString().split('T')[0];
        await AsyncStorage.setItem('chatbot_daily_count', JSON.stringify({ date: today, count: newCount }));
      } catch (e) { /* ignore */ }
    }

    try {
      // Detect message category and get contextual data
      const category = detectMessageCategory(textToSend);
      const contextData = await getContextualData(category);
      
      // Build the question with context
      let questionWithContext = textToSend;
      if (contextData) {
        const contextString = JSON.stringify(contextData, null, 2);
        questionWithContext = `${textToSend}\n\nUser Context:\n${contextString}`;
      }
      
      // Debug: Log the request being sent
      console.log('Sending chat request with question:', questionWithContext);
      
      // Create AI message with streaming content
      const aiMessageId = (Date.now() + 1).toString();
      const aiMessage: Message = {
        id: aiMessageId,
        text: '',
        isUser: false,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      // Use streaming API
      await AIEndpoint.askChatStream(questionWithContext, (chunk: string) => {
        console.log('ChatBot received chunk:', chunk);
        // Update the AI message with streamed content
        setMessages(prev => {
          const updated = prev.map(msg => 
            msg.id === aiMessageId 
              ? { ...msg, text: msg.text + chunk }
              : msg
          );
          const aiMsg = updated.find(m => m.id === aiMessageId);
          console.log('Updated AI message text:', aiMsg?.text);
          return updated;
        });
      });
      
      setIsLoading(false);
    } catch (error: any) {
      console.error("Error sending message:", error);
      
      let errorText = "Sorry, I encountered an error. Please try again.";
      
      // Provide more specific error messages
      if (error.response) {
        const status = error.response.status;
        if (status === 401 || status === 403) {
          errorText = "Authentication error. Please log in again.";
        } else if (status === 500) {
          errorText = "Server error. The AI service might be temporarily unavailable.";
        } else if (status === 400) {
          errorText = "Invalid request. Please try rephrasing your question.";
        }
      } else if (error.message?.includes('timeout')) {
        errorText = "Request timed out. Please check your connection and try again.";
      } else if (error.message?.includes('Network')) {
        errorText = "Network error. Please check your internet connection.";
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: errorText,
        isUser: false,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  const handleShareMessage = async (message: Message) => {
    try {
      await Share.share({
        message: message.text,
        title: "Share AI Response",
      });
    } catch (error) {
      console.error("Error sharing message:", error);
    }
  };

  // Auto-send a seeded message once (when opened from the workout ask bar)
  const seededRef = useRef(false);
  useEffect(() => {
    const seed = initialMessage?.trim();
    if (seed && !seededRef.current) {
      seededRef.current = true;
      sendMessage(seed);
    }
  }, [initialMessage]);

  const renderMessage = ({ item }: { item: Message }) => {
    // Debug: log what we're rendering
    console.log('Rendering message:', item.id, 'isUser:', item.isUser, 'text length:', item.text?.length);
    
    return (
      <View
        style={[
          styles.messageContainer,
          item.isUser ? styles.userMessage : styles.aiMessage,
        ]}
      >
        <View style={item.isUser ? styles.userBubbleWrapper : styles.messageBubbleWrapper}>
          <View
            style={[
              styles.messageBubble,
              item.isUser 
                ? styles.userBubble
                : styles.aiBubble,
            ]}
          >
            {item.isUser ? (
              <Text style={styles.messageText}>
                {highlightKeywords(item.text)}
              </Text>
            ) : (
              <View style={styles.aiMessageContent}>
                {parseHtmlResponse(item.text || '')}
              </View>
            )}
          </View>
          {!item.isUser && item.text && item.text.trim() !== '' && (
            <View style={styles.messageActionsContainer}>
              <TouchableOpacity
                style={styles.messageActionIcon}
                onPress={async () => {
                  try {
                    await Clipboard.setStringAsync(item.text);
                  } catch (error) {
                    console.error('Copy failed:', error);
                  }
                }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="content-copy" size={18} color="#48484A" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.messageActionIcon}
                onPress={() => handleShareMessage(item)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="share-variant-outline" size={18} color="#48484A" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.messageActionIcon}
                onPress={() => saveMessage(item)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons 
                  name={savedMessageIds.has(item.id) ? "bookmark" : "bookmark-outline"} 
                  size={18} 
                  color={savedMessageIds.has(item.id) ? theme.primary : "#48484A"}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <>
      <View style={styles.container}>
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => (onRequestClose ? onRequestClose() : navigation.navigate("nutrition"))}
              activeOpacity={0.7}
            >
              <BlurView intensity={40} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} blurReductionFactor={Platform.OS === 'android' ? 1 : undefined} style={styles.glassButtonBlur}>
                <MaterialCommunityIcons name={onRequestClose ? "chevron-down" : "arrow-left"} size={24} color="#8E8E93" />
              </BlurView>
            </TouchableOpacity>
            
            {subscriptionPlan && (
              <TouchableOpacity
                style={[
                    styles.planPill, 
                    (subscriptionPlan === 'FREE' || subscriptionPlan === 'Free') && styles.planPillFree
                ]}
                onPress={() => (subscriptionPlan === 'FREE' || subscriptionPlan === 'Free') ? setShowPaywall(true) : null}
                activeOpacity={(subscriptionPlan === 'FREE' || subscriptionPlan === 'Free') ? 0.7 : 1}
              >
                {(subscriptionPlan === 'FREE' || subscriptionPlan === 'Free') ? (
                    <View style={{ alignItems: 'center', gap: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                             <MaterialCommunityIcons name="star-four-points" size={12} color={theme.primary} />
                             <Text style={styles.planText}>
                                {`${FREE_DAILY_LIMIT - dailyMessageCount}/${FREE_DAILY_LIMIT} left`}
                             </Text>
                        </View>
                        <Text style={{ fontSize: 10, fontFamily: theme.medium, color: theme.primary, opacity: 0.8 }}>
                            Get Unlimited
                        </Text>
                    </View>
                ) : (
                    <>
                        <MaterialCommunityIcons name="star-four-points" size={14} color={theme.primary} />
                        <Text style={styles.planText}>Unlimited</Text>
                    </>
                )}
              </TouchableOpacity>
            )}
            
            <View style={styles.headerRightIcons}>
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={toggleSavedMessages}
                activeOpacity={0.7}
              >
                <BlurView intensity={40} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'none' : undefined} blurReductionFactor={Platform.OS === 'android' ? 1 : undefined} style={styles.glassButtonBlur}>
                  <MaterialCommunityIcons 
                    name="bookmark-outline" 
                    size={24} 
                    color="#8E8E93" 
                  />
                </BlurView>
              </TouchableOpacity>
            </View>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={[
              styles.messagesList,
              {
                paddingTop: insets.top + 84,
                paddingBottom: insets.bottom + 96 + (Platform.OS === "ios" ? keyboardHeight : 0),
              },
            ]}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            onScrollEndDrag={
              onRequestClose
                ? (e) => { if (e.nativeEvent.contentOffset.y <= -70) onRequestClose(); }
                : undefined
            }
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <FadeTranslate order={0}>
                  <VideoView
                    player={videoPlayer}
                    style={styles.greetingVideo}
                    nativeControls={false}
                    contentFit="contain"
                    playsInline
                  />
                </FadeTranslate>
                <FadeTranslate order={1}>
                  <Text style={styles.greetingText}>{greetingMessage}</Text>
                </FadeTranslate>
                <View style={styles.greetingSuggestionsGrid}>
                  {randomSuggestions.map((suggestion, index) => (
                    <FadeTranslate key={index} order={index + 2}>
                      <TouchableOpacity
                        onPress={() => sendMessage(suggestion.text)}
                        activeOpacity={0.7}
                        style={styles.greetingPillWrapper}
                      >
                         <View style={[styles.greetingPillContainer, { borderColor: suggestion.color + '30', backgroundColor: suggestion.color + '10' }]}>
                            <MaterialCommunityIcons name={suggestion.icon as any} size={18} color={suggestion.color} />
                            <Text style={styles.greetingPillText}>{suggestion.text}</Text>
                         </View>
                      </TouchableOpacity>
                    </FadeTranslate>
                  ))}
                </View>
              </View>
            }
            ListFooterComponent={
              isLoading ? (
                <View style={styles.loadingContainer}>
                  <VideoView
                    player={videoPlayer}
                    style={styles.loadingVideo}
                    nativeControls={false}
                    contentFit="contain"
                    allowsPictureInPicture={false}
                  />
                  <Animated.Text style={[styles.resultsText, { opacity: thinkingOpacity }]}>Thinking</Animated.Text>
                </View>
              ) : null
            }
          />

          {/* Input — mirrors the workout "ask bar" for cohesiveness */}
          <View
            style={[
              styles.inputContainerWrapper,
              Platform.OS === "ios"
                ? { bottom: keyboardHeight, paddingBottom: keyboardHeight > 0 ? 10 : insets.bottom + 12 }
                : { paddingBottom: insets.bottom + 12 },
            ]}
          >
            <View style={styles.askBar}>
              <TouchableOpacity
                style={styles.askAvatar}
                onPress={() => { onRequestClose?.(); navigation.navigate("profile"); }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Open profile"
              >
                <Image source={PROFILE_AVATAR} style={styles.askAvatarImg} />
              </TouchableOpacity>

              <TextInput
                style={styles.askInput}
                placeholder="Ask me anything…"
                placeholderTextColor="#8A8A8E"
                value={inputText}
                onChangeText={setInputText}
                maxLength={1000}
                returnKeyType="send"
                onSubmitEditing={() => sendMessage()}
                underlineColorAndroid="transparent"
              />

              <TouchableOpacity
                style={styles.cameraInline}
                onPress={() => router.push("/ScanMeal")}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Scan a meal"
              >
                <MaterialCommunityIcons name="camera-outline" size={22} color="#8A8A8E" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.askSend, !inputText.trim() && !isLoading && styles.askSendDisabled]}
                onPress={() => sendMessage()}
                disabled={!inputText.trim() || isLoading || ((subscriptionPlan === 'FREE' || subscriptionPlan === 'Free') && dailyMessageCount >= FREE_DAILY_LIMIT)}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons
                  name={isLoading ? "stop" : "arrow-up"}
                  size={20}
                  color="#000000"
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Saved Messages Modal */}
        <Modal
          visible={showSavedMessages}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowSavedMessages(false)}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity 
              style={{ flex: 1 }} 
              activeOpacity={1} 
              onPress={() => setShowSavedMessages(false)}
            />
            <View style={styles.modalContent}>
              <View style={styles.modalDragIndicator} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Saved</Text>
                <TouchableOpacity
                  onPress={() => setShowSavedMessages(false)}
                  style={styles.modalCloseButton}
                >
                  <MaterialCommunityIcons name="close" size={20} color="#8E8E93" />
                </TouchableOpacity>
              </View>
              
              <FlatList
                data={savedMessages}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.savedMessageCard}>
                    <View style={styles.savedMessageContent}>
                      <View style={styles.aiMessageContent}>
                        {parseHtmlResponse(item.messageText)}
                      </View>
                      <View style={styles.savedMessageActions}>
                        <Text style={styles.savedMessageDate}>
                          {new Date(item.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                        <View style={styles.savedMessageIcons}>
                          <TouchableOpacity
                            style={styles.savedActionIcon}
                            onPress={async () => {
                              try {
                                await Clipboard.setStringAsync(item.messageText);
                              } catch (error) {
                                console.error('Copy failed:', error);
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <MaterialCommunityIcons name="content-copy" size={16} color="#48484A" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.savedActionIcon}
                            onPress={async () => {
                              try {
                                await Share.share({ message: item.messageText, title: "Share Message" });
                              } catch (error) {
                                console.error('Share failed:', error);
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <MaterialCommunityIcons name="share-variant-outline" size={16} color="#48484A" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.savedActionIcon}
                            onPress={() => deleteSavedMessage(item.id)}
                            activeOpacity={0.7}
                          >
                            <MaterialCommunityIcons name="trash-can-outline" size={16} color="#FF453A" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                )}
                contentContainerStyle={styles.savedMessagesList}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyModalContainer}>
                    <MaterialCommunityIcons name="bookmark-outline" size={48} color="#2C2C2E" />
                    <Text style={styles.emptyText}>No saved messages yet</Text>
                    <Text style={styles.emptySubtext}>Save messages to access them later</Text>
                  </View>
                }
              />
            </View>
          </View>
        </Modal>
      </View>

      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onPurchaseCompleted={() => {
          setShowPaywall(false);
          setSubscriptionPlan('PRO');
        }}
        onRestoreCompleted={() => {
          setShowPaywall(false);
          setSubscriptionPlan('PRO');
        }}
      />
    </>
  );
}

// ── Design tokens (mirrors app-wide dark system) ─────────────────────────────
const C = {
  bg:        "#000000",
  card:      "#1C1C1E",
  cardAlt:   "#242426",
  border:    "#2C2C2E",
  primary:   theme.primary,        // #AAFB05
  deep:      theme.deepPrimary,    // #062B0A
  text:      "#FFFFFF",
  sub:       "#8E8E93",
  muted:     "#48484A",
  userBubble: "#1C1C1E",           // like ChatGPT dark: user msg = slightly elevated card
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: C.bg,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  glassButtonBlur: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(6,14,6,0.55)',
  },
  planPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: C.deep,
    borderWidth: 1,
    borderColor: 'rgba(170,251,5,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
  },
  planPillFree: {
    borderColor: 'rgba(170,251,5,0.25)',
    backgroundColor: C.deep, // Reverted to greenish deep primary
    flexDirection: 'column', 
    alignItems: 'center',
    paddingVertical: 6,
    gap: 0,
  },
  planText: {
    fontSize: 13,
    fontFamily: theme.medium,
    color: C.primary,
  },

  // ── Empty / greeting state ─────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 100,
    paddingHorizontal: 20,
  },
  greetingVideo: {
    width: 180,
    height: 180,
    marginBottom: 20,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  greetingText: {
    fontSize: 26,
    fontFamily: theme.semibold,
    color: C.text,
    textAlign: "center",
    marginBottom: 28,
    letterSpacing: -0.5,
  },
  greetingSuggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingBottom: 20,
    maxWidth: 600, // Limit width to keep pills centered nicely
    alignSelf: 'center',
  },
  greetingPillWrapper: {
    // No specific wrapper style needed for pills in flexwrap
  },
  greetingPillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    // Background and border colors set dynamically
  },
  greetingPillText: {
    fontSize: 14,
    fontFamily: theme.medium,
    color: '#E5E5EA',
  },

  // ── Messages list ──────────────────────────────────────────────────────────
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 84,
    paddingBottom: 96,
    flexGrow: 1,
    maxWidth: 768,
    width: '100%',
    marginHorizontal: 'auto',
  },
  messageContainer: {
    flexDirection: "row",
    marginBottom: 24,
    width: '100%',
  },
  userMessage: {
    justifyContent: "flex-end",
    alignSelf: "flex-end",
  },
  aiMessage: {
    justifyContent: "flex-start",
    alignSelf: "flex-start",
  },
  messageBubbleWrapper: {
    flex: 1,
    maxWidth: '100%',
  },
  userBubbleWrapper: {
    maxWidth: '85%',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
  },
  messageBubbleWide: {
    width: "100%",
  },
  userBubble: {
    backgroundColor: '#2C2C2E',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  messageText: {
    fontSize: 15,
    fontFamily: theme.regular,
    color: C.text,
    lineHeight: 22,
  },
  aiMessageContent: {
    flexDirection: 'column',
    gap: 6,
  },
  inlineWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },

  // Semantic pills — food/exercise — dark tinted
  foodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(48,209,88,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(48,209,88,0.3)',
  },
  foodPillText: {
    fontSize: 11,
    fontFamily: theme.medium,
    color: '#30D158',
  },
  exercisePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,159,10,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,159,10,0.3)',
  },
  exercisePillText: {
    fontSize: 11,
    fontFamily: theme.medium,
    color: '#FF9F0A',
  },

  // Typography inside AI bubbles
  h1Container: {
    width: '100%',
    marginTop: 12,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  h1Text: {
    fontSize: 20,
    fontFamily: theme.bold,
    color: C.text,
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  paragraph: {
    width: '100%',
    marginVertical: 4,
  },
  listContainer: {
    marginVertical: 4,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
  },

  // Tables
  tableScrollView: {
    marginVertical: 8,
  },
  tableContainer: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    backgroundColor: C.card,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3C',
  },
  tableCell: {
    width: 110, // Reduced width for more columns
    paddingVertical: 8, // Reduced padding
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#3A3A3C',
    justifyContent: 'center',
  },
  tableHeaderCell: {
    backgroundColor: '#2C2C2E',
  },
  tableHeaderText: {
    fontFamily: theme.bold,
    color: '#E5E5EA',
    fontSize: 11, // Smaller font
  },
  tableText: {
    fontSize: 11, // Smaller font
    fontFamily: theme.regular,
    color: '#D1D1D6',
    lineHeight: 14, // Smaller line height
  },

  // Message action icons (copy/share/bookmark)
  messageActionsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    alignItems: 'center',
    paddingLeft: 2,
    opacity: 0.8,
  },
  messageActionIcon: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', 
  },
  boldKeyword: {
    fontSize: 14,
    fontFamily: theme.bold,
    color: theme.primary,
  },

  // Loading
  loadingContainer: {
    flexDirection: 'row', // Align video and text horizontally
    alignItems: "center", // Vertically center them
    paddingVertical: 16,
    paddingHorizontal: 0,
    gap: 12, // Add some space between video and text
  },
  loadingVideo: {
    width: 28,
    height: 28,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  resultsLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultsText: {
    fontSize: 15,
    fontFamily: theme.medium,
    color: '#8E8E93',
  },

  // ── Input bar ──────────────────────────────────────────────────────────────
  inputContainerWrapper: {
    position: 'absolute',
    bottom: 0, 
    left: 0,
    right: 0,
    backgroundColor: 'transparent', 
    zIndex: 100,
    paddingHorizontal: 20, // Increased horizontal padding
    paddingBottom: 12,
    paddingTop: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center', // Changed from flex-end to center to align camera button
    gap: 12,
    maxWidth: 600, // Reduced width
    width: '100%',
    alignSelf: 'center',
  },
  inputContainerKeyboardOpen: {},

  // ── Ask bar (mirrors workout ask bar) ──────────────────────────────────────
  askBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    height: 54,
    paddingLeft: 6,
    paddingRight: 6,
    borderRadius: 27,
    backgroundColor: '#17191B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  askAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    backgroundColor: '#161618',
  },
  askAvatarImg: { width: '100%', height: '100%' },
  askInput: {
    flex: 1,
    minWidth: 0,
    color: '#FFF',
    fontFamily: theme.regular,
    fontSize: 14.5,
    paddingVertical: 0,
    textAlignVertical: 'center',
    outlineStyle: 'none',
  } as any,
  cameraInline: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askSend: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askSendDisabled: {
    backgroundColor: '#3A3A3C',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22, // Slightly smaller radius
    paddingLeft: 16,
    paddingRight: 4, 
    paddingVertical: 2, // Minimal vertical padding
    backgroundColor: "#1C1C1E", 
    borderWidth: 1,
    borderColor: "#2C2C2E",
    minHeight: 44, // Reduced height
  },
  input: {
    flex: 1,
    fontSize: 15, // Slightly smaller font
    fontFamily: theme.regular,
    color: "#FFF",
    paddingTop: 8,
    paddingBottom: 8,
    paddingRight: 8,
    maxHeight: 35, 
    textAlignVertical: 'center',
    outlineStyle: 'none', // Remove web focus border
  } as any,
  cameraButton: {
    width: 44, 
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 22,
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFF", 
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#3A3A3C",
  },

  // ── Saved messages modal ───────────────────────────────────────────────────
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    height: '85%',
    backgroundColor: C.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: C.border,
    width: '100%',
    maxWidth: 768,
    paddingTop: 8,
    alignSelf: 'center',
  },
  modalDragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: theme.semibold,
    color: C.text,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.cardAlt,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  savedMessagesList: {
    padding: 20,
    paddingTop: 8,
  },
  savedMessageCard: {
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: C.cardAlt,
    borderWidth: 1,
    borderColor: C.border,
  },
  savedMessageContent: {
    padding: 16,
  },
  savedMessageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  savedMessageIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  savedActionIcon: {
    padding: 4,
  },
  savedMessageDate: {
    fontSize: 12,
    fontFamily: theme.regular,
    color: C.muted,
  },
  savedMessageText: {
    fontSize: 15,
    fontFamily: theme.regular,
    color: C.text,
    lineHeight: 22,
  },
  emptyModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 17,
    fontFamily: theme.semibold,
    color: C.sub,
    textAlign: 'center',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: theme.regular,
    color: C.muted,
    textAlign: 'center',
    marginTop: 4,
  },
});

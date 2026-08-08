import ButtonOnboarding from "@/components/ui/Onboarding/AnswerOnboarding";
import ButtonFit from "@/components/ui/ButtonFit";
import QuestionOnboarding from "@/components/ui/Onboarding/QuestionOnboarding";
import SolidBackground from "@/components/ui/SolidBackground";
import FadeTranslate from "@/components/ui/FadeTranslate";
import { theme } from "@/constants/theme";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useOnboarding } from "../NavigationService";
import { useSafeAreaInsets } from "react-native-safe-area-context";
("use client");

const LastTimeHappyBodyImage = () => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const { goForward } = useOnboarding();
  const insets = useSafeAreaInsets();

  const handleOptionSelect = (option: string) => {
    setSelectedOption(option);
  };

  const getInfoMessage = () => {
    // Low confidence options
    if (selectedOption === "1-2 years ago" || selectedOption === ">3 years ago" || selectedOption === "Never") {
      return {
        title: "60% of users feel the same way!",
        message: "You are not alone, many share your feelings!",
        color: "#062B0A",
      };
    }
    // High confidence option
    if (selectedOption === "<1 year ago") {
      return {
        title: "Great Foundation!",
        message: "Keep building on this momentum. We'll help you reach your goals!",
        color: "#062B0A",
      };
    }
    return null;
  };

  const infoMessage = getInfoMessage();
  return (
    <>
      <SolidBackground style={styles.background} />

      <View style={styles.outerContainer}>
        <View style={styles.innerContainer}>
          <QuestionOnboarding question="Last time you felt confident in your body?" />
          <View style={{ marginTop: 30 }} />

          <ButtonOnboarding
            text="<1 year ago"
            rightImage={require("@/assets/icons/onboarding/thinking.png")}
            onClickContinue={false}
            forQuestion="last_time_happy_body_image"
            order={0}
            onClick={() => handleOptionSelect("<1 year ago")}
          />
          <ButtonOnboarding
            text="1-2 years ago"
            rightImage={require("@/assets/icons/onboarding/grinning.png")}
            onClickContinue={false}
            forQuestion="last_time_happy_body_image"
            order={1}
            onClick={() => handleOptionSelect("1-2 years ago")}
          />
          <ButtonOnboarding
            text=">3 years ago"
            rightImage={require("@/assets/icons/onboarding/sad.png")}
            onClickContinue={false}
            forQuestion="last_time_happy_body_image"
            order={2}
            onClick={() => handleOptionSelect(">3 years ago")}
          />
          <ButtonOnboarding
            text="Never"
            rightImage={require("@/assets/icons/onboarding/never.png")}
            onClickContinue={false}
            forQuestion="last_time_happy_body_image"
            order={3}
            onClick={() => handleOptionSelect("Never")}
          />
        </View>
      </View>

      {selectedOption && infoMessage && (
        <FadeTranslate order={1} duration={1000}>
          <View style={[styles.bottom, { marginBottom: insets.bottom + 24 }]}>
            <ButtonFit
              title="Continue"
              backgroundColor={theme.primary}
              onPress={goForward}
              hasMoreInfo={true}
              moreInfoColor={infoMessage.color}
              moreInfoTitle={infoMessage.title}
              moreInfoImageSource={require("@/assets/icons/onboarding/hug.png")}
              moreInfoText={infoMessage.message}
            />
          </View>
        </FadeTranslate>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    position: "relative",
  },
  background: {
    ...StyleSheet.absoluteFill,
    zIndex: -1,
  },
  innerContainer: {
    flex: 1,
    paddingTop: 30,
    paddingHorizontal: 25,
    zIndex: 1,
    alignItems: "center",
  },
  bottom: {
    alignItems: "center",
    paddingHorizontal: 25,
  },
});

export default LastTimeHappyBodyImage;

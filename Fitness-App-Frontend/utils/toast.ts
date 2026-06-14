import Toast from "react-native-toast-message";

export function showErrorToast(title: string, message?: string) {
  Toast.show({
    type: "error",
    text1: title,
    text2: message,
    visibilityTime: 4000,
  });
}

import { useFonts } from "expo-font";
import { Stack } from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AppProviders } from "@/providers/app-providers";
import { colors } from "@/theme/colors";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [runtimeFontsLoaded, fontError] = useFonts(
    Platform.OS === "android"
      ? {}
      : {
          Manrope: require("@/assets/fonts/Manrope.ttf"),
          LTSuperiorExtraBold: require("@/assets/fonts/LTSuperior-ExtraBold.ttf"),
        },
  );
  const fontsLoaded = Platform.OS === "android" || runtimeFontsLoaded;

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProviders>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: colors.background },
            headerBackButtonDisplayMode: "minimal",
            headerShadowVisible: false,
            headerTitleStyle: { fontFamily: "LTSuperiorExtraBold" },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(content)" options={{ headerShown: false }} />
          <Stack.Screen name="products/[productId]" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </AppProviders>
    </GestureHandlerRootView>
  );
}

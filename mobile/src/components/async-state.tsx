import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { colors } from "@/theme/colors";

export function LoadingState({ label }: { label: string }) {
  return (
    <View role="progressbar" aria-label={label} style={{ alignItems: "center", gap: 12, padding: 40 }}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text selectable style={{ color: colors.muted, fontFamily: "Manrope" }}>
        {label}
      </Text>
    </View>
  );
}

export function ErrorState({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <View role="alert" style={{ alignItems: "center", gap: 14, padding: 28 }}>
      <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", lineHeight: 22, textAlign: "center" }}>
        {message}
      </Text>
      <Pressable
        role="button"
        onPress={onRetry}
        style={({ pressed }) => ({
          backgroundColor: colors.accent,
          borderCurve: "continuous",
          borderRadius: 12,
          justifyContent: "center",
          minHeight: 46,
          opacity: pressed ? 0.72 : 1,
          paddingHorizontal: 20,
        })}
      >
        <Text style={{ color: colors.surface, fontFamily: "Manrope", fontWeight: "800" }}>
          {retryLabel}
        </Text>
      </Pressable>
    </View>
  );
}

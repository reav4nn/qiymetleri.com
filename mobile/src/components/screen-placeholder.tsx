import { ScrollView, Text, View } from "react-native";

import { colors } from "@/theme/colors";

export function ScreenPlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20 }}
    >
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderCurve: "continuous",
          borderRadius: 20,
          borderWidth: 1,
          gap: 8,
          padding: 24,
        }}
      >
        <Text
          selectable
          role="heading"
          aria-level={1}
          style={{ color: colors.text, fontFamily: "LTSuperiorExtraBold", fontSize: 24 }}
        >
          {title}
        </Text>
        <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", lineHeight: 22 }}>
          {body}
        </Text>
      </View>
    </ScrollView>
  );
}

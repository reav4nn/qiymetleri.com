import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useLocale } from "@/i18n/locale-context";
import { colors } from "@/theme/colors";

export function NotFoundScreen() {
  const { t } = useLocale();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
    >
      <View style={{ alignItems: "center", gap: 16 }}>
        <Text
          selectable
          role="heading"
          aria-level={1}
          style={{ color: colors.text, fontFamily: "LTSuperiorExtraBold", fontSize: 28, textAlign: "center" }}
        >
          {t("notFound.title")}
        </Text>
        <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", lineHeight: 22, textAlign: "center" }}>
          {t("notFound.body")}
        </Text>
        <Link href="/" asChild>
          <Pressable
            role="link"
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: colors.accent,
              borderCurve: "continuous",
              borderRadius: 12,
              minHeight: 48,
              justifyContent: "center",
              opacity: pressed ? 0.75 : 1,
              paddingHorizontal: 20,
            })}
          >
            <Text style={{ color: colors.surface, fontFamily: "Manrope", fontWeight: "700" }}>
              {t("notFound.home")}
            </Text>
          </Pressable>
        </Link>
        <Link href="/products" asChild>
          <Pressable
            role="link"
            style={({ pressed }) => ({
              alignItems: "center",
              borderColor: colors.border,
              borderCurve: "continuous",
              borderRadius: 12,
              borderWidth: 1,
              justifyContent: "center",
              minHeight: 48,
              opacity: pressed ? 0.7 : 1,
              paddingHorizontal: 20,
            })}
          >
            <Text style={{ color: colors.text, fontFamily: "Manrope", fontWeight: "700" }}>
              {t("notFound.catalogue")}
            </Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

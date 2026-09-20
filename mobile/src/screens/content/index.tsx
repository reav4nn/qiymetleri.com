import { Link } from "expo-router";
import { Stack } from "expo-router/stack";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";

import { contentPages, isContentSlug } from "@/content/static-content";
import { useLocale } from "@/i18n/locale-context";
import { NotFoundScreen } from "@/screens/not-found";
import { colors } from "@/theme/colors";
import { safeExternalUrl } from "@/utils/external-url";

export function ContentScreen({ slug }: { slug?: string }) {
  const { locale, t } = useLocale();
  if (!slug || !isContentSlug(slug)) return <NotFoundScreen />;
  const page = contentPages[locale][slug];
  const externalCta = page.cta && !page.cta.href.startsWith("/") ? safeExternalUrl(page.cta.href) : null;

  return (
    <>
      <Stack.Title>{page.title}</Stack.Title>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ alignSelf: "center", gap: 14, maxWidth: 720, padding: 16, paddingBottom: 36, width: "100%" }}
      >
        <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderCurve: "continuous", borderRadius: 20, borderWidth: 1, gap: 12, padding: 22 }}>
          <Text selectable style={{ color: colors.accent, fontFamily: "Manrope", fontSize: 10, fontWeight: "800", textTransform: "uppercase" }}>{page.eyebrow}</Text>
          <Text selectable role="heading" aria-level={1} style={{ color: colors.text, fontFamily: "LTSuperiorExtraBold", fontSize: 29 }}>{page.title}</Text>
          <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", fontSize: 14, lineHeight: 22 }}>{page.intro}</Text>
        </View>

        <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderCurve: "continuous", borderRadius: 20, borderWidth: 1, overflow: "hidden" }}>
          {page.sections.map((section, index) => (
            <View key={section.title} style={{ borderTopColor: colors.border, borderTopWidth: index ? 1 : 0, gap: 8, padding: 18 }}>
              <Text selectable role="heading" aria-level={2} style={{ color: colors.text, fontFamily: "LTSuperiorExtraBold", fontSize: 18 }}>{section.title}</Text>
              <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", fontSize: 13, lineHeight: 21 }}>{section.body}</Text>
            </View>
          ))}
        </View>

        {page.cta ? (
          <View style={{ backgroundColor: colors.text, borderCurve: "continuous", borderRadius: 18, gap: 10, padding: 20 }}>
            <Text selectable role="heading" aria-level={2} style={{ color: colors.surface, fontFamily: "LTSuperiorExtraBold", fontSize: 20 }}>{t("content.ctaTitle")}</Text>
            <Text selectable style={{ color: "#d4d4d8", fontFamily: "Manrope", fontSize: 12, lineHeight: 19 }}>{t("content.ctaBody")}</Text>
            {page.cta.href.startsWith("/") ? (
              <Link href="/products" asChild>
                <CtaButton label={page.cta.label} />
              </Link>
            ) : externalCta ? (
              <CtaButton label={page.cta.label} onPress={() => void Linking.openURL(externalCta)} />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

function CtaButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable role="link" onPress={onPress} style={({ pressed }) => ({ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.accent, borderCurve: "continuous", borderRadius: 12, justifyContent: "center", minHeight: 48, opacity: pressed ? 0.7 : 1, paddingHorizontal: 18 })}>
      <Text style={{ color: colors.surface, fontFamily: "Manrope", fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { LanguageSwitch } from "@/components/language-switch";
import { useLocale } from "@/i18n/locale-context";
import { navigationCopy } from "@/i18n/navigation-copy";
import { colors } from "@/theme/colors";

const shopLinks = [
  ["smartphones", "categories.phones"],
  ["laptops", "categories.laptops"],
  ["televisions", "categories.tvs"],
] as const;

const informationLinks = [
  ["about", "footer.about"],
  ["partnership", "footer.partnership"],
  ["social", "footer.social"],
  ["contact", "footer.contact"],
] as const;

const legalLinks = [
  ["terms", "footer.terms"],
  ["privacy", "footer.privacy"],
  ["personal-data", "footer.personalData"],
  ["consent", "footer.consent"],
] as const;

export function MoreScreen() {
  const { locale, t } = useLocale();
  const router = useRouter();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ gap: 20, padding: 16, paddingBottom: 32 }}
    >
      <View style={{ gap: 10 }}>
        <Text
          selectable
          role="heading"
          aria-level={2}
          style={{ color: colors.text, fontFamily: "LTSuperiorExtraBold", fontSize: 18 }}
        >
          {navigationCopy[locale].language}
        </Text>
        <LanguageSwitch />
      </View>

      <LinkSection title={t("nav.login")}>
        <LinkRow label={t("nav.login")} onPress={() => router.push("/login")} />
      </LinkSection>

      <LinkSection title={t("footer.shop")}>
        {shopLinks.map(([category, labelKey]) => (
          <LinkRow
            key={category}
            label={t(labelKey)}
            onPress={() => router.push({ pathname: "/products", params: { category } })}
          />
        ))}
      </LinkSection>

      <LinkSection title={t("footer.information")}>
        {informationLinks.map(([slug, labelKey]) => (
          <LinkRow key={slug} label={t(labelKey)} onPress={() => router.push(`/${slug}`)} />
        ))}
      </LinkSection>

      <LinkSection title={t("footer.legal")}>
        {legalLinks.map(([slug, labelKey]) => (
          <LinkRow key={slug} label={t(labelKey)} onPress={() => router.push(`/${slug}`)} />
        ))}
      </LinkSection>

      <View style={{ borderTopColor: colors.border, borderTopWidth: 1, gap: 6, paddingTop: 20 }}>
        <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", fontSize: 12 }}>
          {t("footer.tagline")}
        </Text>
        <Text selectable style={{ color: colors.mutedLight, fontFamily: "Manrope", fontSize: 11 }}>
          {t("footer.copyright", { year: 2026 })}
        </Text>
      </View>
    </ScrollView>
  );
}

function LinkSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text
        selectable
        role="heading"
        aria-level={2}
        style={{ color: colors.text, fontFamily: "LTSuperiorExtraBold", fontSize: 18 }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      role="link"
      aria-label={label}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderCurve: "continuous",
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: "row",
        justifyContent: "space-between",
        minHeight: 52,
        opacity: pressed ? 0.7 : 1,
        paddingHorizontal: 16,
      })}
    >
      <Text style={{ color: colors.text, fontFamily: "Manrope", fontWeight: "700" }}>
        {label}
      </Text>
      <Text aria-hidden style={{ color: colors.mutedLight, fontSize: 20 }}>
        ›
      </Text>
    </Pressable>
  );
}

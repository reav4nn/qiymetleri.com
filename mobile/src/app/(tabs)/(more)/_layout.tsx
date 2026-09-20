import { Stack } from "expo-router/stack";

import { useLocale } from "@/i18n/locale-context";
import { navigationCopy } from "@/i18n/navigation-copy";

export default function MoreLayout() {
  const { locale } = useLocale();
  return <Stack screenOptions={{ headerTitle: navigationCopy[locale].more }} />;
}

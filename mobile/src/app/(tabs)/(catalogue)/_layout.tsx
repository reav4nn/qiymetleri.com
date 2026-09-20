import { Stack } from "expo-router/stack";

import { useLocale } from "@/i18n/locale-context";

export default function CatalogueLayout() {
  const { t } = useLocale();
  return <Stack screenOptions={{ headerTitle: t("catalogue.title") }} />;
}

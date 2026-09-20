import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useLocale } from "@/i18n/locale-context";
import { navigationCopy } from "@/i18n/navigation-copy";
import { colors } from "@/theme/colors";

export default function TabLayout() {
  const { locale } = useLocale();
  const copy = navigationCopy[locale];

  return (
    <NativeTabs tintColor={colors.accent}>
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
        <NativeTabs.Trigger.Label>{copy.home}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(catalogue)" role="search">
        <NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" md="grid_view" />
        <NativeTabs.Trigger.Label>{copy.catalogue}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(more)" role="more">
        <NativeTabs.Trigger.Icon sf="ellipsis.circle.fill" md="more_horiz" />
        <NativeTabs.Trigger.Label>{copy.more}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

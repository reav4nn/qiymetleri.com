import * as Haptics from "expo-haptics";
import { Pressable, Text, View } from "react-native";

import { supportedLocales, useLocale } from "@/i18n/locale-context";
import { colors } from "@/theme/colors";

export function LanguageSwitch() {
  const { locale, setLocale } = useLocale();

  return (
    <View role="radiogroup" style={{ flexDirection: "row", gap: 4 }}>
      {supportedLocales.map((item) => {
        const selected = item === locale;
        return (
          <Pressable
            key={item}
            role="radio"
            aria-label={item.toUpperCase()}
            aria-checked={selected}
            onPress={() => {
              if (!selected) {
                void Haptics.selectionAsync();
                setLocale(item);
              }
            }}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: selected ? colors.accent : colors.background,
              borderCurve: "continuous",
              borderRadius: 10,
              justifyContent: "center",
              minHeight: 44,
              minWidth: 52,
              opacity: pressed ? 0.72 : 1,
              paddingHorizontal: 12,
            })}
          >
            <Text
              style={{
                color: selected ? colors.surface : colors.muted,
                fontFamily: "Manrope",
                fontSize: 13,
                fontWeight: "700",
                textTransform: "uppercase",
              }}
            >
              {item}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

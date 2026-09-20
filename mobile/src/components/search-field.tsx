import { Pressable, Text, TextInput, View } from "react-native";

import { colors } from "@/theme/colors";

export function SearchField({
  value,
  placeholder,
  submitLabel,
  onChangeText,
  onSubmit,
}: {
  value: string;
  placeholder: string;
  submitLabel: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <TextInput
        role="searchbox"
        aria-label={placeholder}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedLight}
        returnKeyType="search"
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderCurve: "continuous",
          borderRadius: 14,
          borderWidth: 1.5,
          color: colors.text,
          flex: 1,
          fontFamily: "Manrope",
          fontSize: 15,
          minHeight: 50,
          paddingHorizontal: 16,
        }}
      />
      <Pressable
        role="button"
        aria-label={submitLabel}
        onPress={onSubmit}
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: colors.accent,
          borderCurve: "continuous",
          borderRadius: 14,
          justifyContent: "center",
          minHeight: 50,
          minWidth: 54,
          opacity: pressed ? 0.72 : 1,
          paddingHorizontal: 14,
        })}
      >
        <Text aria-hidden style={{ color: colors.surface, fontSize: 20 }}>
          ⌕
        </Text>
      </Pressable>
    </View>
  );
}

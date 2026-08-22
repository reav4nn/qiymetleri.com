import { render, screen, userEvent } from "@testing-library/react-native";
import { Text } from "react-native";

import { LanguageSwitch } from "@/components/language-switch";
import { formatDateForLocale, LocaleProvider, useLocale } from "@/i18n/locale-context";

jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn(async () => undefined) }));

jest.mock("expo-sqlite/kv-store", () => ({
  AsyncStorage: {
    getItem: jest.fn(async () => null as string | null),
    setItem: jest.fn(async () => undefined),
  },
}));

const mockStorage = jest.requireMock("expo-sqlite/kv-store").AsyncStorage as {
  getItem: jest.Mock<Promise<string | null>, []>;
  setItem: jest.Mock<Promise<void>, [string, string]>;
};

jest.useFakeTimers();

beforeEach(() => {
  mockStorage.getItem.mockReset();
  mockStorage.getItem.mockResolvedValue(null);
  mockStorage.setItem.mockClear();
});

test("switches locale and retains it in device storage", async () => {
  function Probe() {
    const { locale } = useLocale();
    return <Text>{locale}</Text>;
  }

  const user = userEvent.setup();
  await render(
    <LocaleProvider>
      <LanguageSwitch />
      <Probe />
    </LocaleProvider>,
  );

  expect(screen.getByRole("radio", { name: "AZ" })).toBeChecked();
  await user.press(screen.getByRole("radio", { name: "RU" }));
  expect(screen.getByRole("radio", { name: "RU" })).toBeChecked();
  expect(mockStorage.setItem).toHaveBeenCalledWith("qiymetleri.locale", "ru");
});

test("formats Azerbaijani dates without falling back to English month names", () => {
  const date = new Date(2026, 7, 12, 12);

  expect(formatDateForLocale("az", date, { day: "2-digit", month: "short", year: "numeric" })).toBe(
    "12 avq 2026",
  );
  expect(formatDateForLocale("az", date, { day: "2-digit", month: "short" })).toBe("12 avq");
});

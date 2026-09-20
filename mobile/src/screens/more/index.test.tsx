import { render, screen } from "@testing-library/react-native";

import { LocaleProvider } from "@/i18n/locale-context";
import az from "@/i18n/messages/az.json";
import { MoreScreen } from "@/screens/more";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn(async () => undefined) }));

test("groups every public header and footer destination", async () => {
  await render(
    <LocaleProvider>
      <MoreScreen />
    </LocaleProvider>,
  );

  expect(screen.getByRole("heading", { name: az.nav.login })).toBeOnTheScreen();
  expect(screen.getByRole("heading", { name: az.footer.shop })).toBeOnTheScreen();
  expect(screen.getByRole("heading", { name: az.footer.information })).toBeOnTheScreen();
  expect(screen.getByRole("heading", { name: az.footer.legal })).toBeOnTheScreen();
  expect(screen.getAllByRole("link")).toHaveLength(12);
  expect(screen.getByRole("link", { name: az.categories.phones })).toBeOnTheScreen();
  expect(screen.getByRole("link", { name: az.footer.consent })).toBeOnTheScreen();
});

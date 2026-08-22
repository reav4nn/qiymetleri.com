import { render, screen } from "@testing-library/react-native";

import { NetworkBanner } from "@/components/network-banner";
import { LocaleProvider } from "@/i18n/locale-context";

jest.mock("@react-native-community/netinfo", () => ({
  useNetInfo: () => ({ isConnected: true }),
}));

test("discloses saved catalogue data while the device is online", async () => {
  await render(
    <LocaleProvider>
      <NetworkBanner
        dataSource="snapshot"
        snapshotGeneratedAt="2026-08-12T13:34:26.495392+00:00"
      />
    </LocaleProvider>,
  );

  expect(screen.getByRole("alert")).toHaveTextContent(/12.*2026/);
  expect(screen.getByRole("alert")).toHaveTextContent(/saxlanmış kataloq/i);
});

test("does not duplicate Russian date punctuation", async () => {
  await render(
    <LocaleProvider initialLocale="ru">
      <NetworkBanner
        dataSource="snapshot"
        snapshotGeneratedAt="2026-08-12T13:34:26.495392+00:00"
      />
    </LocaleProvider>,
  );

  expect(screen.getByRole("alert")).not.toHaveTextContent(/\.\.$/);
});

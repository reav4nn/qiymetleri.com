import { render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { LocaleProvider } from "@/i18n/locale-context";
import az from "@/i18n/messages/az.json";
import { ProductDetailScreen } from "@/screens/product-detail";

jest.mock("@/api/queries", () => ({
  useProductQuery: () => ({
    data: undefined,
    error: new Error("offline"),
    isPending: false,
  }),
}));
jest.mock("expo-router", () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));
jest.mock("expo-router/stack", () => ({
  Stack: { Title: () => null },
}));

test("matches the public web product error state", async () => {
  await render(
    <LocaleProvider>
      <ProductDetailScreen productId="00000000-0000-0000-0000-000000000000" />
    </LocaleProvider>,
  );

  expect(screen.getByRole("heading", { name: az.productPage.unavailableTitle })).toBeOnTheScreen();
  expect(screen.getByText(az.productPage.unavailableBody)).toBeOnTheScreen();
  expect(screen.getByRole("link", { name: az.productPage.backToCatalogue })).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: az.common.apply })).not.toBeOnTheScreen();
});

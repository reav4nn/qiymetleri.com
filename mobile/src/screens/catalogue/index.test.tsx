import { render, screen } from "@testing-library/react-native";

import { LocaleProvider } from "@/i18n/locale-context";
import az from "@/i18n/messages/az.json";
import { CatalogueScreen } from "@/screens/catalogue";

const mockUseCatalogueQuery = jest.fn();

jest.mock("@/api/queries", () => ({
  useCatalogueQuery: (...args: unknown[]) => mockUseCatalogueQuery(...args),
}));
jest.mock("@react-native-community/netinfo", () => ({
  useNetInfo: () => ({ isConnected: true }),
}));

jest.useFakeTimers();

beforeEach(() => {
  mockUseCatalogueQuery.mockReturnValue({
    data: {
      items: [],
      total: 0,
      page: 1,
      per_page: 20,
      pages: 0,
      filters: { categories: [], brands: [], stores: [] },
    },
    error: null,
    isFetching: false,
    isPending: false,
    isRefetching: false,
    refetch: jest.fn(),
  });
});

test("exposes exactly the three sort modes from the public web catalogue", async () => {
  await render(
    <LocaleProvider>
      <CatalogueScreen query={{ sort_by: "name", page: 1 }} onUpdateQuery={jest.fn()} />
    </LocaleProvider>,
  );

  expect(screen.getByRole("button", { name: az.catalogue.sortName })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: az.catalogue.sortPriceAsc })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: az.catalogue.sortPriceDesc })).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: az.home.popularTitle })).not.toBeOnTheScreen();
});

test("matches the web catalogue error state without duplicate messaging or an empty apply action", async () => {
  mockUseCatalogueQuery.mockReturnValue({
    data: undefined,
    error: new Error("offline"),
    isFetching: false,
    isPending: false,
    isRefetching: false,
    refetch: jest.fn(),
  });

  await render(
    <LocaleProvider>
      <CatalogueScreen query={{ sort_by: "name", page: 1 }} onUpdateQuery={jest.fn()} />
    </LocaleProvider>,
  );

  expect(screen.getAllByText(az.home.dataUnavailable)).toHaveLength(1);
  expect(screen.queryByRole("button", { name: az.common.apply })).not.toBeOnTheScreen();
  expect(screen.getByRole("button", { name: az.catalogue.sortName })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: az.catalogue.sortPriceAsc })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: az.catalogue.sortPriceDesc })).toBeOnTheScreen();
});

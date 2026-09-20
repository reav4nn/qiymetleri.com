import { render, screen, userEvent } from "@testing-library/react-native";
import { useState } from "react";

import { SearchField } from "@/components/search-field";

jest.useFakeTimers();

test("accepts a query and submits it accessibly", async () => {
  const onSubmit = jest.fn();
  function Harness() {
    const [value, setValue] = useState("");
    return (
      <SearchField
        value={value}
        onChangeText={setValue}
        onSubmit={onSubmit}
        placeholder="Məhsul axtar"
        submitLabel="Axtar"
      />
    );
  }

  const user = userEvent.setup();
  await render(<Harness />);
  await user.type(screen.getByRole("searchbox", { name: "Məhsul axtar" }), "iPhone");
  expect(screen.getByRole("searchbox")).toHaveDisplayValue("iPhone");
  await user.press(screen.getByRole("button", { name: "Axtar" }));
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

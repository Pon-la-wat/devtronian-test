import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { App } from "../src/client/App";

it("renders the Inventory heading", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Inventory" })).toBeTruthy();
});

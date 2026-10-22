import { expect, it } from "vitest";
import { scopeTo } from "#src/db/index";
import { db } from "../../../test/fixtures";
import { userId, userInputSchema } from "./model";
import { usersRepository, usersTable } from "./repo.d1";
import { usersService } from "./service";

const users = () => usersService(usersRepository(scopeTo(db(), usersTable)));

it("reads back what it created, and NOT_FOUND for an unknown id", async () => {
  const id = await users().create({ name: "Asahi" }, new Date());

  const found = await users().get(id);
  expect(found.ok && found.value).toMatchObject({ id, name: "Asahi" });

  const missing = await users().get(userId(crypto.randomUUID()));
  expect(missing).toEqual({ ok: false, error: "NOT_FOUND" });
});

it("trims the name and keeps it between 1 and 50 characters", () => {
  expect(userInputSchema.parse({ name: "  Asahi  " }).name).toBe("Asahi");
  expect(userInputSchema.safeParse({ name: "   " }).success).toBe(false);
  expect(userInputSchema.safeParse({ name: "a".repeat(50) }).success).toBe(true);
  expect(userInputSchema.safeParse({ name: "a".repeat(51) }).success).toBe(false);
});

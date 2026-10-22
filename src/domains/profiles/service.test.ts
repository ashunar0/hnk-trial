import { expect, it } from "vitest";
import { scopeTo } from "#src/db/index";
import { alice, bob, db } from "../../../test/fixtures";
import { profilesRepository, profilesTable } from "./repo.d1";
import { profilesService } from "./service";

const profiles = () => profilesService(profilesRepository(scopeTo(db(), profilesTable)));

it("is NOT_FOUND until saved, then changes the name and keeps createdAt", async () => {
  expect(await profiles().get(alice)).toEqual({ ok: false, error: "NOT_FOUND" });

  const first = new Date("2026-10-01T00:00:00Z");
  const later = new Date("2026-10-02T00:00:00Z");
  await profiles().save(alice, { name: "Alice" }, first);
  await profiles().save(alice, { name: "Alice B." }, later);

  const found = await profiles().get(alice);
  expect(found).toEqual({
    ok: true,
    value: { userId: alice.id, name: "Alice B.", createdAt: first, updatedAt: later },
  });
  expect(await profiles().get(bob)).toEqual({ ok: false, error: "NOT_FOUND" });
});

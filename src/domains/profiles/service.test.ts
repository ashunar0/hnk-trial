import { expect, it } from "vitest";
import { scopeTo } from "#src/db/index";
import { accountId, authenticatedAccount } from "#src/domains/accounts/model";
import { db } from "../../../test/fixtures";
import { profilesRepository, profilesTable } from "./repo.d1";
import { profilesService } from "./service";

const profiles = () => profilesService(profilesRepository(scopeTo(db(), profilesTable)));

it("NOT_FOUND before saving, and save creates then changes the display name", async () => {
  const me = authenticatedAccount(accountId(`svc-${crypto.randomUUID()}`));
  expect(await profiles().get(me)).toEqual({ ok: false, error: "NOT_FOUND" });

  await profiles().save(me, { displayName: "first" }, new Date(1000));
  await profiles().save(me, { displayName: "second" }, new Date(2000));

  const found = await profiles().get(me);
  expect(found.ok && found.value.displayName).toBe("second");
  expect(found.ok && found.value.createdAt).toEqual(new Date(1000));
  expect(found.ok && found.value.updatedAt).toEqual(new Date(2000));
});

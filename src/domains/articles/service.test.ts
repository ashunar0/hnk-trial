import { expect, it } from "vitest";
import { scopeTo } from "#src/db/index";
import { accountId, authenticatedAccount } from "#src/domains/accounts/model";
import { profilesRepository, profilesTable } from "#src/domains/profiles/repo.d1";
import { profilesService } from "#src/domains/profiles/service";
import { db } from "../../../test/fixtures";
import { articleId } from "./model";
import { articlesRepository, articlesTable } from "./repo.d1";
import { articlesService } from "./service";

const articles = () => articlesService(articlesRepository(scopeTo(db(), articlesTable)));

const writer = async () => {
  const account = authenticatedAccount(accountId(`svc-${crypto.randomUUID()}`));
  // The profile is made through its own domain's service
  await profilesService(profilesRepository(scopeTo(db(), profilesTable))).save(
    account,
    { displayName: "w" },
    new Date(),
  );

  return account;
};

const input = { title: "t", body: "b" };

it("a draft is seen by its author only; NOT_FOUND for others and for unknown ids", async () => {
  const author = await writer();
  const other = await writer();
  const id = await articles().create(author, input, new Date());

  expect((await articles().get(author, id)).ok).toBe(true);
  expect(await articles().get(other, id)).toEqual({ ok: false, error: "NOT_FOUND" });
  expect(await articles().get(null, id)).toEqual({ ok: false, error: "NOT_FOUND" });
  expect(await articles().get(author, articleId(crypto.randomUUID()))).toEqual({
    ok: false,
    error: "NOT_FOUND",
  });
});

it("publish and unpublish move the state, and the wrong state is a conflict", async () => {
  const author = await writer();
  const id = await articles().create(author, input, new Date(0));

  expect(await articles().unpublish(author, id, new Date(1))).toEqual({
    ok: false,
    error: "NOT_PUBLISHED",
  });
  expect((await articles().publish(author, id, new Date(2))).ok).toBe(true);
  expect(await articles().publish(author, id, new Date(3))).toEqual({
    ok: false,
    error: "ALREADY_PUBLISHED",
  });

  const published = await articles().get(null, id);
  expect(published.ok && published.value.publishedAt).toEqual(new Date(2));

  expect((await articles().unpublish(author, id, new Date(4))).ok).toBe(true);
  expect(await articles().get(null, id)).toEqual({ ok: false, error: "NOT_FOUND" });
});

it("someone else's published article is FORBIDDEN to change; their draft is NOT_FOUND", async () => {
  const author = await writer();
  const other = await writer();
  const draft = await articles().create(author, input, new Date());
  const published = await articles().create(author, input, new Date());
  await articles().publish(author, published, new Date());

  expect(await articles().update(other, draft, input, new Date())).toEqual({
    ok: false,
    error: "NOT_FOUND",
  });
  expect(await articles().update(other, published, input, new Date())).toEqual({
    ok: false,
    error: "FORBIDDEN",
  });
  expect(await articles().remove(other, published)).toEqual({ ok: false, error: "FORBIDDEN" });
  expect(await articles().publish(other, published, new Date())).toEqual({
    ok: false,
    error: "FORBIDDEN",
  });
  expect(await articles().unpublish(other, published, new Date())).toEqual({
    ok: false,
    error: "FORBIDDEN",
  });
});

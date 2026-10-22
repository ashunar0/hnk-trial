import { expect, it } from "vitest";
import { scopeTo } from "#src/db/index";
import { profilesRepository, profilesTable } from "#src/domains/profiles/repo.d1";
import { profilesService } from "#src/domains/profiles/service";
import { alice, at, bob, db } from "../../../test/fixtures";
import { articleId, type Article } from "./model";
import { articlesRepository, articlesTable } from "./repo.d1";
import { articlesService, type ArticlesRepository } from "./service";

const articles = () => articlesService(articlesRepository(scopeTo(db(), articlesTable)));
const profiles = () => profilesService(profilesRepository(scopeTo(db(), profilesTable)));
const input = { title: "t", body: "b" };

it("needs the actor's own profile to create", async () => {
  expect(await articles().create(alice, { profile: null }, input, at(0))).toEqual({
    ok: false,
    error: "PROFILE_REQUIRED",
  });
  await expect(
    articles().create(alice, { profile: { userId: bob.id } }, input, at(0)),
  ).rejects.toThrow();
});

it("checks NOT_FOUND, then FORBIDDEN, then the state", async () => {
  await profiles().save(alice, { name: "Alice" }, at(0));
  const created = await articles().create(alice, { profile: { userId: alice.id } }, input, at(0));
  if (!created.ok) throw new Error(created.error);
  const id = created.value;

  expect(await articles().publish(bob, id, at(1))).toEqual({ ok: false, error: "NOT_FOUND" });
  expect(await articles().publish(alice, id, at(1))).toEqual({ ok: true, value: undefined });
  expect(await articles().publish(bob, id, at(2))).toEqual({ ok: false, error: "FORBIDDEN" });
  expect(await articles().publish(alice, id, at(2))).toEqual({
    ok: false,
    error: "ALREADY_PUBLISHED",
  });
  expect(await articles().getPublished(articleId("missing"))).toEqual({
    ok: false,
    error: "NOT_FOUND",
  });
});

it("is ALREADY_PUBLISHED when another request publishes in between", async () => {
  const draft: Article = {
    id: articleId("a1"),
    authorId: alice.id,
    title: "t",
    body: "b",
    status: "draft",
    publishedAt: null,
    createdAt: at(0),
    updatedAt: at(0),
  };
  // find still sees the draft, but the transition finds it moved
  const racing: ArticlesRepository = {
    find: async () => draft,
    insert: async (article) => article,
    update: async () => null,
    delete: async () => false,
    transition: async () => null,
  };

  expect(await articlesService(racing).publish(alice, draft.id, at(1))).toEqual({
    ok: false,
    error: "ALREADY_PUBLISHED",
  });
});

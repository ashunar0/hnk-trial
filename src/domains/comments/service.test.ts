import { expect, it } from "vitest";
import { scopeTo } from "#src/db/index";
import { articlesRepository, articlesTable } from "#src/domains/articles/repo.d1";
import { articlesService } from "#src/domains/articles/service";
import { profilesRepository, profilesTable } from "#src/domains/profiles/repo.d1";
import { profilesService } from "#src/domains/profiles/service";
import { alice, at, bob, db } from "../../../test/fixtures";
import { commentsRepository, commentsTable } from "./repo.d1";
import { commentsService } from "./service";

const comments = () => commentsService(commentsRepository(scopeTo(db(), commentsTable)));
const input = { body: "hi" };

it("needs the actor's own profile", async () => {
  const article = { id: "a1" };

  expect(await comments().create(alice, { article, profile: null }, input, at(0))).toEqual({
    ok: false,
    error: "PROFILE_REQUIRED",
  });
  await expect(
    comments().create(alice, { article, profile: { userId: bob.id } }, input, at(0)),
  ).rejects.toThrow();
});

it("writes a comment under the article", async () => {
  // The rows of other domains, made through their services
  await profilesService(profilesRepository(scopeTo(db(), profilesTable))).save(
    alice,
    { name: "A" },
    at(0),
  );
  const created = await articlesService(articlesRepository(scopeTo(db(), articlesTable))).create(
    alice,
    { profile: { userId: alice.id } },
    { title: "t", body: "b" },
    at(0),
  );
  if (!created.ok) throw new Error(created.error);

  const result = await comments().create(
    alice,
    { article: { id: created.value }, profile: { userId: alice.id } },
    input,
    at(1),
  );
  expect(result.ok).toBe(true);
});

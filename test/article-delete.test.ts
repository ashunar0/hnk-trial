import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { makeDeps } from "#src/deps";
import { request, signUp, writePublished } from "./fixtures";

it("deletes the comments of a deleted article from the database, not only from view", async () => {
  const author = await signUp();
  const id = await writePublished(author);
  await request(author, "POST", `/articles/${id}/comments`, { body: "one" });
  await request(author, "POST", `/articles/${id}/comments`, { body: "two" });
  const { commentsQueries } = makeDeps(env);
  expect((await commentsQueries.listOf(id, { limit: 10 })).items).toHaveLength(2);

  await request(author, "DELETE", `/articles/${id}`);

  expect((await commentsQueries.listOf(id, { limit: 10 })).items).toEqual([]);
});

it("keeps the comments of an unpublished article in the database", async () => {
  const author = await signUp();
  const id = await writePublished(author);
  await request(author, "POST", `/articles/${id}/comments`, { body: "kept" });

  await request(author, "POST", `/articles/${id}/unpublish`);

  const { commentsQueries } = makeDeps(env);
  expect((await commentsQueries.listOf(id, { limit: 10 })).items).toHaveLength(1);
});

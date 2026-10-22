import { expect, it } from "vitest";
import { scopeTo } from "#src/db/index";
import { db, signUp } from "../../../test/fixtures";
import { articleId, articleInputSchema } from "./model";
import { articlesRepository, articlesTable } from "./repo.d1";
import { articlesService } from "./service";

const articles = () => articlesService(articlesRepository(scopeTo(db(), articlesTable)));

const input = { title: "Title", body: "Body" };
const at = new Date("2026-01-01T00:00:00Z");
const later = new Date("2026-01-02T00:00:00Z");

it("creates a draft that its author reads back, and NOT_FOUND for an unknown id", async () => {
  const author = await signUp();

  const id = await articles().create(author, input, at);

  const found = await articles().get(author, id);
  expect(found.ok && found.value).toMatchObject({
    id,
    authorId: author.id,
    status: "draft",
    publishedAt: null,
  });
  const missing = await articles().get(author, articleId(crypto.randomUUID()));
  expect(missing).toEqual({ ok: false, error: "NOT_FOUND" });
});

it("hides a draft from everyone but its author", async () => {
  const author = await signUp();
  const other = await signUp();
  const id = await articles().create(author, input, at);

  expect(await articles().get(other, id)).toEqual({ ok: false, error: "NOT_FOUND" });
  expect(await articles().update(other, id, input, later)).toEqual({
    ok: false,
    error: "NOT_FOUND",
  });
  expect(await articles().remove(other, id)).toEqual({ ok: false, error: "NOT_FOUND" });
  expect(await articles().publish(other, id, later)).toEqual({ ok: false, error: "NOT_FOUND" });
  expect(await articles().unpublish(other, id, later)).toEqual({ ok: false, error: "NOT_FOUND" });
});

it("publishes a draft, and ALREADY_PUBLISHED the second time", async () => {
  const author = await signUp();
  const id = await articles().create(author, input, at);

  expect(await articles().publish(author, id, later)).toEqual({ ok: true, value: undefined });
  const found = await articles().get(author, id);
  expect(found.ok && found.value).toMatchObject({ status: "published", publishedAt: later });

  expect(await articles().publish(author, id, later)).toEqual({
    ok: false,
    error: "ALREADY_PUBLISHED",
  });
});

it("unpublishes back to a draft, and NOT_PUBLISHED for a draft", async () => {
  const author = await signUp();
  const id = await articles().create(author, input, at);

  expect(await articles().unpublish(author, id, later)).toEqual({
    ok: false,
    error: "NOT_PUBLISHED",
  });

  await articles().publish(author, id, later);
  expect(await articles().unpublish(author, id, later)).toEqual({ ok: true, value: undefined });
  const found = await articles().get(author, id);
  expect(found.ok && found.value).toMatchObject({ status: "draft", publishedAt: null });
});

it("lets others see a published article but only its author change it (FORBIDDEN)", async () => {
  const author = await signUp();
  const other = await signUp();
  const id = await articles().create(author, input, at);
  await articles().publish(author, id, later);

  expect((await articles().get(other, id)).ok).toBe(true);
  const forbidden = { ok: false, error: "FORBIDDEN" };
  expect(await articles().update(other, id, input, later)).toEqual(forbidden);
  expect(await articles().remove(other, id)).toEqual(forbidden);
  expect(await articles().publish(other, id, later)).toEqual(forbidden);
  expect(await articles().unpublish(other, id, later)).toEqual(forbidden);
});

it("replaces the title and the body, and deletes", async () => {
  const author = await signUp();
  const id = await articles().create(author, input, at);

  await articles().update(author, id, { title: "New", body: "New body" }, later);
  const found = await articles().get(author, id);
  expect(found.ok && found.value).toMatchObject({
    title: "New",
    body: "New body",
    updatedAt: later,
  });

  expect(await articles().remove(author, id)).toEqual({ ok: true, value: undefined });
  expect(await articles().get(author, id)).toEqual({ ok: false, error: "NOT_FOUND" });
  expect(await articles().remove(author, id)).toEqual({ ok: false, error: "NOT_FOUND" });
});

it("trims the title and keeps it between 1 and 200 characters; the body needs 1 character", () => {
  expect(articleInputSchema.parse({ title: "  T  ", body: "b" }).title).toBe("T");
  expect(articleInputSchema.safeParse({ title: "  ", body: "b" }).success).toBe(false);
  expect(articleInputSchema.safeParse({ title: "a".repeat(200), body: "b" }).success).toBe(true);
  expect(articleInputSchema.safeParse({ title: "a".repeat(201), body: "b" }).success).toBe(false);
  expect(articleInputSchema.safeParse({ title: "t", body: "" }).success).toBe(false);
});

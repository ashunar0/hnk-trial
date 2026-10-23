import { expect, it } from "vitest";
import { person, personWithProfile, request, writeArticle } from "../../../../../test/fixtures";

type PageBody = { items: { id: string; title: string }[]; nextCursor: string | null };

it("lists that person's published articles, newest published first, in pages", async () => {
  const writer = await personWithProfile("w");
  const other = await personWithProfile("o");
  await writeArticle(writer, { title: "draft" });
  await writeArticle(other, { title: "not theirs" }, new Date("2026-01-09T00:00:00Z"));
  await writeArticle(writer, { title: "a" }, new Date("2026-01-01T00:00:00Z"));
  await writeArticle(writer, { title: "b" }, new Date("2026-01-02T00:00:00Z"));
  await writeArticle(writer, { title: "c" }, new Date("2026-01-03T00:00:00Z"));

  const first = (await (
    await request(null, "GET", `/users/${writer.id}/articles?limit=2`)
  ).json()) as PageBody;
  expect(first.items.map((item) => item.title)).toEqual(["c", "b"]);

  const rest = (await (
    await request(null, "GET", `/users/${writer.id}/articles?limit=2&cursor=${first.nextCursor}`)
  ).json()) as PageBody;
  expect(rest.items.map((item) => item.title)).toEqual(["a"]);
  expect(rest.nextCursor).toBeNull();
});

it("a person with a profile and no published articles gets an empty list; 404 without a profile", async () => {
  const writer = await personWithProfile("w");

  const empty = await request(null, "GET", `/users/${writer.id}/articles`);
  expect(await empty.json()).toEqual({ items: [], nextCursor: null });

  expect((await request(null, "GET", `/users/${person("x").id}/articles`)).status).toBe(404);
});

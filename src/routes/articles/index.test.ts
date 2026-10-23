import { expect, it } from "vitest";
import { person, personWithProfile, request, writeArticle } from "../../../test/fixtures";

type Item = {
  id: string;
  title: string;
  author: { id: string; displayName: string };
  publishedAt: string;
  commentCount: number;
};
type PageBody = { items: Item[]; nextCursor: string | null };

it("POST: 401 signed out, 400 bad input, PROFILE_REQUIRED without a profile", async () => {
  expect((await request(null, "POST", "/articles", { title: "t", body: "b" })).status).toBe(401);

  const writer = await personWithProfile("w");
  expect((await request(writer, "POST", "/articles", { title: " ", body: "b" })).status).toBe(400);
  expect(
    (await request(writer, "POST", "/articles", { title: "x".repeat(201), body: "b" })).status,
  ).toBe(400);
  expect((await request(writer, "POST", "/articles", { title: "t", body: "" })).status).toBe(400);

  const res = await request(person("noprofile"), "POST", "/articles", { title: "t", body: "b" });
  expect(res.status).toBe(403);
  expect(await res.json()).toMatchObject({ error: { code: "PROFILE_REQUIRED" } });
});

it("POST: makes a draft and shows it as GET shows it", async () => {
  const writer = await personWithProfile("w");
  const at = new Date("2026-01-01T00:00:00Z");

  const res = await request(writer, "POST", "/articles", { title: " Hello ", body: " body " }, at);

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    id: expect.any(String),
    title: "Hello",
    body: " body ",
    author: { id: writer.id, displayName: "w" },
    status: "draft",
    publishedAt: null,
    commentCount: 0,
    createdAt: at.toISOString(),
    updatedAt: at.toISOString(),
  });
});

it("GET: lists only published articles, newest published first, in pages", async () => {
  const writer = await personWithProfile("w");
  const draft = await writeArticle(writer, { title: "draft" });
  const first = await writeArticle(writer, { title: "first" }, new Date("2026-01-01T00:00:00Z"));
  const second = await writeArticle(writer, { title: "second" }, new Date("2026-01-02T00:00:00Z"));
  const third = await writeArticle(writer, { title: "third" }, new Date("2026-01-03T00:00:00Z"));

  // Others' articles are in the list too, so follow the cursor and keep only these
  const mine = new Set([draft, first, second, third]);
  const seen: string[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const res = await request(null, "GET", `/articles?limit=2${cursor ? `&cursor=${cursor}` : ""}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as PageBody;
    expect(body.items.length).toBeLessThanOrEqual(2);
    seen.push(...body.items.map((item) => item.id).filter((id) => mine.has(id)));
    cursor = body.nextCursor;
    pages++;
  } while (cursor !== null && pages < 50);

  expect(seen).toEqual([third, second, first]);
});

it("GET: shows author and comment count", async () => {
  const writer = await personWithProfile("w");
  const id = await writeArticle(writer, { title: "t" }, new Date("2026-02-01T00:00:00Z"));
  await request(writer, "POST", `/articles/${id}/comments`, { body: "c" });

  const res = await request(null, "GET", "/articles?limit=100");
  const body = (await res.json()) as PageBody;

  expect(body.items.find((item) => item.id === id)).toEqual({
    id,
    title: "t",
    author: { id: writer.id, displayName: "w" },
    publishedAt: "2026-02-01T00:00:00.000Z",
    commentCount: 1,
  });
});

it("GET: 400 for a bad limit", async () => {
  expect((await request(null, "GET", "/articles?limit=0")).status).toBe(400);
});

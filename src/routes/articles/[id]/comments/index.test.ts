import { expect, it } from "vitest";
import { person, personWithProfile, request, writeArticle } from "../../../../../test/fixtures";

type Item = {
  id: string;
  body: string;
  author: { id: string; displayName: string };
  createdAt: string;
};
type PageBody = { items: Item[]; nextCursor: string | null };

it("POST: comments on a published article and shows the comment", async () => {
  const writer = await personWithProfile("w");
  const reader = await personWithProfile("r");
  const id = await writeArticle(writer, {}, new Date());
  const at = new Date("2026-04-01T00:00:00Z");

  const res = await request(reader, "POST", `/articles/${id}/comments`, { body: " nice " }, at);

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    id: expect.any(String),
    body: "nice",
    author: { id: reader.id, displayName: "r" },
    createdAt: at.toISOString(),
  });
  expect(await (await request(null, "GET", `/articles/${id}`)).json()).toMatchObject({
    commentCount: 1,
  });
});

it("POST: 401, 400, 404 (missing or draft, even the author's), PROFILE_REQUIRED", async () => {
  const writer = await personWithProfile("w");
  const id = await writeArticle(writer, {}, new Date());
  const draft = await writeArticle(writer);
  const body = { body: "c" };

  expect((await request(null, "POST", `/articles/${id}/comments`, body)).status).toBe(401);
  expect((await request(writer, "POST", `/articles/${id}/comments`, { body: "  " })).status).toBe(
    400,
  );
  expect(
    (await request(writer, "POST", `/articles/${id}/comments`, { body: "x".repeat(1001) })).status,
  ).toBe(400);
  expect(
    (await request(writer, "POST", `/articles/${crypto.randomUUID()}/comments`, body)).status,
  ).toBe(404);
  expect((await request(writer, "POST", `/articles/${draft}/comments`, body)).status).toBe(404);

  const res = await request(person("noprofile"), "POST", `/articles/${id}/comments`, body);
  expect(res.status).toBe(403);
  expect(await res.json()).toMatchObject({ error: { code: "PROFILE_REQUIRED" } });
});

it("GET: lists oldest first in pages; 404 for a draft or a missing article", async () => {
  const writer = await personWithProfile("w");
  const id = await writeArticle(writer, {}, new Date());
  for (const at of [3, 1, 2]) {
    await request(
      writer,
      "POST",
      `/articles/${id}/comments`,
      { body: `c${at}` },
      new Date(2026, 0, at),
    );
  }

  const first = (await (
    await request(null, "GET", `/articles/${id}/comments?limit=2`)
  ).json()) as PageBody;
  expect(first.items.map((item) => item.body)).toEqual(["c1", "c2"]);
  expect(first.nextCursor).not.toBeNull();

  const second = (await (
    await request(null, "GET", `/articles/${id}/comments?limit=2&cursor=${first.nextCursor}`)
  ).json()) as PageBody;
  expect(second.items.map((item) => item.body)).toEqual(["c3"]);
  expect(second.nextCursor).toBeNull();

  const draft = await writeArticle(writer);
  expect((await request(writer, "GET", `/articles/${draft}/comments`)).status).toBe(404);
  expect((await request(null, "GET", `/articles/${crypto.randomUUID()}/comments`)).status).toBe(
    404,
  );
});

it("comments stay while unpublished (and still count), and show again after publishing", async () => {
  const writer = await personWithProfile("w");
  const id = await writeArticle(writer, {}, new Date());
  await request(writer, "POST", `/articles/${id}/comments`, { body: "kept" });

  await request(writer, "POST", `/articles/${id}/unpublish`);
  expect((await request(null, "GET", `/articles/${id}/comments`)).status).toBe(404);
  expect(await (await request(writer, "GET", `/articles/${id}`)).json()).toMatchObject({
    commentCount: 1,
  });

  await request(writer, "POST", `/articles/${id}/publish`);
  const list = (await (await request(null, "GET", `/articles/${id}/comments`)).json()) as PageBody;
  expect(list.items.map((item) => item.body)).toEqual(["kept"]);
});

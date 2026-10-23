import { expect, it } from "vitest";
import { personWithProfile, request, writeArticle } from "../../../../test/fixtures";

const missing = () => crypto.randomUUID();

it("GET: a published article is read by anyone, even signed out", async () => {
  const writer = await personWithProfile("w");
  const id = await writeArticle(
    writer,
    { title: "t", body: "b" },
    new Date("2026-01-01T00:00:00Z"),
  );

  const res = await request(null, "GET", `/articles/${id}`);

  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    id,
    status: "published",
    publishedAt: "2026-01-01T00:00:00.000Z",
    author: { id: writer.id, displayName: "w" },
  });
});

it("GET: a draft is seen by its author only; others get 404", async () => {
  const writer = await personWithProfile("w");
  const other = await personWithProfile("o");
  const id = await writeArticle(writer);

  expect((await request(writer, "GET", `/articles/${id}`)).status).toBe(200);
  expect((await request(other, "GET", `/articles/${id}`)).status).toBe(404);
  expect((await request(null, "GET", `/articles/${id}`)).status).toBe(404);
  expect((await request(null, "GET", `/articles/${missing()}`)).status).toBe(404);
});

it("PUT: the author changes title and body, draft or published", async () => {
  const writer = await personWithProfile("w");
  const id = await writeArticle(writer);
  const at = new Date("2026-03-01T00:00:00Z");

  const draft = await request(writer, "PUT", `/articles/${id}`, { title: " new ", body: "nb" }, at);
  expect(draft.status).toBe(200);
  expect(await draft.json()).toMatchObject({
    title: "new",
    body: "nb",
    status: "draft",
    updatedAt: at.toISOString(),
  });

  await request(writer, "POST", `/articles/${id}/publish`);
  const published = await request(writer, "PUT", `/articles/${id}`, { title: "again", body: "b2" });
  expect(published.status).toBe(200);
  expect(await published.json()).toMatchObject({ title: "again", status: "published" });
});

it("PUT: 401, 400, 404 for someone else's draft, 403 for someone else's published", async () => {
  const writer = await personWithProfile("w");
  const other = await personWithProfile("o");
  const draft = await writeArticle(writer);
  const published = await writeArticle(writer, {}, new Date());
  const input = { title: "x", body: "y" };

  expect((await request(null, "PUT", `/articles/${draft}`, input)).status).toBe(401);
  expect(
    (await request(writer, "PUT", `/articles/${draft}`, { title: "", body: "y" })).status,
  ).toBe(400);
  expect((await request(other, "PUT", `/articles/${draft}`, input)).status).toBe(404);
  expect((await request(writer, "PUT", `/articles/${missing()}`, input)).status).toBe(404);

  const forbidden = await request(other, "PUT", `/articles/${published}`, input);
  expect(forbidden.status).toBe(403);
  expect(await forbidden.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
  // Nothing changed
  const read = await request(null, "GET", `/articles/${published}`);
  expect(await read.json()).toMatchObject({ title: "title" });
});

it("DELETE: the author deletes it, and its comments go too", async () => {
  const writer = await personWithProfile("w");
  const id = await writeArticle(writer, {}, new Date());
  const comment = await request(writer, "POST", `/articles/${id}/comments`, { body: "c" });
  expect(comment.status).toBe(200);

  const res = await request(writer, "DELETE", `/articles/${id}`);

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
  expect((await request(null, "GET", `/articles/${id}`)).status).toBe(404);
  expect((await request(null, "GET", `/articles/${id}/comments`)).status).toBe(404);
});

it("DELETE: 401, 404 for someone else's draft, 403 for someone else's published", async () => {
  const writer = await personWithProfile("w");
  const other = await personWithProfile("o");
  const draft = await writeArticle(writer);
  const published = await writeArticle(writer, {}, new Date());

  expect((await request(null, "DELETE", `/articles/${draft}`)).status).toBe(401);
  expect((await request(other, "DELETE", `/articles/${draft}`)).status).toBe(404);
  expect((await request(other, "DELETE", `/articles/${published}`)).status).toBe(403);
  expect((await request(writer, "DELETE", `/articles/${missing()}`)).status).toBe(404);
  expect((await request(null, "GET", `/articles/${published}`)).status).toBe(200);
});

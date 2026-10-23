import { expect, it } from "vitest";
import { personWithProfile, request, writeArticle } from "../../../../../test/fixtures";

it("turns a published article back into a draft", async () => {
  const writer = await personWithProfile("w");
  const id = await writeArticle(writer, {}, new Date());

  const res = await request(writer, "POST", `/articles/${id}/unpublish`);

  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ status: "draft", publishedAt: null });
  expect((await request(null, "GET", `/articles/${id}`)).status).toBe(404);
});

it("NOT_PUBLISHED (409) for a draft", async () => {
  const writer = await personWithProfile("w");
  const id = await writeArticle(writer);

  const res = await request(writer, "POST", `/articles/${id}/unpublish`);

  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ error: { code: "NOT_PUBLISHED" } });
});

it("401, 404 for someone else's draft, 403 for someone else's published", async () => {
  const writer = await personWithProfile("w");
  const other = await personWithProfile("o");
  const draft = await writeArticle(writer);
  const published = await writeArticle(writer, {}, new Date());

  expect((await request(null, "POST", `/articles/${published}/unpublish`)).status).toBe(401);
  expect((await request(other, "POST", `/articles/${draft}/unpublish`)).status).toBe(404);
  expect((await request(other, "POST", `/articles/${published}/unpublish`)).status).toBe(403);
  expect((await request(writer, "POST", `/articles/${crypto.randomUUID()}/unpublish`)).status).toBe(
    404,
  );
  expect(await (await request(null, "GET", `/articles/${published}`)).json()).toMatchObject({
    status: "published",
  });
});

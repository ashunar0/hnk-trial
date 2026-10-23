import { expect, it } from "vitest";
import { personWithProfile, request, writeArticle } from "../../../../../test/fixtures";

it("publishes a draft at now, and publishing again later takes the new time", async () => {
  const writer = await personWithProfile("w");
  const id = await writeArticle(writer);
  const first = new Date("2026-01-01T00:00:00Z");
  const second = new Date("2026-01-05T00:00:00Z");

  const res = await request(writer, "POST", `/articles/${id}/publish`, undefined, first);
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ status: "published", publishedAt: first.toISOString() });

  await request(writer, "POST", `/articles/${id}/unpublish`);
  const again = await request(writer, "POST", `/articles/${id}/publish`, undefined, second);
  expect(await again.json()).toMatchObject({
    status: "published",
    publishedAt: second.toISOString(),
  });
});

it("ALREADY_PUBLISHED (409) for a published article", async () => {
  const writer = await personWithProfile("w");
  const id = await writeArticle(writer, {}, new Date());

  const res = await request(writer, "POST", `/articles/${id}/publish`);

  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ error: { code: "ALREADY_PUBLISHED" } });
});

it("401, 404 for someone else's draft, 403 for someone else's published", async () => {
  const writer = await personWithProfile("w");
  const other = await personWithProfile("o");
  const draft = await writeArticle(writer);
  const published = await writeArticle(writer, {}, new Date());

  expect((await request(null, "POST", `/articles/${draft}/publish`)).status).toBe(401);
  expect((await request(other, "POST", `/articles/${draft}/publish`)).status).toBe(404);
  expect((await request(other, "POST", `/articles/${published}/publish`)).status).toBe(403);
  expect((await request(writer, "POST", `/articles/${crypto.randomUUID()}/publish`)).status).toBe(
    404,
  );
  // The draft is still a draft
  expect(await (await request(writer, "GET", `/articles/${draft}`)).json()).toMatchObject({
    status: "draft",
  });
});

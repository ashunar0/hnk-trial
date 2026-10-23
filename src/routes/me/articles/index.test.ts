import { expect, it } from "vitest";
import { personWithProfile, request, writeArticle } from "../../../../test/fixtures";

type PageBody = {
  items: { id: string; title: string; status: string; publishedAt: string | null }[];
  nextCursor: string | null;
};

it("401 when signed out", async () => {
  expect((await request(null, "GET", "/me/articles")).status).toBe(401);
});

it("lists my articles with drafts, newest created first, in pages; not others'", async () => {
  const me = await personWithProfile("me");
  const other = await personWithProfile("o");
  const a = await writeArticle(me, { title: "a" });
  await request(
    me,
    "POST",
    "/articles",
    { title: "b", body: "b" },
    new Date("2030-01-01T00:00:00Z"),
  );
  await writeArticle(other, { title: "theirs" });
  await request(me, "POST", `/articles/${a}/publish`);

  const first = (await (await request(me, "GET", "/me/articles?limit=1")).json()) as PageBody;
  expect(first.items.map((item) => item.title)).toEqual(["b"]);
  expect(first.items[0]).toMatchObject({ status: "draft", publishedAt: null });

  const rest = (await (
    await request(me, "GET", `/me/articles?limit=1&cursor=${first.nextCursor}`)
  ).json()) as PageBody;
  expect(rest.items.map((item) => item.title)).toEqual(["a"]);
  expect(rest.items[0]).toMatchObject({ status: "published" });
  expect(rest.nextCursor).toBeNull();
});

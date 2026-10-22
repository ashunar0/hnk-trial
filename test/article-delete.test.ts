/**
 * Across domains: deleting an article (articles) deletes its comments (comments)
 */
import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { alice, request, signUp, writePublished } from "./fixtures";

const commentsOf = async (articleId: string) =>
  (
    await env.DB.prepare("select count(*) as n from comments where article_id = ?")
      .bind(articleId)
      .first<{ n: number }>()
  )?.n;

it("deletes the comments with the article, and only those", async () => {
  await signUp(alice);
  const deleted = await writePublished(alice);
  const kept = await writePublished(alice);
  await request(alice, "POST", `/articles/${deleted}/comments`, { body: "gone" });
  await request(alice, "POST", `/articles/${kept}/comments`, { body: "stays" });

  await request(alice, "DELETE", `/articles/${deleted}`);

  expect(await commentsOf(deleted)).toBe(0);
  expect(await commentsOf(kept)).toBe(1);
});

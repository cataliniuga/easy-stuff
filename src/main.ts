import { swagger } from "@elysiajs/swagger";
import { Elysia, t } from "elysia";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(":memory:");

if (
  !db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='todos'",
    )
    .get()
) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);
}

export const app = new Elysia()
  // @ts-expect-error idk
  .use(swagger())
  .get("/", () => "Hello there!")
  .get("/todos", () => {
    return db.prepare("SELECT * FROM todos ORDER BY created_at DESC").all();
  })
  .post(
    "/todos",
    ({ body }) => {
      const result = db
        .prepare("INSERT INTO todos (title) VALUES (?)")
        .run(body.title);

      return {
        id: result.lastInsertRowid,
        title: body.title,
        completed: 0,
      };
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1 }),
      }),
    },
  )
  .patch(
    "/todos/:id",
    ({ params: { id }, body }) => {
      db.prepare("UPDATE todos SET completed = ? WHERE id = ?").run(
        body.completed ? 1 : 0,
        id,
      );

      return db.prepare("SELECT * FROM todos WHERE id = ?").get(id);
    },
    {
      body: t.Object({
        completed: t.Boolean(),
      }),
    },
  )
  .delete("/todos/:id", ({ params: { id } }) => {
    db.prepare("DELETE FROM todos WHERE id = ?").run(id);
    return { id };
  });

Deno.serve(app.fetch);

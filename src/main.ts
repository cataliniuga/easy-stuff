import { Elysia, t } from "elysia";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("database.sqlite");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    name TEXT NOT NULL UNIQUE
  );
  
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    priority TEXT CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
    status TEXT CHECK(status IN ('pending', 'in_progress', 'completed')) DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    user_name TEXT NOT NULL,
    FOREIGN KEY (user_name) REFERENCES users(name) ON DELETE CASCADE
  );
`);

const app = new Elysia()
  .get("/", () => "Todo API")
  .onError(({ error }) => {
    console.error(error);
    return { message: "Internal server error" };
  })
  .get("/users", () => db.prepare("SELECT * FROM users").all())
  .post("/users", ({
    body: { name },
    error,
  }) => {
    try {
      db.prepare("INSERT INTO users (name) VALUES (?)").run(name);
      return { name };
    } catch {
      return error(400, { message: "User already exists" });
    }
  }, {
    body: t.Object({
      name: t.String({
        minLength: 3,
        maxLength: 20,
      }),
    }),
  })
  // Todo endpoints
  .get("/users/:userName/todos", ({ params: { userName }, error }) => {
    const user = db.prepare("SELECT * FROM users WHERE name = ?").get(userName);
    if (!user) {
      return error(404, { message: "User not found" });
    }

    return db.prepare(`
      SELECT * FROM todos 
      WHERE user_name = ? 
      ORDER BY 
        CASE status
          WHEN 'pending' THEN 1
          WHEN 'in_progress' THEN 2
          WHEN 'completed' THEN 3
        END,
        CASE priority
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
        END,
        due_date ASC
    `).all(userName);
  })
  .get("/users/:userName/todos/:id", ({ params: { userName, id }, error }) => {
    const todo = db.prepare(
      "SELECT * FROM todos WHERE id = ? AND user_name = ?",
    ).get(id, userName);

    if (!todo) {
      return error(404, { message: "Todo not found" });
    }

    return todo;
  })
  .post("/users/:userName/todos", ({
    params: { userName },
    body,
    error,
  }) => {
    const user = db.prepare("SELECT * FROM users WHERE name = ?").get(userName);
    if (!user) {
      return error(404, { message: "User not found" });
    }

    try {
      const result = db.prepare(`
        INSERT INTO todos (title, description, due_date, priority, user_name)
        VALUES (?, ?, ?, ?, ?)
      `);

    } catch (err) {
      throw err;
    }
  }, {
    body: t.Object({
      title: t.String({ minLength: 1, maxLength: 100 }),
      description: t.Optional(t.String({ maxLength: 500 })),
      dueDate: t.Optional(t.String()),
      priority: t.Optional(t.Union([
        t.Literal("low"),
        t.Literal("medium"),
        t.Literal("high"),
      ])),
    }),
  })
  .patch("/users/:userName/todos/:id", ({
    params: { userName, id },
    body,
    error,
  }) => {
    const todo = db.prepare(
      "SELECT * FROM todos WHERE id = ? AND user_name = ?",
    ).get(id, userName);

    if (!todo) {
      return error(404, { message: "Todo not found" });
    }

    const updates = [];
    const values = [];

    if (body.title !== undefined) {
      updates.push("title = ?");
      values.push(body.title);
    }
    if (body.description !== undefined) {
      updates.push("description = ?");
      values.push(body.description);
    }
    if (body.dueDate !== undefined) {
      updates.push("due_date = ?");
      values.push(body.dueDate);
    }
    if (body.priority !== undefined) {
      updates.push("priority = ?");
      values.push(body.priority);
    }
    if (body.status !== undefined) {
      updates.push("status = ?");
      values.push(body.status);
    }

    if (updates.length === 0) {
      return todo;
    }

    try {
      db.prepare(`
        UPDATE todos 
        SET ${updates.join(", ")}
        WHERE id = ? AND user_name = ?
      `).run(...values, id, userName);

      return db.prepare(
        "SELECT * FROM todos WHERE id = ? AND user_name = ?",
      ).get(id, userName);
    } catch (err) {
      throw err;
    }
  }, {
    body: t.Object({
      title: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
      description: t.Optional(t.String({ maxLength: 500 })),
      dueDate: t.Optional(t.String()),
      priority: t.Optional(t.Union([
        t.Literal("low"),
        t.Literal("medium"),
        t.Literal("high"),
      ])),
      status: t.Optional(t.Union([
        t.Literal("pending"),
        t.Literal("in_progress"),
        t.Literal("completed"),
      ])),
    }),
  })
  .delete("/users/:userName/todos/:id", ({
    params: { userName, id },
    error,
  }) => {
    try {
      const result = db.prepare(
        "DELETE FROM todos WHERE id = ? AND user_name = ?",
      ).run(id, userName);

      if (result.changes === 0) {
        return error(404, { message: "Todo not found" });
      }

      return { id, message: "Todo deleted successfully" };
    } catch (err) {
      throw err;
    }
  });

Deno.serve(app.fetch);

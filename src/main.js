import Database from "better-sqlite3";
import cors from "cors";
import express from "express";

const app = express();
const db = new Database(":memory:");

db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello there!");
});

app.get("/todos", (req, res) => {
  try {
    const todos = db
      .prepare("SELECT * FROM todos ORDER BY created_at DESC")
      .all();
    res.json(todos);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch todos" });
  }
});

app.post("/todos", (req, res) => {
  try {
    const { title } = req.body;

    if (!title || typeof title !== "string" || title.length === 0) {
      return res.status(400).json({ error: "Title is required" });
    }

    const result = db
      .prepare("INSERT INTO todos (title) VALUES (?)")
      .run(title);

    res.status(201).json({
      id: result.lastInsertRowid,
      title,
      completed: 0,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create todo" });
  }
});

app.patch("/todos/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { completed } = req.body;

    if (typeof completed !== "boolean") {
      return res.status(400).json({ error: "Completed must be a boolean" });
    }

    const result = db
      .prepare("UPDATE todos SET completed = ? WHERE id = ?")
      .run(completed ? 1 : 0, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Todo not found" });
    }

    const todo = db.prepare("SELECT * FROM todos WHERE id = ?").get(id);
    res.json(todo);
  } catch (error) {
    res.status(500).json({ error: "Failed to update todo" });
  }
});

app.delete("/todos/:id", (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare("DELETE FROM todos WHERE id = ?").run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Todo not found" });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete todo" });
  }
});

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

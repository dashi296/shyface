import * as SQLite from 'expo-sqlite'

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('shyface.db').then(async (db) => {
      await migrate(db)
      return db
    })
  }
  return dbPromise
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS persons (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      memo       TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS embeddings (
      id         TEXT PRIMARY KEY,
      person_id  TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      embedding  TEXT NOT NULL,
      source_uri TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
}

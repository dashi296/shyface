/**
 * Jest manual mock for expo-sqlite.
 * expo-sqlite はネイティブモジュールのため Jest（Node.js 環境）では動作しない。
 * このモックは better-sqlite3 のインメモリ DB で同等の API を提供し、
 * shared/db の実装をそのままテストできるようにする。
 *
 * __mocks__ ディレクトリに配置することで Jest が自動的に使用する（jest.mock('expo-sqlite') 不要）。
 */
import Database from 'better-sqlite3'

type BindParam = string | number | null

// Jest ワーカー（＝テストファイル）ごとに独立したインメモリ DB を作成する。
const internalDb = new Database(':memory:')

class MockSQLiteDatabase {
  execAsync(sql: string): Promise<void> {
    internalDb.exec(sql)
    return Promise.resolve()
  }

  withTransactionAsync(fn: () => Promise<void>): Promise<void> {
    return fn()
  }

  getAllAsync<T>(sql: string, params?: BindParam[]): Promise<T[]> {
    const stmt = internalDb.prepare(sql)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (params != null ? stmt.all(...(params as any[])) : stmt.all()) as T[]
    return Promise.resolve(rows)
  }

  getFirstAsync<T>(sql: string, params?: BindParam[]): Promise<T | null> {
    const stmt = internalDb.prepare(sql)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (params != null ? stmt.get(...(params as any[])) : stmt.get()) as T | undefined
    return Promise.resolve(row ?? null)
  }

  runAsync(sql: string, params?: BindParam[]): Promise<void> {
    const stmt = internalDb.prepare(sql)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (params != null) stmt.run(...(params as any[]))
    else stmt.run()
    return Promise.resolve()
  }
}

const mockDb = new MockSQLiteDatabase()

export function openDatabaseAsync(_name: string): Promise<MockSQLiteDatabase> {
  return Promise.resolve(mockDb)
}

/**
 * テスト用ヘルパー: すべてのアプリケーションテーブルの行を削除する。
 * jest.setup.ts の global beforeEach から各テスト前に自動呼び出しされる。
 */
export function __resetDatabase(): void {
  try {
    internalDb.exec('DELETE FROM embeddings; DELETE FROM persons;')
  } catch {
    // 最初のマイグレーション実行前はテーブルが存在しない場合がある
  }
}

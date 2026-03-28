/**
 * Jest グローバルセットアップ。
 * 各テストの前にインメモリ SQLite DB の全行を削除し、テスト間のデータ汚染を防ぐ。
 */
beforeEach(() => {
  const sqliteModule = require('expo-sqlite') as { __resetDatabase?: () => void }
  sqliteModule.__resetDatabase?.()
})

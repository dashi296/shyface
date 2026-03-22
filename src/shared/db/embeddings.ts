import { getDb } from './client'

export interface Embedding {
  id: string
  person_id: string
  embedding: string
  source_uri: string
  created_at: string
  updated_at: string
}

export async function getEmbeddingsByPersonId(personId: string): Promise<Embedding[]> {
  const db = await getDb()
  return db.getAllAsync<Embedding>(
    'SELECT * FROM embeddings WHERE person_id = ? ORDER BY created_at ASC',
    [personId]
  )
}

export async function getAllEmbeddings(): Promise<Embedding[]> {
  const db = await getDb()
  return db.getAllAsync<Embedding>('SELECT * FROM embeddings')
}

export async function insertEmbedding(embedding: Embedding): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    'INSERT INTO embeddings (id, person_id, embedding, source_uri, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [
      embedding.id,
      embedding.person_id,
      embedding.embedding,
      embedding.source_uri,
      embedding.created_at,
      embedding.updated_at,
    ]
  )
}

export async function deleteEmbeddingsByPersonId(personId: string): Promise<void> {
  const db = await getDb()
  await db.runAsync('DELETE FROM embeddings WHERE person_id = ?', [personId])
}

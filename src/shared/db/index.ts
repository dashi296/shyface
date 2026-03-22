export { getDb } from './client'
export type { Person } from './persons'
export {
  getAllPersons,
  getPersonById,
  insertPerson,
  deletePerson,
} from './persons'
export type { Embedding } from './embeddings'
export {
  getEmbeddingsByPersonId,
  getAllEmbeddings,
  insertEmbedding,
  deleteEmbeddingsByPersonId,
} from './embeddings'

import { getDb } from './client'

export interface Person {
  id: string
  name: string
  memo: string | null
  created_at: string
  updated_at: string
}

export async function getAllPersons(): Promise<Person[]> {
  const db = await getDb()
  return db.getAllAsync<Person>('SELECT * FROM persons ORDER BY created_at DESC')
}

export async function getPersonById(id: string): Promise<Person | null> {
  const db = await getDb()
  return db.getFirstAsync<Person>('SELECT * FROM persons WHERE id = ?', [id])
}

export async function insertPerson(person: Person): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    'INSERT INTO persons (id, name, memo, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [person.id, person.name, person.memo ?? null, person.created_at, person.updated_at]
  )
}

export async function deletePerson(id: string): Promise<void> {
  const db = await getDb()
  await db.runAsync('DELETE FROM persons WHERE id = ?', [id])
}

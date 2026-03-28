import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { usePersons } from '../usePersons'
import { insertPerson } from '@/shared/db'
import * as dbModule from '@/shared/db'
import type { Person } from '@/shared/db'

jest.mock('@/shared/db', () => ({ __esModule: true, ...jest.requireActual('@/shared/db') }))

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0 } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

const NOW = '2026-01-01T00:00:00.000Z'

function makePerson(overrides: Partial<Person> = {}): Person {
  return { id: '1', name: 'Alice', memo: null, created_at: NOW, updated_at: NOW, ...overrides }
}

describe('usePersons', () => {
  afterEach(() => jest.restoreAllMocks())

  it('returns persons from db', async () => {
    await insertPerson(makePerson())

    const { result } = renderHook(() => usePersons(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([makePerson()])
  })

  it('returns empty array when no persons registered', async () => {
    const { result } = renderHook(() => usePersons(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('enters error state when getAllPersons fails', async () => {
    jest.spyOn(dbModule, 'getAllPersons').mockRejectedValueOnce(new Error('db error'))

    const { result } = renderHook(() => usePersons(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

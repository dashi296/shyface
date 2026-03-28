import { renderHook, act, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useDeletePerson } from '../useDeletePerson'
import { insertPerson, getAllPersons } from '@/shared/db'
import * as dbModule from '@/shared/db'

jest.mock('@/shared/db', () => ({ __esModule: true, ...jest.requireActual('@/shared/db') }))

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: 0 }, mutations: { retry: 0 } } })
}

const NOW = '2026-01-01T00:00:00.000Z'

describe('useDeletePerson', () => {
  afterEach(() => jest.restoreAllMocks())

  it('calls deletePerson with correct id', async () => {
    await insertPerson({ id: 'person-id-1', name: 'Test', memo: null, created_at: NOW, updated_at: NOW })

    const qc = makeQc()
    const { result } = renderHook(() => useDeletePerson(), { wrapper: makeWrapper(qc) })

    act(() => { result.current.mutate('person-id-1') })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const persons = await getAllPersons()
    expect(persons).toHaveLength(0)
  })

  it('invalidates persons query on success', async () => {
    await insertPerson({ id: 'person-id-1', name: 'Test', memo: null, created_at: NOW, updated_at: NOW })

    const qc = makeQc()
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useDeletePerson(), { wrapper: makeWrapper(qc) })

    act(() => { result.current.mutate('person-id-1') })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['persons'] })
  })

  it('enters error state when deletePerson fails', async () => {
    jest.spyOn(dbModule, 'deletePerson').mockRejectedValueOnce(new Error('db error'))

    const qc = makeQc()
    const { result } = renderHook(() => useDeletePerson(), { wrapper: makeWrapper(qc) })

    act(() => { result.current.mutate('person-id-1') })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

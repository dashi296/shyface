import { renderHook, act, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useDeletePerson } from '../useDeletePerson'

jest.mock('@/shared/db', () => ({
  deletePerson: jest.fn(),
}))

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: 0 }, mutations: { retry: 0 } } })
}

describe('useDeletePerson', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('calls deletePerson with correct id', async () => {
    const { deletePerson } = require('@/shared/db')
    deletePerson.mockResolvedValue(undefined)

    const qc = makeQc()
    const { result } = renderHook(() => useDeletePerson(), { wrapper: makeWrapper(qc) })

    act(() => { result.current.mutate('person-id-1') })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(deletePerson).toHaveBeenCalledWith('person-id-1')
  })

  it('invalidates persons query on success', async () => {
    const { deletePerson } = require('@/shared/db')
    deletePerson.mockResolvedValue(undefined)

    const qc = makeQc()
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useDeletePerson(), { wrapper: makeWrapper(qc) })

    act(() => { result.current.mutate('person-id-1') })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['persons'] })
  })

  it('enters error state when deletePerson fails', async () => {
    const { deletePerson } = require('@/shared/db')
    deletePerson.mockRejectedValue(new Error('db error'))

    const qc = makeQc()
    const { result } = renderHook(() => useDeletePerson(), { wrapper: makeWrapper(qc) })

    act(() => { result.current.mutate('person-id-1') })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

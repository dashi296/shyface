import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { usePersons } from '../usePersons'

jest.mock('@/shared/db', () => ({
  getAllPersons: jest.fn(),
}))

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0 } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

describe('usePersons', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('returns persons from db', async () => {
    const { getAllPersons } = require('@/shared/db')
    const mockPersons = [
      { id: '1', name: 'Alice', memo: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    ]
    getAllPersons.mockResolvedValue(mockPersons)

    const { result } = renderHook(() => usePersons(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockPersons)
  })

  it('returns empty array when no persons registered', async () => {
    const { getAllPersons } = require('@/shared/db')
    getAllPersons.mockResolvedValue([])

    const { result } = renderHook(() => usePersons(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('enters error state when getAllPersons fails', async () => {
    const { getAllPersons } = require('@/shared/db')
    getAllPersons.mockRejectedValue(new Error('db error'))

    const { result } = renderHook(() => usePersons(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

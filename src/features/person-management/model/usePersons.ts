import { useQuery } from '@tanstack/react-query'
import { getAllPersons } from '@/shared/db'

export function usePersons() {
  return useQuery({
    queryKey: ['persons'],
    queryFn: getAllPersons,
  })
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert } from 'react-native'
import { deletePerson } from '@/shared/db'

export function useDeletePerson() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deletePerson(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['persons'] })
    },
    onError: (error: Error) => {
      Alert.alert('削除エラー', error.message)
    },
  })
}

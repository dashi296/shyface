import React, { useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, Alert, TouchableOpacity } from 'react-native'
import { usePersons } from '../model/usePersons'
import { useDeletePerson } from '../model/useDeletePerson'
import type { Person } from '@/shared/db'

export function PersonList() {
  const { data: persons = [], isLoading, error } = usePersons()
  const { mutate: deletePerson, isPending } = useDeletePerson()

  const handleDelete = useCallback(
    (person: Person) => {
      Alert.alert('削除確認', `「${person.name}」を削除しますか？`, [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => deletePerson(person.id),
        },
      ])
    },
    [deletePerson]
  )

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>読み込み中...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>エラーが発生しました</Text>
      </View>
    )
  }

  if (persons.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>登録された人物がいません</Text>
        <Text style={styles.subHint}>右下のボタンから人物を登録してください</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={persons}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <View style={styles.itemInfo}>
            <Text style={styles.name}>{item.name}</Text>
            {item.memo && <Text style={styles.memo}>{item.memo}</Text>}
          </View>
          <TouchableOpacity onPress={() => handleDelete(item)} disabled={isPending}>
            <Text style={styles.deleteBtn}>削除</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  hint: { fontSize: 16, color: '#666' },
  subHint: { fontSize: 13, color: '#999' },
  error: { fontSize: 16, color: '#FF3B30' },
  list: { padding: 16, gap: 12 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  itemInfo: { flex: 1, gap: 4 },
  name: { fontSize: 16, fontWeight: '600', color: '#000' },
  memo: { fontSize: 13, color: '#666' },
  deleteBtn: { fontSize: 15, color: '#FF3B30', fontWeight: '500' },
})

import React, { useState } from 'react'
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native'
import { PersonList } from '@/features/person-management'
import { RegisterFaceSheet } from '@/features/person-registration'

export default function PersonsScreen() {
  const [showSheet, setShowSheet] = useState(false)

  return (
    <View style={styles.container}>
      <PersonList />
      <TouchableOpacity style={styles.fab} onPress={() => setShowSheet(true)}>
        <Text style={styles.fabIcon}>＋</Text>
      </TouchableOpacity>
      <RegisterFaceSheet visible={showSheet} onClose={() => setShowSheet(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabIcon: { color: '#fff', fontSize: 28, lineHeight: 32 },
})

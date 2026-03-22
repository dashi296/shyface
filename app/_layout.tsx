import React, { Component, type ReactNode } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/shared/api'

interface ErrorBoundaryState { error: Error | null }

class RootErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>予期しないエラーが発生しました</Text>
          <Text style={styles.errorMessage}>{this.state.error.message}</Text>
        </View>
      )
    }
    return this.props.children
  }
}

export default function RootLayout() {
  return (
    <RootErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </RootErrorBoundary>
  )
}

const styles = StyleSheet.create({
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#FF3B30', marginBottom: 12 },
  errorMessage: { fontSize: 14, color: '#666', textAlign: 'center' },
})

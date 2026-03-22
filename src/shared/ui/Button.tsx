import React from 'react'
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, type TouchableOpacityProps } from 'react-native'

interface ButtonProps extends TouchableOpacityProps {
  title: string
  loading?: boolean
  variant?: 'primary' | 'danger' | 'secondary'
}

export function Button({ title, loading = false, variant = 'primary', style, disabled, ...rest }: ButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], (disabled || loading) && styles.disabled, style]}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  primary: { backgroundColor: '#007AFF' },
  danger: { backgroundColor: '#FF3B30' },
  secondary: { backgroundColor: '#8E8E93' },
  disabled: { opacity: 0.5 },
  text: { color: '#fff', fontSize: 16, fontWeight: '600' },
})

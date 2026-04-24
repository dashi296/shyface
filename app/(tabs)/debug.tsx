import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { Redirect } from 'expo-router'
import Constants from 'expo-constants'
import { useDevOverrides } from '@/shared/config'
import { FACE_SIMILARITY_THRESHOLD, FACE_CROP_PADDING } from '@/shared/config'

const IS_DEV = Constants.expoConfig?.extra?.isDev === true

const THRESHOLD_STEP = 0.05
const THRESHOLD_MIN = 0.5
const THRESHOLD_MAX = 1.0

const PADDING_STEP = 0.05
const PADDING_MIN = 0.0
const PADDING_MAX = 0.5

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100))
}

function ValueRow({
  label,
  defaultValue,
  currentValue,
  step: _step,
  min,
  max,
  onDecrement,
  onIncrement,
  onReset,
}: {
  label: string
  defaultValue: number
  currentValue: number | null
  step: number
  min: number
  max: number
  onDecrement: () => void
  onIncrement: () => void
  onReset: () => void
}) {
  const effective = currentValue ?? defaultValue
  const isOverridden = currentValue !== null

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.defaultText}>デフォルト: {defaultValue.toFixed(2)}</Text>
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.btn, effective <= min && styles.btnDisabled]}
          onPress={onDecrement}
          disabled={effective <= min}
        >
          <Text style={styles.btnText}>−</Text>
        </TouchableOpacity>
        <Text style={[styles.value, isOverridden && styles.valueOverridden]}>
          {effective.toFixed(2)}
        </Text>
        <TouchableOpacity
          style={[styles.btn, effective >= max && styles.btnDisabled]}
          onPress={onIncrement}
          disabled={effective >= max}
        >
          <Text style={styles.btnText}>＋</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.resetBtn, !isOverridden && styles.btnDisabled]}
          onPress={onReset}
          disabled={!isOverridden}
        >
          <Text style={styles.resetBtnText}>戻す</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function DebugScreen() {
  if (!IS_DEV) return <Redirect href="/" />

  const { threshold, padding, setThreshold, setPadding, resetAll } = useDevOverrides()

  const effectiveThreshold = threshold ?? FACE_SIMILARITY_THRESHOLD
  const effectivePadding = padding ?? FACE_CROP_PADDING

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.warning}>開発ビルド専用。本番には影響しません。</Text>

      <ValueRow
        label="顔マッチング閾値"
        defaultValue={FACE_SIMILARITY_THRESHOLD}
        currentValue={threshold}
        step={THRESHOLD_STEP}
        min={THRESHOLD_MIN}
        max={THRESHOLD_MAX}
        onDecrement={() => setThreshold(clamp(effectiveThreshold - THRESHOLD_STEP, THRESHOLD_MIN, THRESHOLD_MAX))}
        onIncrement={() => setThreshold(clamp(effectiveThreshold + THRESHOLD_STEP, THRESHOLD_MIN, THRESHOLD_MAX))}
        onReset={() => setThreshold(null)}
      />

      <ValueRow
        label="顔クロップパディング"
        defaultValue={FACE_CROP_PADDING}
        currentValue={padding}
        step={PADDING_STEP}
        min={PADDING_MIN}
        max={PADDING_MAX}
        onDecrement={() => setPadding(clamp(effectivePadding - PADDING_STEP, PADDING_MIN, PADDING_MAX))}
        onIncrement={() => setPadding(clamp(effectivePadding + PADDING_STEP, PADDING_MIN, PADDING_MAX))}
        onReset={() => setPadding(null)}
      />

      <TouchableOpacity style={styles.resetAllBtn} onPress={resetAll}>
        <Text style={styles.resetAllText}>すべてデフォルトに戻す</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 24 },
  warning: { fontSize: 12, color: '#FF9500', textAlign: 'center', marginBottom: 8 },
  row: { backgroundColor: '#F2F2F7', borderRadius: 12, padding: 16, gap: 8 },
  rowLabel: { fontSize: 16, fontWeight: '600', color: '#000' },
  defaultText: { fontSize: 12, color: '#8E8E93' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  btn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { backgroundColor: '#C7C7CC' },
  btnText: { fontSize: 22, color: '#FFF', lineHeight: 26 },
  value: { fontSize: 24, fontWeight: '700', minWidth: 60, textAlign: 'center', color: '#000' },
  valueOverridden: { color: '#007AFF' },
  resetBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center',
  },
  resetBtnText: { fontSize: 13, color: '#FFF', fontWeight: '600' },
  resetAllBtn: {
    backgroundColor: '#FF3B30', borderRadius: 12, padding: 16, alignItems: 'center',
  },
  resetAllText: { fontSize: 16, color: '#FFF', fontWeight: '600' },
})

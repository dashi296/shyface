import React, { useState, useEffect, useMemo } from 'react'
import { View, Image, Text, StyleSheet, TouchableOpacity } from 'react-native'
import type { LayoutChangeEvent } from 'react-native'
import { FaceBox } from '@/shared/ui'
import type { FaceCandidate } from '../model/types'

interface FaceSelectionViewProps {
  uri: string
  candidates: FaceCandidate[]
  onToggle: (index: number) => void
  onConfirm: () => void
}

interface DisplayLayout {
  scale: number
  offsetX: number
  offsetY: number
}

export function FaceSelectionView({ uri, candidates, onToggle, onConfirm }: FaceSelectionViewProps) {
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    Image.getSize(uri, (w, h) => setNaturalSize({ width: w, height: h }))
  }, [uri])

  const layout = useMemo<DisplayLayout | null>(() => {
    if (!naturalSize || !containerSize) return null
    const scale = Math.min(
      containerSize.width / naturalSize.width,
      containerSize.height / naturalSize.height
    )
    return {
      scale,
      offsetX: (containerSize.width - naturalSize.width * scale) / 2,
      offsetY: (containerSize.height - naturalSize.height * scale) / 2,
    }
  }, [naturalSize, containerSize])

  const handleContainerLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setContainerSize({ width, height })
  }

  const selectedCount = candidates.filter((c) => c.isSelected).length

  const { selectedBoxes, unselectedBoxes } = useMemo(() => {
    if (!layout) return { selectedBoxes: [], unselectedBoxes: [] }
    const { scale, offsetX, offsetY } = layout
    const transform = (c: FaceCandidate) => ({
      x: c.box.x * scale + offsetX,
      y: c.box.y * scale + offsetY,
      width: c.box.width * scale,
      height: c.box.height * scale,
    })
    return {
      selectedBoxes: candidates.filter((c) => c.isSelected).map(transform),
      unselectedBoxes: candidates.filter((c) => !c.isSelected).map(transform),
    }
  }, [candidates, layout])

  return (
    <View style={styles.container}>
      <View style={styles.imageWrapper} onLayout={handleContainerLayout}>
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        {layout && containerSize && (
          <>
            <FaceBox
              width={containerSize.width}
              height={containerSize.height}
              boxes={selectedBoxes}
              color="#FF3B30"
              strokeWidth={3}
            />
            <FaceBox
              width={containerSize.width}
              height={containerSize.height}
              boxes={unselectedBoxes}
              color="#8E8E93"
              strokeWidth={2}
            />
            {candidates.map((c, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.faceOverlay,
                  {
                    left: c.box.x * layout.scale + layout.offsetX,
                    top: c.box.y * layout.scale + layout.offsetY,
                    width: c.box.width * layout.scale,
                    height: c.box.height * layout.scale,
                  },
                ]}
                onPress={() => onToggle(i)}
                activeOpacity={0.7}
              />
            ))}
          </>
        )}
      </View>
      <View style={styles.footer}>
        <Text style={styles.countText}>
          {candidates.length} 件中 {selectedCount} 件を隠します
        </Text>
        <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
          <Text style={styles.confirmText}>処理する</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  imageWrapper: { flex: 1, backgroundColor: '#000' },
  image: { flex: 1, width: '100%' },
  faceOverlay: { position: 'absolute' },
  footer: { padding: 20, gap: 12 },
  countText: { fontSize: 14, color: '#666', textAlign: 'center' },
  confirmButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})

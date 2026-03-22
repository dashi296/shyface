import React from 'react'
import { Canvas, Rect } from '@shopify/react-native-skia'
import type { BoundingBox } from '@/shared/native'

interface FaceBoxProps {
  width: number
  height: number
  boxes: BoundingBox[]
  color?: string
  strokeWidth?: number
}

export function FaceBox({ width, height, boxes, color = '#00FF00', strokeWidth = 2 }: FaceBoxProps) {
  return (
    <Canvas style={{ width, height, position: 'absolute', top: 0, left: 0 }}>
      {boxes.map((box, i) => (
        <Rect
          key={i}
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          color={color}
          style="stroke"
          strokeWidth={strokeWidth}
        />
      ))}
    </Canvas>
  )
}

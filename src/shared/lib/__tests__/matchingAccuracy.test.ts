/**
 * @jest-environment node
 *
 * FaceNet embedding マッチング精度テスト
 *
 * 事前条件: scripts/generate-embeddings.py を実行して
 *   e2e/fixtures/embeddings.json を生成済みであること。
 * ファイルが存在しない場合は全テストをスキップする。
 */

import * as fs from 'fs'
import * as path from 'path'
import { cosineSimilarity } from '../cosineSimilarity'
import { FACE_SIMILARITY_THRESHOLD } from '@/shared/config'

const EMBEDDINGS_PATH = path.resolve(
  __dirname,
  '../../../../e2e/fixtures/embeddings.json'
)

type EmbeddingsMap = Record<string, number[]>

function loadEmbeddings(): EmbeddingsMap {
  return JSON.parse(fs.readFileSync(EMBEDDINGS_PATH, 'utf-8')) as EmbeddingsMap
}

// 同一人物ペア（登録用 embedding × 認識テスト画像）
const MATCH_PAIRS: Array<[string, string]> = [
  ['person_a/1_front', 'recognition/match_person_a'],
  ['person_a/2_left', 'recognition/match_person_a'],
  ['person_a/3_right', 'recognition/match_person_a'],
  ['person_b/1_front', 'recognition/match_person_b'],
  ['person_b/2_left', 'recognition/match_person_b'],
  ['person_b/3_right', 'recognition/match_person_b'],
]

// 別人ペア
const NON_MATCH_PAIRS: Array<[string, string]> = [
  ['person_a/1_front', 'recognition/match_person_b'],
  ['person_a/1_front', 'recognition/no_match'],
  ['person_b/1_front', 'recognition/match_person_a'],
  ['person_b/1_front', 'recognition/no_match'],
  ['recognition/match_person_a', 'recognition/no_match'],
  ['recognition/match_person_b', 'recognition/no_match'],
]

const describeOrSkip = fs.existsSync(EMBEDDINGS_PATH) ? describe : describe.skip

describeOrSkip('FaceNet マッチング精度 (embeddings.json が存在する場合のみ実行)', () => {
  let embeddings: EmbeddingsMap

  beforeAll(() => {
    embeddings = loadEmbeddings()
  })

  it('embeddings.json に必要なキーがすべて存在する', () => {
    const required = [
      ...MATCH_PAIRS.flatMap(([a, b]) => [a, b]),
      ...NON_MATCH_PAIRS.flatMap(([a, b]) => [a, b]),
    ]
    const missing = [...new Set(required)].filter((k) => !(k in embeddings))
    expect(missing).toHaveLength(0)
  })

  it('各 embedding が 128 次元である', () => {
    for (const key of Object.keys(embeddings)) {
      expect(embeddings[key]).toHaveLength(128)
    }
  })

  it('FAR / FRR / 正解率を計測してログ出力する', () => {
    const threshold = FACE_SIMILARITY_THRESHOLD
    let tp = 0, fn = 0, tn = 0, fp = 0

    for (const [a, b] of MATCH_PAIRS) {
      cosineSimilarity(embeddings[a], embeddings[b]) > threshold ? tp++ : fn++
    }
    for (const [a, b] of NON_MATCH_PAIRS) {
      cosineSimilarity(embeddings[a], embeddings[b]) <= threshold ? tn++ : fp++
    }

    const total = tp + fn + tn + fp
    const accuracy = (tp + tn) / total
    const far = (fp + tn) > 0 ? fp / (fp + tn) : 0
    const frr = (fn + tp) > 0 ? fn / (fn + tp) : 0

    console.log(`\n[マッチング精度レポート] threshold=${threshold}`)
    console.log(`  同一人物ペア : ${MATCH_PAIRS.length} (TP=${tp}, FN=${fn})`)
    console.log(`  別人ペア     : ${NON_MATCH_PAIRS.length} (TN=${tn}, FP=${fp})`)
    console.log(`  正解率       : ${(accuracy * 100).toFixed(1)}%`)
    console.log(`  FAR          : ${(far * 100).toFixed(1)}%`)
    console.log(`  FRR          : ${(frr * 100).toFixed(1)}%`)

    expect(accuracy).toBeGreaterThan(0.5)
  })

  it('同一人物ペアは全て閾値を超える (FRR = 0%)', () => {
    const threshold = FACE_SIMILARITY_THRESHOLD
    const failures: string[] = []

    for (const [a, b] of MATCH_PAIRS) {
      const sim = cosineSimilarity(embeddings[a], embeddings[b])
      if (sim <= threshold) {
        failures.push(`${a} vs ${b}: similarity=${sim.toFixed(3)} ≤ threshold=${threshold}`)
      }
    }

    if (failures.length > 0) {
      console.log('\n[同一人物ペアで閾値以下（FRR > 0）]:')
      failures.forEach((f) => console.log('  ', f))
    }

    expect(failures).toHaveLength(0)
  })

  it('別人ペアの FAR をログ出力する（参考情報）', () => {
    const threshold = FACE_SIMILARITY_THRESHOLD
    const falseAccepts: string[] = []

    for (const [a, b] of NON_MATCH_PAIRS) {
      const sim = cosineSimilarity(embeddings[a], embeddings[b])
      if (sim > threshold) {
        falseAccepts.push(`${a} vs ${b}: similarity=${sim.toFixed(3)}`)
      }
    }

    if (falseAccepts.length > 0) {
      console.log(`\n[FAR 詳細] threshold=${threshold} で閾値超えの別人ペア:`)
      falseAccepts.forEach((f) => console.log('  ', f))
      console.log('  → 閾値を引き上げると改善できます（issue #52 参照）')
    }

    // FAR の計測結果はログで確認する（このテストは計測・出力が目的）
    // 厳格な FAR=0% アサーションは閾値チューニング完了後に追加する
  })
})

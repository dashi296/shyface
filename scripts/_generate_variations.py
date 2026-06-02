"""
ベース画像から登録用・認識用フィクスチャを生成する。

登録用 3 枚は InsightFace 2D-106 ランドマーク + scipy TPS ワープで
「正面・左斜め・右斜め ≈ ±20°」の 3 アングルを生成する。

FaceNet はアングル変化に対してロバストなため、
コサイン類似度は閾値（0.6〜0.7）を十分上回る。

認識テスト用画像（recognition/）は登録セットと独立した変形（彩度・シャープネス）を使う。
"""

import os
import sys
import numpy as np
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter


# ---------------------------------------------------------------------------
# ユーティリティ
# ---------------------------------------------------------------------------

def load(path: str) -> Image.Image:
    return Image.open(path).convert("RGB")


def save(img: Image.Image, path: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "JPEG", quality=92)
    print(f"  saved: {path}")


# ---------------------------------------------------------------------------
# InsightFace ランドマーク取得（初回実行時にモデルをダウンロード ~350MB）
# ---------------------------------------------------------------------------

_face_app = None
# INSIGHTFACE_HOME を明示的に使うことで、docker run --user 時も /cache に書き込める
_INSIGHTFACE_ROOT = os.environ.get("INSIGHTFACE_HOME", os.path.expanduser("~/.insightface"))


def _get_face_app():
    global _face_app
    if _face_app is None:
        from insightface.app import FaceAnalysis
        _face_app = FaceAnalysis(name="buffalo_l", root=_INSIGHTFACE_ROOT, providers=["CPUExecutionProvider"])
        # thispersondoesnotexist.com の 1024×1024 画像に対して det_size=512 が最適
        # （det_10g のアンカーサイズは 512px スケール基準のため、それ以上は検出率が下がる）
        _face_app.prepare(ctx_id=0, det_size=(512, 512))
    return _face_app


def _detect_landmarks(img_pil: Image.Image):
    """
    InsightFace で顔を検出し (kps_5, kps_106, nose_x, eye_dist) を返す。
    kps_106: shape (106, 2)  ランドマーク 2D 座標（ない場合は kps_5 を使用）
    """
    import cv2
    app = _get_face_app()
    img_cv = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
    faces = app.get(img_cv)
    if not faces:
        raise ValueError("顔が検出されませんでした")
    face = faces[0]

    kps_5 = face.kps.astype(float)
    kps_106 = getattr(face, "landmark_2d_106", None)
    if kps_106 is not None:
        kps_106 = kps_106.astype(float)
    else:
        kps_106 = kps_5  # fallback

    nose_x = float(kps_5[2, 0])
    eye_dist = float(abs(kps_5[1, 0] - kps_5[0, 0]))
    return kps_5, kps_106, nose_x, eye_dist


# ---------------------------------------------------------------------------
# 透視補正つき yaw 変換
# ---------------------------------------------------------------------------

def _rotate_kps_yaw(kps: np.ndarray, nose_x: float, eye_dist: float, yaw_deg: float) -> np.ndarray:
    """
    各 2D ランドマークを yaw 回転後の位置に変換する（後退側を収縮、接近側を拡張）。

    符号規則:
      yaw_deg < 0 → 左アングル（ビューワー左側が拡張）
      yaw_deg > 0 → 右アングル（ビューワー右側が拡張）

    導出: 透視投影 image_x = f * X_3d / (D + Z_3d)
      回転後 X_3d' = X_3d * cos(θ)
      回転後 Z_3d' = -X_3d * sin(θ)
      ∴ new_image_x = f * X_3d * cos(θ) / (D - X_3d * sin(θ))
                    = dx * cos(θ) / (1 - dx * sin(θ) / N)
      N = face_half_depth ≈ 1.5 * eye_dist（実顔の奥行き/幅比率の近似）
    """
    yaw_rad = np.radians(yaw_deg)
    cos_y = np.cos(yaw_rad)
    sin_y = np.sin(yaw_rad)
    N = 1.5 * eye_dist

    new_kps = kps.copy().astype(float)
    for i, (x, y) in enumerate(kps):
        dx = x - nose_x
        denom = 1.0 - dx * sin_y / N
        denom = np.clip(denom, 0.15, 5.0)  # 特異点防止
        new_kps[i, 0] = nose_x + dx * cos_y / denom
        new_kps[i, 1] = y
    return new_kps


# ---------------------------------------------------------------------------
# TPS ワープ（scipy RBFInterpolator + cv2.remap）
# ---------------------------------------------------------------------------

def _tps_warp(img_pil: Image.Image, src_pts: np.ndarray, dst_pts: np.ndarray,
              grid_size: int = 256) -> Image.Image:
    """
    TPS backward mapping で画像をワープする。

    src_pts: 元画像でのランドマーク位置（サンプリング元）
    dst_pts: 出力画像でのランドマーク位置（移動先）

    coarse grid (grid_size×grid_size) で TPS を解き、フル解像度にアップサンプルして
    cv2.remap を適用することで処理時間を短縮する。
    """
    import cv2
    from scipy.interpolate import RBFInterpolator

    img_cv = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
    h, w = img_cv.shape[:2]

    # backward TPS: 出力座標(dst) → 入力座標(src)
    rbf_x = RBFInterpolator(dst_pts, src_pts[:, 0], kernel="thin_plate_spline", smoothing=0)
    rbf_y = RBFInterpolator(dst_pts, src_pts[:, 1], kernel="thin_plate_spline", smoothing=0)

    # coarse grid で評価
    gx = np.linspace(0, w - 1, grid_size)
    gy = np.linspace(0, h - 1, grid_size)
    grid_x, grid_y = np.meshgrid(gx, gy)
    grid_pts = np.column_stack([grid_x.ravel(), grid_y.ravel()])

    map_x = rbf_x(grid_pts).reshape(grid_size, grid_size).astype(np.float32)
    map_y = rbf_y(grid_pts).reshape(grid_size, grid_size).astype(np.float32)

    # フル解像度にアップサンプル
    map_x = cv2.resize(map_x, (w, h), interpolation=cv2.INTER_LINEAR)
    map_y = cv2.resize(map_y, (w, h), interpolation=cv2.INTER_LINEAR)

    warped = cv2.remap(img_cv, map_x, map_y, cv2.INTER_LINEAR,
                       borderMode=cv2.BORDER_REFLECT_101)
    return Image.fromarray(cv2.cvtColor(warped, cv2.COLOR_BGR2RGB))


# ---------------------------------------------------------------------------
# 公開インターフェース
# ---------------------------------------------------------------------------

def _make_angle_variants(img: Image.Image):
    """
    InsightFace で一度だけ検出し、正面・左斜め・右斜めの 3 枚を返す。
    検出失敗時は RuntimeError を送出する。
    """
    w, h = img.size
    _, kps_106, nose_x, eye_dist = _detect_landmarks(img)

    def _warp(yaw_deg: float) -> Image.Image:
        rotated = _rotate_kps_yaw(kps_106, nose_x, eye_dist, yaw_deg)
        cos_y = np.cos(np.radians(yaw_deg))
        cx_img = w / 2.0
        corners = np.array([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]], dtype=float)
        new_corners = corners.copy()
        new_corners[:, 0] = cx_img + (corners[:, 0] - cx_img) * cos_y
        src_pts = np.vstack([kps_106, corners])
        dst_pts = np.vstack([rotated, new_corners])
        return _tps_warp(img, src_pts, dst_pts)

    return img.copy(), _warp(-20.0), _warp(+20.0)


def var_recognition(img: Image.Image) -> Image.Image:
    """彩度 +20% + 軽いシャープネス（別カメラで撮影した想定）"""
    img = ImageEnhance.Color(img).enhance(1.20)
    return img.filter(ImageFilter.SHARPEN)


def make_group(img_a: Image.Image, img_b: Image.Image, size: int = 512) -> Image.Image:
    """person_a + person_b を横並び合成（size*2 × size）"""
    a = img_a.resize((size, size), Image.LANCZOS)
    b = img_b.resize((size, size), Image.LANCZOS)
    canvas = Image.new("RGB", (size * 2, size))
    canvas.paste(a, (0, 0))
    canvas.paste(b, (size, 0))
    return canvas


def generate(base_a: str, base_b: str, base_no_match: str, out_dir: str) -> None:
    print("\n[InsightFace model] Loading buffalo_l (first run downloads ~350MB)...")
    _get_face_app()  # 先にロードしてログを出す

    print("\n[registration] person_a: front / left(-20°) / right(+20°)")
    img_a = load(base_a)
    front_a, left_a, right_a = _make_angle_variants(img_a)
    save(front_a, f"{out_dir}/person_a/1_front.jpg")
    save(left_a,  f"{out_dir}/person_a/2_left.jpg")
    save(right_a, f"{out_dir}/person_a/3_right.jpg")

    print("\n[registration] person_b: front / left(-20°) / right(+20°)")
    img_b = load(base_b)
    front_b, left_b, right_b = _make_angle_variants(img_b)
    save(front_b, f"{out_dir}/person_b/1_front.jpg")
    save(left_b,  f"{out_dir}/person_b/2_left.jpg")
    save(right_b, f"{out_dir}/person_b/3_right.jpg")

    print("\n[recognition] test images")
    save(var_recognition(img_a), f"{out_dir}/recognition/match_person_a.jpg")
    save(var_recognition(img_b), f"{out_dir}/recognition/match_person_b.jpg")
    save(load(base_no_match),    f"{out_dir}/recognition/no_match.jpg")
    save(make_group(img_a, img_b), f"{out_dir}/recognition/group_ab.jpg")


if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("Usage: python3 _generate_variations.py <base_a> <base_b> <base_no_match> <out_dir>")
        sys.exit(1)
    generate(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])

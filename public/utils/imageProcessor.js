export function calculateOrientationTransform(orientation) {
    let degrees = 0;
    let scaleX = 1;
    let scaleY = 1;
    let swapDimensions = false;

    switch (orientation) {
        case 2: // 左右反転
            scaleX = -1;
            break;
        case 3: // 180度回転（逆さま）
            degrees = 180;
            break;
        case 4: // 上下反転
            scaleY = -1;
            break;
        case 5: // 上下反転 ＋ 右に90度回転
            degrees = 90;
            scaleY = -1;
            swapDimensions = true;
            break;
        case 6: // 右に90度回転（スマホを左に傾けて撮影）
            degrees = 90;
            swapDimensions = true;
            break;
        case 7: // 上下反転 ＋ 左に90度回転
            degrees = -90;
            scaleY = -1;
            swapDimensions = true;
            break;
        case 8: // 左に90度回転（スマホを右に傾けて撮影）
            degrees = -90;
            swapDimensions = true;
            break;
        case 1:
        default:
            // 1 (標準) や異常値の場合は何もしない
            break;
    }

    return { degrees, scaleX, scaleY, swapDimensions };
}

// 実際の画像ファイル（バイナリ）の先頭だけを読み取り、高速にEXIFのOrientationタグを抽出する処理
export function getExifOrientation(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const view = new DataView(e.target.result);
            if (view.getUint16(0, false) != 0xFFD8) return resolve(1); // JPEG形式でなければ標準を返す
            
            const length = view.byteLength;
            let offset = 2;
            while (offset < length) {
                const marker = view.getUint16(offset, false);
                offset += 2;
                if (marker == 0xFFE1) { // APP1マーカー（EXIF情報）
                    if (view.getUint32(offset += 2, false) != 0x45786966) return resolve(1);
                    const little = view.getUint16(offset += 6, false) == 0x4949; // リトルエンディアン判定
                    offset += view.getUint32(offset + 4, little);
                    const tags = view.getUint16(offset, little);
                    offset += 2;
                    for (let i = 0; i < tags; i++) {
                        if (view.getUint16(offset + (i * 12), little) == 0x0112) { // 0x0112 が Orientationタグ
                            return resolve(view.getUint16(offset + (i * 12) + 8, little));
                        }
                    }
                } else if ((marker & 0xFF00) != 0xFF00) break;
                else offset += view.getUint16(offset, false);
            }
            return resolve(1);
        };
        // EXIF情報は画像の先頭部分にあるため、最初の64KBだけを読み込んでメモリを節約
        reader.readAsArrayBuffer(file.slice(0, 64 * 1024));
    });
}

// 画像の向きをCanvasを使って補正し、新しいBlob（ファイル）として返す処理
export async function processImage(file) {
    const orientation = await getExifOrientation(file);
    const transform = calculateOrientationTransform(orientation);
    
    // 回転や反転が不要な場合は、処理をスキップして元のファイルをそのまま返す
    if (transform.degrees === 0 && transform.scaleX === 1 && transform.scaleY === 1) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // 90度回転する場合は、Canvasの縦幅と横幅を入れ替える
            if (transform.swapDimensions) {
                canvas.width = img.height;
                canvas.height = img.width;
            } else {
                canvas.width = img.width;
                canvas.height = img.height;
            }

            // 回転の基準点をCanvasの中心に移動させる
            ctx.translate(canvas.width / 2, canvas.height / 2);
            
            // 指定された角度（ラジアン）で回転し、反転スケールを適用
            ctx.rotate((transform.degrees * Math.PI) / 180);
            ctx.scale(transform.scaleX, transform.scaleY);

            // 画像を中心に描画（基準点が中心なので、マイナス幅からスタートする）
            ctx.drawImage(img, -img.width / 2, -img.height / 2);

            // 補正後のCanvasをBlob（画像ファイル）に変換して返す
            canvas.toBlob((blob) => {
                resolve(blob || file);
            }, file.type || 'image/jpeg', 0.95);
        };
        img.onerror = () => resolve(file); // 読み込みエラー時は元ファイルを返す
        img.src = URL.createObjectURL(file);
    });
}

import { describe, it, expect } from 'vitest';
import { calculateOrientationTransform } from '../../public/utils/imageProcessor.js';

describe('EXIF Orientation補正ロジックのテスト', () => {
    it('Orientation 1 (標準) は回転も反転も行わないこと', () => {
        const result = calculateOrientationTransform(1);
        expect(result).toEqual({ degrees: 0, scaleX: 1, scaleY: 1, swapDimensions: false });
    });

    it('Orientation 3 (180度回転) は180度回転すること', () => {
        const result = calculateOrientationTransform(3);
        expect(result).toEqual({ degrees: 180, scaleX: 1, scaleY: 1, swapDimensions: false });
    });

    it('Orientation 6 (右に90度回転) は90度回転し、縦横比が逆転すること', () => {
        const result = calculateOrientationTransform(6);
        expect(result).toEqual({ degrees: 90, scaleX: 1, scaleY: 1, swapDimensions: true });
    });

    it('Orientation 8 (左に90度回転) は-90度回転し、縦横比が逆転すること', () => {
        const result = calculateOrientationTransform(8);
        expect(result).toEqual({ degrees: -90, scaleX: 1, scaleY: 1, swapDimensions: true });
    });

    it('異常値や未定義の場合は標準(1)として処理すること', () => {
        expect(calculateOrientationTransform(null)).toEqual({ degrees: 0, scaleX: 1, scaleY: 1, swapDimensions: false });
        expect(calculateOrientationTransform(99)).toEqual({ degrees: 0, scaleX: 1, scaleY: 1, swapDimensions: false });
    });
});

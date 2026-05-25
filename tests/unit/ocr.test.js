// tests/unit/ocr.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseOcrText, levenshtein } from '../../public/utils/ocrParser.js';

describe('OCR解析ロジック（アルゴリズム）の単体テスト', () => {

    beforeEach(() => {
        // Zipcloud API の fetch をモック化（ネットワーク通信を遮断しテストを安定化）
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    status: 200,
                    results: [{ address1: '東京都', address2: '渋谷区', address3: '道玄坂' }]
                })
            })
        );
    });

    it('レーベンシュタイン距離：表記揺れ（代表取結役）を「代表取締役」と許容・補正できるか', () => {
        expect(levenshtein('代表取締役', '代表取結役')).toBeLessThanOrEqual(2);
    });

    it('境界値：メールアドレスに不要な文字列（Email: 等）がくっついていてもクリーンに抽出できるか', async () => {
        const text = "株式会社テスト\nEmail:test@example.com\nFAX:03-1234-5678";
        const result = await parseOcrText(text);
        expect(result.email).toBe('test@example.com');
    });

    it('境界値：電話番号とFAX番号を文脈から正しく振り分けられるか', async () => {
        const text = "株式会社テスト\n山田 太郎\nTEL 03-1111-2222\nFAX 03-3333-4444\nMobile 090-9999-8888";
        const result = await parseOcrText(text);
        expect(result.companyPhone).toBe('03-1111-2222');
        expect(result.fax).toBe('03-3333-4444');
        expect(result.mobilePhone).toBe('090-9999-8888');
    });

    it('異常系：記号だらけのノイズ行や極端に短い行は会社名・氏名として誤検知しないか', async () => {
        const text = "---|~~_\n.\n株式会社ノイズ\n鈴木 一郎\n!@#$";
        const result = await parseOcrText(text);
        expect(result.companyName).toBe('株式会社ノイズ');
        expect(result.name).toBe('鈴木 一郎');
    });
});
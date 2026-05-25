import { describe, it, expect } from 'vitest';
import { sanitizeCsvValue, generateCsvString } from '../../public/utils/csvExporter';

describe('CSV出力ロジックの単体テスト', () => {
    describe('サニタイズ・セキュリティ検証', () => {
        it('CSV Injection対策: =HYPERLINK 等の数式がサニタイズされること', () => {
            const maliciousInput1 = '=HYPERLINK("http://evil.com","Click")';
            const maliciousInput2 = '+1+1';
            const maliciousInput3 = '-1+1';
            const maliciousInput4 = '@SUM(A1:A2)';

            expect(sanitizeCsvValue(maliciousInput1)).toBe(`'=HYPERLINK(""http://evil.com"",""Click"")`);
            expect(sanitizeCsvValue(maliciousInput2)).toBe(`'+1+1`);
            expect(sanitizeCsvValue(maliciousInput3)).toBe(`'-1+1`);
            expect(sanitizeCsvValue(maliciousInput4)).toBe(`'@SUM(A1:A2)`);
        });

        it('制御文字（文字化け原因）が除去されること', () => {
            const noise = 'Test\x00Data';
            expect(sanitizeCsvValue(noise)).toBe('TestData');
        });
    });

    describe('CSV文字列の生成・フォーマット検証', () => {
        const dummyData = [
            {
                name: '山田 太郎',
                company: '株式会社テスト',
                department: '開発部',
                phone: '090-1234-5678',
                email: 'yamada@example.com',
                createdAt: '2026-05-25T10:00:00Z'
            }
        ];

        it('BOM付きUTF-8として出力されること', () => {
            const csv = generateCsvString(dummyData);
            // 先頭がBOM（\uFEFF）であることを確認
            expect(csv.startsWith('\uFEFF')).toBe(true);
        });

        it('ヘッダー行と列順序が固定仕様通りに出力されること', () => {
            const csv = generateCsvString(dummyData);
            const lines = csv.split('\n');
            // ヘッダー行の検証（BOM付き）
            expect(lines[0]).toBe('\uFEFF"氏名","会社","部署","電話","メール","登録日"');
            
            // データ行の列順序検証
            const dataRow = lines[1];
            expect(dataRow).toContain('"山田 太郎"');
            expect(dataRow).toContain('"株式会社テスト"');
            expect(dataRow).toContain('"090-1234-5678"');
        });
    });
});

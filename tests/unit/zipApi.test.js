import { describe, it, expect, vi, afterAll } from 'vitest';
import { fetchAddressByZipCode } from '../../public/utils/zipApi.js';

describe('Zip API (郵便番号API異常系)', () => {
    const originalFetch = global.fetch;

    afterAll(() => {
        global.fetch = originalFetch;
    });

    it('正常に住所が取得できること', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ status: 200, results: [{ address1: '東京都', address2: '千代田区', address3: '丸の内' }] })
        });
        const result = await fetchAddressByZipCode('100-0005');
        expect(result).toBe('東京都千代田区丸の内');
    });

    it('🔴 ネットワークエラー（500等）時に適切に例外が投げられること', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500
        });
        await expect(fetchAddressByZipCode('100-0005')).rejects.toThrow('HTTP Error: 500');
    });

    it('🔴 該当住所がない場合に適切に例外が投げられること', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ status: 200, results: null })
        });
        await expect(fetchAddressByZipCode('999-9999')).rejects.toThrow('該当する住所が見つかりません');
    });
});

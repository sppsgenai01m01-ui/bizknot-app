import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { fetchWithTimeout } from '../../public/utils/ocrTimeout.js';

describe('OCR Timeout (APIタイムアウト制御)', () => {
    const originalFetch = global.fetch;

    beforeAll(() => {
        vi.useFakeTimers(); // タイマーをモック化して高速にテスト
    });

    afterAll(() => {
        vi.useRealTimers();
        global.fetch = originalFetch;
    });

    it('指定時間内に応答があれば正常に解決すること', async () => {
        global.fetch = vi.fn().mockResolvedValue('success');
        
        const promise = fetchWithTimeout('https://example.com', {}, 5000);
        await vi.runAllTimersAsync();
        
        await expect(promise).resolves.toBe('success');
    });

    it('🔴 指定時間を超えた場合、無限ロードにならずにタイムアウトエラーになること', async () => {
        // 永遠に解決しないPromiseを返すfetchをモック
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
        
        const promise = fetchWithTimeout('https://example.com', {}, 3000);
        
        // 3秒（タイムアウト時間）を進める
        vi.advanceTimersByTime(3001);
        
        await expect(promise).rejects.toThrow('リクエストがタイムアウトしました');
    });
});

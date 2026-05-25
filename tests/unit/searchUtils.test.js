import { describe, it, expect } from 'vitest';
import { normalizeSearchText } from '../../public/utils/searchUtils.js';

describe('Search Utility (検索揺らぎ吸収)', () => {
    it('全角英数字と半角英数字を同一視できること', () => {
        expect(normalizeSearchText('ＢＩＺｋｎｏｔ１２３')).toBe('bizknot123');
    });
    it('大文字と小文字を同一視できること', () => {
        expect(normalizeSearchText('BizKnot')).toBe('bizknot');
    });
    it('全角スペース・半角スペースを無視できること', () => {
        expect(normalizeSearchText('株 式　会 社')).toBe('株式会社');
    });
});

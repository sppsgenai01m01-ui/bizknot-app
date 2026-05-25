export function normalizeSearchText(text) {
    if (!text) return '';
    return text
        .normalize('NFKC') // 全角英数字・カタカナを半角に
        .toLowerCase() // 大文字を小文字に
        .replace(/[\s　]/g, ''); // スペース（全角・半角）を削除
}

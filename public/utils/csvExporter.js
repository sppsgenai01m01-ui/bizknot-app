/**
 * セキュリティ対策（CSV Injection等）を施した上で、
 * BOM付きのCSV文字列を生成するユーティリティ
 */

// セルデータのサニタイズ（CSV Injection対策とダブルクォートのエスケープ）
export function sanitizeCsvValue(value) {
    if (value === null || value === undefined) return '';
    let str = String(value);

    // Unicode制御文字の除去
    str = str.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // CSV Injection (Excelの数式実行) 対策: =, +, -, @ で始まる場合は先頭にシングルクォートを付与
    if (/^[=+\-@]/.test(str)) {
        str = "'" + str;
    }

    // CSVフォーマットのため、ダブルクォートをエスケープ (" -> "")
    return str.replace(/"/g, '""');
}

// データの配列からBOM付きCSV文字列を生成
export function generateCsvString(dataList) {
    // ヘッダー（列定義の固定化）
    const headers = ['氏名', '会社', '部署', '電話', 'メール', '登録日'];
    const rows = [headers.map(h => `"${h}"`).join(',')];

    // データ行の生成
    for (const data of dataList) {
        const row = [
            data.name || '',
            data.company || '',
            data.department || '',
            data.phone || '',
            data.email || '',
            data.createdAt ? new Date(data.createdAt).toLocaleDateString() : ''
        ].map(val => `"${sanitizeCsvValue(val)}"`);
        rows.push(row.join(','));
    }

    // BOM付きUTF-8として結合
    const bom = '\uFEFF';
    return bom + rows.join('\n');
}

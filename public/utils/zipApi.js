export async function fetchAddressByZipCode(zipCode) {
    const cleanZip = zipCode.replace(/-/g, '');
    if (!/^\d{7}$/.test(cleanZip)) {
        throw new Error('無効な郵便番号フォーマットです');
    }
    
    try {
        const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleanZip}`);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const data = await response.json();
        if (data.status !== 200) throw new Error(`API Error: ${data.message}`);
        if (!data.results) throw new Error('該当する住所が見つかりません');
        
        const result = data.results[0];
        return `${result.address1}${result.address2}${result.address3}`;
    } catch (error) {
        throw new Error(`郵便番号検索に失敗しました: ${error.message}`);
    }
}

// ekorota/api.js
/**
 * Belirtilen rota kodu için region'a göre uygun API'dan rota bilgilerini çeker.
 * @param {string} routeCode - Rota kodu (örn. "010").
 * @param {number} direction - Rota yönü (0 veya 1).
 * @param {string} region - Bölge kodu (örn. "004", "754").
 * @returns {Promise<object>} API'den dönen rota bilgileri.
 */
async function fetchRouteInfoFromApi(routeCode, direction, region) {
  try {
    const firstDigit = region.charAt(0);
    let url;
    
    if (firstDigit === '0') {
      // Region 0 ile başlıyorsa Kentkart API kullan
      url = `https://service.kentkart.com/rl1//web/pathInfo?region=${region}&lang=tr&authType=4&direction=${direction}&displayRouteCode=${routeCode}&resultType=111111&version=Web_1.8.1(32)_1.0_FIREFOX_kentkart.web.mkentkart`;
    } else if (firstDigit === '7') {
      // Region 7 ile başlıyorsa gman.dev API kullan
      url = `https://gman.dev/ekosanal/${region},${routeCode},${direction}`;
    } else {
      throw new Error(`Desteklenmeyen region formatı: ${region}`);
    }
    
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("Rota bilgileri çekilirken bir hata oluştu:", error);
    throw error; // Hatayı çağıran fonksiyona ilet
  }
}
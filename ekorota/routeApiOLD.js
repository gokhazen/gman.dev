// ekorota/api.js

/**
 * Belirtilen rota kodu için Kentkart API'sından rota bilgilerini çeker.
 * @param {string} routeCode - Rota kodu (örn. "010").
 * @param {number} direction - Rota yönü (0 veya 1).
 * @param {string} region - Bölge kodu (örn. "004").
 * @returns {Promise<object>} API'den dönen rota bilgileri.
 */
async function fetchRouteInfoFromApi(routeCode, direction, region) {
  try {
    const url = `https://service.kentkart.com/rl1//web/pathInfo?region=${region}&lang=tr&authType=4&direction=${direction}&displayRouteCode=${routeCode}&resultType=111111&version=Web_1.8.1(32)_1.0_FIREFOX_kentkart.web.mkentkart`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("Rota bilgileri çekilirken bir hata oluştu:", error);
    throw error; // Hatayı çağıran fonksiyona ilet
  }
}
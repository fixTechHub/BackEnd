const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

if (!MAPBOX_TOKEN) {
    throw new Error("Mapbox Access Token is not configured in .env file");
}

const geocodingClient = mbxGeocoding({ accessToken: MAPBOX_TOKEN });

/**
 * Chuyển đổi một chuỗi địa chỉ thành một đối tượng GeoJSON Point bằng Mapbox Geocoding API,
 * tối ưu hóa độ chính xác cho khu vực Đà Nẵng, Việt Nam.
 * @param {string} addressString - Địa chỉ cần chuyển đổi.
 * @returns {Promise<object|null>} - Trả về object GeoJSON Point hoặc null.
 */
const addressToPoint = async (addressString) => {
    if (!addressString || typeof addressString !== 'string' || addressString.trim() === '') {
        console.warn('[Mapbox Geocoding] Lỗi: Chuỗi địa chỉ không hợp lệ.');
        return null;
    }

    try {
        console.log(`[Mapbox Geocoding] Đang tìm tọa độ cho: "${addressString}" tại Đà Nẵng`);

        // --- Dữ liệu vị trí để tối ưu tìm kiếm cho Đà Nẵng ---
        // Tọa độ trung tâm Đà Nẵng [kinh độ, vĩ độ]
        const daNangCenter = [108.2022, 16.0612]; 
        // Khung giới hạn của Đà Nẵng [kinh độ min, vĩ độ min, kinh độ max, vĩ độ max]
        const daNangBbox = [107.78, 15.91, 108.38, 16.20]; 

        // Gọi API của Mapbox với các tham số tối ưu
        const response = await geocodingClient
            .forwardGeocode({
                query: addressString,
                countries: ['vn'], // Luôn giới hạn ở Việt Nam
                limit: 1,
                language: ['vi'],
                
                // ✅ Ưu tiên các kết quả ở gần trung tâm Đà Nẵng
                proximity: daNangCenter, 
                
                // ✅ Chỉ trả về các kết quả nằm trong khu vực Đà Nẵng
                bbox: daNangBbox,      
            })
            .send();

        const results = response.body.features;

        if (!results || results.length === 0) {
            console.warn(`[Mapbox Geocoding] Không tìm thấy địa chỉ cho: "${addressString}" trong khu vực Đà Nẵng.`);
            return null;
        }
        
        const bestResult = results[0];
        const point = {
            type: 'Point',
            coordinates: bestResult.center
        };

        console.log(`[Mapbox Geocoding] Thành công! Địa chỉ được xác định: "${bestResult.place_name}". Tọa độ:`, point.coordinates);
        return point;

    } catch (error) {
        console.error('[Mapbox Geocoding] Lỗi khi gọi API:', error.message);
        return null;
    }
}

module.exports = {
    addressToPoint
};

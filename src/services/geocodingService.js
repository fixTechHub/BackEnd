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

        // Tọa độ trung tâm Đà Nẵng [kinh độ, vĩ độ]
        const daNangCenter = [108.2022, 16.0612]; 
        // Khung giới hạn của Đà Nẵng [kinh độ min, vĩ độ min, kinh độ max, vĩ độ max]
        const daNangBbox = [107.78, 15.91, 108.38, 16.20]; 

        let bestResult = null;
        let highestRelevance = 0;

        // Strategy 1: Tìm kiếm chính xác với bbox và proximity
        console.log(`[Mapbox Geocoding] Strategy 1 - Tìm kiếm chính xác: "${addressString}"`);
        let response = await geocodingClient
            .forwardGeocode({
                query: addressString,
                countries: ['vn'],
                limit: 5,
                language: ['vi'],
                proximity: daNangCenter,
                bbox: daNangBbox,
                types: ['address', 'poi'], // Bao gồm cả địa chỉ và điểm quan tâm
            })
            .send();

        let results = response.body.features;
        console.log(`[Mapbox Geocoding] Strategy 1 - Tìm thấy ${results.length} kết quả`);
        
        // Log chi tiết kết quả
        if (results && results.length > 0) {
            results.forEach((result, index) => {
                console.log(`[Mapbox Geocoding] Result ${index + 1}: "${result.place_name}" (relevance: ${result.relevance}, type: ${result.place_type.join(', ')})`);
            });
        }

        // Strategy 2: Nếu không tìm thấy, thử với địa chỉ + "Đà Nẵng"
        if (!results || results.length === 0) {
            console.log(`[Mapbox Geocoding] Strategy 2 - Thử với "${addressString}, Đà Nẵng"`);
            response = await geocodingClient
                .forwardGeocode({
                    query: `${addressString}, Đà Nẵng`,
                    countries: ['vn'],
                    limit: 5,
                    language: ['vi'],
                    proximity: daNangCenter,
                    bbox: daNangBbox,
                    types: ['address', 'poi'],
                })
                .send();
            results = response.body.features;
            console.log(`[Mapbox Geocoding] Strategy 2 - Tìm thấy ${results.length} kết quả`);
        }

        // Strategy 3: Nếu vẫn không tìm thấy, thử tìm kiếm rộng hơn (không giới hạn bbox)
        if (!results || results.length === 0) {
            console.log(`[Mapbox Geocoding] Strategy 3 - Tìm kiếm rộng hơn cho "${addressString}"`);
            response = await geocodingClient
                .forwardGeocode({
                    query: addressString,
                    countries: ['vn'],
                    limit: 10,
                    language: ['vi'],
                    proximity: daNangCenter,
                    types: ['address', 'poi'],
                })
                .send();
            results = response.body.features;
            console.log(`[Mapbox Geocoding] Strategy 3 - Tìm thấy ${results.length} kết quả`);
        }

        // Strategy 4: Tìm kiếm chỉ với tên đường (bỏ số nhà)
        if (!results || results.length === 0) {
            const streetName = addressString.replace(/^\d+\s*/, '').trim(); // Bỏ số nhà
            if (streetName && streetName.length > 2) {
                console.log(`[Mapbox Geocoding] Strategy 4 - Tìm kiếm tên đường "${streetName}"`);
                response = await geocodingClient
                    .forwardGeocode({
                        query: `${streetName}, Đà Nẵng`,
                        countries: ['vn'],
                        limit: 5,
                        language: ['vi'],
                        proximity: daNangCenter,
                        bbox: daNangBbox,
                        types: ['address', 'poi'],
                    })
                    .send();
                results = response.body.features;
                console.log(`[Mapbox Geocoding] Strategy 4 - Tìm thấy ${results.length} kết quả`);
            }
        }

        if (!results || results.length === 0) {
            console.warn(`[Mapbox Geocoding] Không tìm thấy địa chỉ cho: "${addressString}"`);
            return null;
        }

        // Chọn kết quả tốt nhất
        for (const result of results) {
            if (result.relevance > highestRelevance) {
                // Kiểm tra xem có trong khu vực Đà Nẵng không
                const [lng, lat] = result.center;
                if (lng >= daNangBbox[0] && lng <= daNangBbox[2] && 
                    lat >= daNangBbox[1] && lat <= daNangBbox[3]) {
                    bestResult = result;
                    highestRelevance = result.relevance;
                }
            }
        }

        // Nếu không tìm được kết quả trong bbox, lấy kết quả có relevance cao nhất
        if (!bestResult) {
            bestResult = results[0];
            highestRelevance = bestResult.relevance;
        }

        const point = {
            type: 'Point',
            coordinates: bestResult.center
        };

        console.log(`[Mapbox Geocoding] Thành công! Địa chỉ: "${bestResult.place_name}". Relevance: ${bestResult.relevance}. Tọa độ:`, point.coordinates);
        return point;

    } catch (error) {
        console.error('[Mapbox Geocoding] Lỗi khi gọi API:', error.message);
        return null;
    }
}

module.exports = {
    addressToPoint
};

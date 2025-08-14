const axios = require('axios');

const HERE_API_KEY = process.env.HERE_API_KEY;

if (!HERE_API_KEY) {
    throw new Error("HERE Maps API Key is not configured in .env file");
}

/**
 * Chuyển đổi một chuỗi địa chỉ thành một đối tượng GeoJSON Point bằng HERE Maps API,
 * tối ưu hóa độ chính xác cho khu vực Đà Nẵng, Việt Nam.
 * @param {string} addressString - Địa chỉ cần chuyển đổi.
 * @returns {Promise<object|null>} - Trả về object GeoJSON Point hoặc null.
 */
const addressToPoint = async (addressString) => {
    if (!addressString || typeof addressString !== 'string' || addressString.trim() === '') {
        console.warn('[HERE Geocoding] Lỗi: Chuỗi địa chỉ không hợp lệ.');
        return null;
    }
    try {
        console.log(`[HERE Geocoding] Đang tìm tọa độ cho: "${addressString}" tại Đà Nẵng`);
        // Đà Nẵng: lat=16.0544, lng=108.2022
        const at = '16.0544,108.2022';
        const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(addressString)}&at=${at}&lang=vi-VN&limit=5&apiKey=${HERE_API_KEY}`;
        const res = await axios.get(url);
        const data = res.data;
        if (!data.items || data.items.length === 0) {
            console.warn(`[HERE Geocoding] Không tìm thấy địa chỉ cho: "${addressString}"`);
            return null;
        }
        // Ưu tiên kết quả trong bbox Đà Nẵng
        const daNangBbox = [107.78, 15.91, 108.38, 16.20]; // [lngMin, latMin, lngMax, latMax]
        let best = null;
        for (const item of data.items) {
            if (item.position) {
                const { lat, lng } = item.position;
                if (lng >= daNangBbox[0] && lng <= daNangBbox[2] && lat >= daNangBbox[1] && lat <= daNangBbox[3]) {
                    best = item;
                    break;
                }
            }
        }
        if (!best) best = data.items[0];
        const point = {
            type: 'Point',
            coordinates: [best.position.lng, best.position.lat]
        };
        console.log(`[HERE Geocoding] Thành công! Địa chỉ: "${best.address?.label || best.title}". Tọa độ:`, point.coordinates);
        return point;
    } catch (error) {
        console.error('[HERE Geocoding] Lỗi khi gọi API:', error.message);
        return null;
    }
};

module.exports = {
    addressToPoint
};

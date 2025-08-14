const serviceService = require('../services/serviceService');
const axios = require('axios');
const { addressToPoint } = require('../services/geocodingService');

exports.getPublicServices = async (req, res) => {
    try {
        const services = await serviceService.getPublicServices();

        res.status(200).json({
            message: 'Lấy danh sách dịch vụ thành công',
            data: services
        });
    } catch (error) {
        console.error('Error getting public services:', error);
        res.status(500).json({
            message: 'Lỗi server khi lấy dịch vụ',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

exports.getPublicServicesByCategoryId = async (req, res) => {
    try {
        const categoryId = req.params.id;

        const services = await serviceService.getPublicServicesByCategoryId(categoryId);

        res.status(200).json({
            message: 'Lấy danh sách dịch vụ theo danh mục thành công',
            data: services
        });
    } catch (error) {
        console.error('Error getting public services by categorId:', error);
        res.status(500).json({
            message: 'Lỗi server khi lấy dịch vụ',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
}

exports.suggestServices = async (req, res) => {
    try {
        const { descriptionSearch } = req.body;
        if (!descriptionSearch) {
            return res.status(400).json({
                message: 'Vui lòng cung cấp mô tả'
            });
        }
        const services = await serviceService.suggestServices(descriptionSearch);
        res.status(200).json({
            message: 'Gợi ý dịch vụ thành công',
            data: services
        });
    } catch (error) {
        console.error('Error suggesting services:', error);
        res.status(500).json({
            message: 'Lỗi server khi gợi ý dịch vụ',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

exports.getAddressSuggestions = async (req, res) => {
    try {
        console.log('[Address Suggestions] API được gọi với query:', req.query);
        
        const { query } = req.query;
        
        if (!query || query.trim().length < 3) {
            console.log('[Address Suggestions] Query quá ngắn:', query);
            return res.status(400).json({
                success: false,
                message: 'Query phải có ít nhất 3 ký tự'
            });
        }

        const HERE_API_KEY = process.env.HERE_API_KEY;
        if (!HERE_API_KEY) {
            console.log('[Address Suggestions] Thiếu HERE_API_KEY');
            return res.status(500).json({
                success: false,
                message: 'Chưa cấu hình HERE API key'
            });
        }

        console.log(`[Address Suggestions] Tìm gợi ý cho: "${query}"`);
        console.log(`[Address Suggestions] HERE_API_KEY exists: ${!!HERE_API_KEY}`);
        
        // Đà Nẵng: lat=16.0544, lng=108.2022
        const url = `https://autosuggest.search.hereapi.com/v1/autosuggest?at=16.0544,108.2022&limit=5&q=${encodeURIComponent(query)}&lang=vi-VN&apiKey=${HERE_API_KEY}`;
        console.log(`[Address Suggestions] Calling HERE API:`, url.replace(HERE_API_KEY, 'HIDDEN_KEY'));
        
        const response = await axios.get(url, { timeout: 10000 });
        const data = response.data;
        
        console.log(`[Address Suggestions] HERE API response:`, data);
        
        // Lọc chỉ lấy kết quả là đường phố hoặc địa chỉ
        const items = Array.isArray(data.items) ? data.items : [];
        const suggestions = items.filter(item => 
            item.resultType === 'street' || 
            item.resultType === 'houseNumber' || 
            item.resultType === 'address'
        );

        console.log(`[Address Suggestions] Tìm thấy ${suggestions.length} gợi ý`);

        return res.status(200).json({
            success: true,
            data: suggestions
        });

    } catch (error) {
        console.error('[Address Suggestions] Lỗi:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy gợi ý địa chỉ: ' + error.message
        });
    }
};

exports.geocodeAddress = async (req, res) => {
    try {
        const { address } = req.body;
        
        if (!address || address.trim().length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Địa chỉ không hợp lệ'
            });
        }

        console.log(`[Geocoding] Sử dụng existing geocodingService cho: "${address}"`);
        
        // Sử dụng existing geocodingService thay vì duplicate code
        const coordinates = await addressToPoint(address);
        
        if (!coordinates) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy tọa độ cho địa chỉ này'
            });
        }

        console.log(`[Geocoding] Thành công! Tọa độ:`, coordinates.coordinates);

        return res.status(200).json({
            success: true,
            data: {
                address: address,
                coordinates
            }
        });

    } catch (error) {
        console.error('[Geocoding] Lỗi:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Lỗi khi tìm tọa độ: ' + error.message
        });
    }
};

// Test endpoint
exports.testEndpoint = async (req, res) => {
    console.log('[Test] API được gọi');
    return res.json({
        success: true,
        message: 'API hoạt động bình thường',
        timestamp: new Date().toISOString(),
        HERE_API_KEY_EXISTS: !!process.env.HERE_API_KEY
    });
};
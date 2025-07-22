const Booking = require("../models/Booking");
const Category = require("../models/Category")

exports.getPublicCategories = async () => {
    return await Category.find({ isActive: true });
};

exports.getTopCategoriesByBookings = async (limit = 10) => {
    try {
        const stats = await Booking.aggregate([
            // 1. Chỉ lấy booking đã hoàn thành
            { $match: { status: 'DONE' } },

            // 2. Nối với 'services' để biết mỗi booking thuộc category nào
            { $lookup: { from: 'services', localField: 'serviceId', foreignField: '_id', as: 'serviceInfo' } },
            { $unwind: '$serviceInfo' },

            // 3. Nhóm theo categoryId và đếm số booking
            {
                $group: {
                    _id: '$serviceInfo.categoryId',
                    bookingCount: { $sum: 1 }
                }
            },

            // 4. Sắp xếp theo số lượt đặt giảm dần
            { $sort: { bookingCount: -1 } },

            // 5. Giới hạn số lượng
            { $limit: limit },

            // --- CÁC BƯỚC MỚI ĐƯỢC THÊM VÀO ---
            // 6. Nối với 'services' một lần nữa, lần này là để ĐẾM số dịch vụ con
            {
                $lookup: {
                    from: 'services',
                    localField: '_id', // _id lúc này chính là categoryId
                    foreignField: 'categoryId',
                    as: 'serviceList' // Lấy danh sách tất cả service thuộc category này
                }
            },

            // 7. Thêm trường mới 'serviceCount' bằng cách đếm số phần tử trong mảng vừa nối
            {
                $addFields: {
                    serviceCount: { $size: '$serviceList' }
                }
            },
            // --- KẾT THÚC CÁC BƯỚC MỚI ---

            // 8. Nối với 'categories' để lấy tên category
            { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'categoryDetails' } },
            { $unwind: '$categoryDetails' },

            // 9. Định dạng lại output, thêm trường serviceCount
            {
                $project: {
                    _id: 0,
                    categoryId: '$_id',
                    categoryName: '$categoryDetails.categoryName',
                    bookingCount: '$bookingCount',
                    serviceCount: '$serviceCount' // <-- Dữ liệu mới
                }
            }
        ]);
        return stats;
    } catch (error) {
        console.error("Lỗi khi lấy top category:", error);
        throw new Error("Không thể lấy dữ liệu thống kê.");
    }
};
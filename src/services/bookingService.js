const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const technicianService = require('./technicianService');
const BookingStatusLog = require('../models/BookingStatusLog');
const notificationService = require('../services/notificationService')
const paymentService = require('../services/paymentService')
const commissionService = require('../services/commissionService')
const receiptService = require('../services/receiptService');
const Technician = require('../models/Technician');
const BookingTechnicianRequest = require('../models/BookingTechnicianRequest');
const BookingTechnicianSearch = require('../models/BookingTechnicianSearch');
const { getIo } = require('../sockets/socketManager');
const technicianScheduleService = require('./technicianScheduleService');
const redisService = require('./redisService');

const MAX_TECHNICIANS = 10;
const SEARCH_RADII = [5, 10, 15, 30];

const findTechniciansWithExpandingRadiusAndSave = async (searchParams, bookingId, io) => {
    // Tập hợp tất cả thợ tìm được trong đợt tìm kiếm hiện tại (để luôn cập nhật trạng thái mới nhất)
    const currentFoundByUserId = new Map();
    let foundTechnicianIds = new Set();

    // Lấy trạng thái tìm kiếm hiện tại với retry logic
    let searchState = null;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
        try {
            searchState = await BookingTechnicianSearch.findOne({ bookingId });
            if (searchState) {
                foundTechnicianIds = new Set(searchState.foundTechnicianIds.map(id => String(id)));
            } else {
                searchState = new BookingTechnicianSearch({ bookingId, foundTechnicianIds: [] });
            }
            break; // Thành công, thoát khỏi vòng lặp
        } catch (error) {
            retryCount++;
            console.error(`Error fetching search state (attempt ${retryCount}):`, error.message);
            
            if (retryCount >= maxRetries) {
                throw new Error(`Failed to fetch search state after ${maxRetries} attempts: ${error.message}`);
            }
            
            // Đợi một chút trước khi thử lại
            await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
        }
    }

    for (const radius of SEARCH_RADII) {
        const result = await technicianService.findNearbyTechnicians(searchParams, radius);
        if (result && Array.isArray(result.data) && result.data.length > 0) {
            for (const tech of result.data) {
                if (!tech || !tech.userId) continue;
                const userIdStr = String(tech.userId);
                if (!currentFoundByUserId.has(userIdStr)) {
                    currentFoundByUserId.set(userIdStr, tech);
                }
            }
        }
        if (currentFoundByUserId.size >= MAX_TECHNICIANS) break;
    }

    const refreshedList = Array.from(currentFoundByUserId.values());
    // Cắt giới hạn tối đa nếu cần
    const limitedList = refreshedList.slice(0, MAX_TECHNICIANS);
    
    // Cập nhật search state với retry logic
    retryCount = 0;
    while (retryCount < maxRetries) {
        try {
            searchState.foundTechniciansDetail = limitedList;
            searchState.foundTechnicianIds = limitedList.map(t => t.userId);
            searchState.lastSearchAt = new Date();
            if (searchState.foundTechniciansDetail.length >= MAX_TECHNICIANS) {
                searchState.completed = true;
            }
            
            await searchState.save();
            break; // Thành công, thoát khỏi vòng lặp
        } catch (error) {
            retryCount++;
            console.error(`Error saving search state (attempt ${retryCount}):`, error.message);
            
            if (retryCount >= maxRetries) {
                throw new Error(`Failed to save search state after ${maxRetries} attempts: ${error.message}`);
            }
            
            // Nếu là lỗi version conflict, thử fetch lại document mới nhất
            if (error.message.includes('No matching document found') || 
                error.message.includes('version') ||
                error.message.includes('modifiedPaths')) {
                console.log(`Version conflict detected, refreshing search state...`);
                try {
                    const refreshedSearchState = await BookingTechnicianSearch.findOne({ bookingId });
                    if (refreshedSearchState) {
                        searchState = refreshedSearchState;
                    } else {
                        // Tạo mới nếu không tìm thấy
                        searchState = new BookingTechnicianSearch({ bookingId, foundTechnicianIds: [] });
                    }
                } catch (refreshError) {
                    console.error(`Error refreshing search state:`, refreshError.message);
                }
            }
            
            // Đợi một chút trước khi thử lại
            await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
        }
    }

    // Emit socket cập nhật danh sách thợ cho khách hàng (màn hình chọn thợ)
    if (io) {
        try {
            const booking = await Booking.findById(bookingId).select('customerId');
            if (booking && booking.customerId) {
                io.to(`user:${booking.customerId.toString()}`).emit('booking:techniciansFoundUpdated', {
                    bookingId: bookingId.toString(),
                    technicians: searchState.foundTechniciansDetail,
                    total: searchState.foundTechniciansDetail.length,
                    updatedAt: new Date()
                });
            }
        } catch (emitError) {
            console.error('Lỗi emit booking:techniciansFoundUpdated:', emitError?.message || emitError);
        }
    }

    // // Gửi thông báo cho các thợ mới tìm được
    // if (io && bookingId && foundTechnicians.length > 0) {
    //     const notificationPromises = foundTechnicians.map(async tech => {
    //         const notifData = {
    //             userId: tech.userId,
    //             title: 'Yêu cầu công việc mới gần bạn',
    //             content: `Có một yêu cầu mới cách bạn khoảng ${(tech.distance / 1000).toFixed(1)} km. Nhấn để xem và báo giá.`,
    //             referenceModel: 'Booking',
    //             referenceId: bookingId,
    //             url: `/technician/send-quotation?bookingId=${bookingId}`,
    //             type: 'NEW_REQUEST'
    //         };
    //         const notify = await notificationService.createNotification(notifData);
    //         io.to(`user:${notify.userId}`).emit('receiveNotification', notify);
    //     });
    //     await Promise.all(notificationPromises);
    // }

    return {
        data: searchState.foundTechniciansDetail,
        total: searchState.foundTechniciansDetail.length,
        message: searchState.foundTechniciansDetail.length < MAX_TECHNICIANS
            ? 'Đã tìm được một số thợ, hệ thống sẽ tiếp tục tìm thêm nếu cần.'
            : 'Đã tìm đủ thợ phù hợp.'
    };
};

const createRequestAndNotify = async (bookingData, io) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const bookingCode = `BK-${Date.now()}${Math.floor(Math.random() * 1000)}`;
        // console.log('bookingCode:', bookingCode);
        const newBooking = new Booking({
            bookingCode,
            ...bookingData,
            status: 'PENDING',
            technicianId: null,
            quote: null
        });
        // console.log('--- LOCATION POINT ---', newBooking.location.geojson.coordinates);
        console.log('--- ĐẶT LỊCH MỚI ---', newBooking);

        await newBooking.save({ session });
        // console.log('--- ĐẶT LỊCH MỚI SAU SAVE ---', newBooking);

        const { location, serviceId } = bookingData;
        const searchParams = {
            latitude: location.geojson.coordinates[1],
            longitude: location.geojson.coordinates[0],
            serviceId: serviceId,
            availability: ['FREE', 'ONJOB'],
            status: 'APPROVED',
            minBalance: 0,
            isSubscribe: true,
            subscriptionStatus: ['BASIC', 'TRIAL', 'STANDARD', 'PREMIUM'],
            isUrgent: bookingData.isUrgent || false,
            customerId: bookingData.customerId // Thêm customerId để có thông tin favorite
        };

        // Tìm thợ lần đầu và lưu trạng thái
        const foundTechs = await findTechniciansWithExpandingRadiusAndSave(searchParams, newBooking._id, io);
        console.log('--- TECHNICIAN FOUND ---', foundTechs);

        await BookingTechnicianSearch.findOneAndUpdate(
            { bookingId: newBooking._id },
            {
                $set: {
                    foundTechnicianIds: foundTechs.data.map(t => t.userId),
                    foundTechniciansDetail: foundTechs.data,
                    lastSearchAt: new Date(),
                    completed: foundTechs.data.length >= MAX_TECHNICIANS
                }
            },
            { upsert: true }
        );

        await session.commitTransaction();
        session.endSession();

        // Xóa cache để đảm bảo dữ liệu mới nhất
        if (newBooking.description) {
            try {
                // Xóa cache popular descriptions
                await redisService.del('popular_descriptions_5');
                await redisService.del('popular_descriptions_10');
                
                // Xóa cache search descriptions có thể chứa description này
                const searchCacheKeys = [
                    `search_descriptions_${newBooking.description.toLowerCase().substring(0, 3)}_5`,
                    `search_descriptions_${newBooking.description.toLowerCase().substring(0, 5)}_5`
                ];
                
                for (const key of searchCacheKeys) {
                    await redisService.del(key);
                }
                
                console.log('Đã xóa cache cho description:', newBooking.description);
            } catch (cacheError) {
                console.error('Lỗi khi xóa cache:', cacheError);
                // Không throw error vì đây không phải lỗi nghiêm trọng
            }
        }

        return { booking: newBooking, technicians: foundTechs };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

const getBookingById = async (bookingId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            throw new Error('ID đặt lịch không hợp lệ');
        }

        const booking = await Booking.findById(bookingId)
            .populate({
                path: 'customerId',
            })
            .populate({
                path: 'technicianId',
                populate: [
                    {
                        path: 'userId',
                    },
                    {
                        path: 'specialtiesCategories',
                        select: 'categoryName'
                    }
                ]
            })
            .populate({
                path: 'serviceId',
            })
            .populate({
                path: 'technicianService',
                match: { isActive: true }
            })
            .populate('cancelledBy');
        if (!booking) {
            throw new Error('Không tìm thấy đặt lịch');
        }

        return booking;
    } catch (error) {
        throw error;
    }
};

const cancelBooking = async (bookingId, userId, role, reason, io) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Tìm booking
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            throw new Error('Không tìm thấy booking');
        }
        console.log('--- BOOKING ---', booking);

        const technician = await Technician.findById(booking.technicianId).populate('userId');
        console.log('--- TECHNICIAN ---', technician);

        if (role === "TECHNICIAN" && !technician) {
            throw new Error('Không tìm thấy thông tin kỹ thuật viên');
        }
        console.log('--- TECHNICIAN ID ---', technician?.userId?._id);
        console.log('--- USER ID ---', userId);

        // Kiểm tra quyền hủy
        if (role === 'CUSTOMER' && booking.customerId.toString() !== userId) {
            throw new Error('Bạn không có quyền hủy đơn này');
        }
        if (role === 'TECHNICIAN' && technician?.userId?._id?.toString() !== userId) {
            throw new Error('Bạn không có quyền hủy đơn này');
        }

        // Kiểm tra trạng thái hiện tại
        if (booking.status === 'CANCELLED') {
            throw new Error('Đơn này đã bị hủy trước đó');
        }
        if (booking.status === 'DONE') {
            throw new Error('Không thể hủy đơn đã hoàn thành');
        }
        if (booking.status === 'AWAITING_DONE') {
            throw new Error('Không thể hủy đơn khi thợ đã xác nhận hoàn thành');
        }

        // Cập nhật trạng thái booking
        await Booking.findByIdAndUpdate(
            bookingId,
            {
                $set: {
                    status: 'CANCELLED',
                    cancelledBy: userId,
                    cancellationReason: reason,
                    isChatAllowed: false,
                    isVideoCallAllowed: false
                }
            },
            { session }
        );

        // Lưu log trạng thái
        await BookingStatusLog.create([{
            bookingId,
            fromStatus: booking.status,
            toStatus: 'CANCELLED',
            changedBy: userId,
            role,
            note: reason
        }], { session });

        if (booking.status === 'IN_PROGRESS' && booking.technicianId) {
            await Technician.findByIdAndUpdate(
                booking.technicianId,
                { $set: { availability: 'FREE' } },
                { session }
            );
        }

        // Xóa TechnicianSchedule nếu có
        try {
            await technicianScheduleService.deleteScheduleByBookingId(bookingId, session);
            console.log('Đã xóa TechnicianSchedule cho booking bị hủy:', bookingId);
        } catch (scheduleError) {
            console.error('Lỗi khi xóa TechnicianSchedule:', scheduleError);
            // Không throw error vì đây không phải lỗi nghiêm trọng
        }

        io.to(`user:${booking.customerId}`).emit('booking:statusUpdate', {
            bookingId: booking._id.toString(),
            status: 'CANCELLED'
        });
        if (technician && technician.userId) {
            io.to(`user:${technician.userId._id}`).emit('booking:statusUpdate', {
                bookingId: booking._id.toString(),
                status: 'CANCELLED'
            });
        }

        if (role === 'CUSTOMER') {
            const notifData = {
                userId: technician.userId._id,
                title: 'Đơn đã bị hủy',
                content: `Khách hàng đã hủy đơn vì lí do: ${reason}`,
                referenceModel: 'Booking',
                referenceId: bookingId,
                url: '/',
                type: 'NEW_REQUEST'
            };
            const notify = await notificationService.createNotification(notifData);
            io.to(`user:${notify.userId}`).emit('receiveNotification', notify);
        }

        if (role === 'TECHNICIAN') {
            const notifData = {
                userId: booking.customerId,
                title: 'Đơn đã bị hủy',
                content: `Kỹ thuật viên đã hủy đơn vì lí do: ${reason}`,
                referenceModel: 'Booking',
                referenceId: bookingId,
                url: '/',
                type: 'NEW_REQUEST'
            };
            const notify = await notificationService.createNotification(notifData);
            io.to(`user:${notify.userId}`).emit('receiveNotification', notify);
        }

        await session.commitTransaction();

        // Lấy lại booking sau khi cập nhật
        const updatedBooking = await Booking.findById(bookingId);
        return updatedBooking;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

// const getDetailBookingById = async (bookingId) => {
//     try {
//         if (!mongoose.Types.ObjectId.isValid(bookingId)) {
//             throw new Error('ID đặt lịch không hợp lệ');
//         }

//         const booking = await Booking.findById(bookingId)
//             .populate({
//                 path: 'customerId',
//                 select: 'fullName email phone avatar'
//             })
//             .populate({
//                 path: 'technicianId',
//                 populate: [
//                     {
//                         path: 'userId',
//                         select: 'fullName email phone avatar'
//                     },
//                     {
//                         path: 'specialtiesCategories',
//                         select: 'categoryName'
//                     }
//                 ]
//             })
//             .populate({ path: 'serviceId' })
//             .populate('cancelledBy');

//         if (!booking) {
//             throw new Error('Không tìm thấy đặt lịch');
//         }

//         return {
//             booking,

//         };
//     } catch (error) {
//         throw error;
//     }
// };

const confirmJobDone = async (bookingId, userId, role) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const booking = await Booking.findById(bookingId).populate('technicianId');
        if (!booking) {
            throw new Error('Không tìm thấy booking');
        }

        // Kiểm tra quyền
        if (role === 'CUSTOMER' && booking.customerId.toString() !== userId) {
            throw new Error('Bạn không có quyền xác nhận booking này');
        }

        // Kiểm tra trạng thái hiện tại
        if (booking.status === 'CANCELLED') {
            throw new Error('Booking đã bị hủy trước đó');
        }
        if (booking.status === 'PENDING') {
            throw new Error('Không thể hoàn thành booking khi chưa chọn thợ');
        }
        if (booking.paymentStatus !== 'PAID') {
            throw new Error('Không thể hoàn thành booking khi chưa thanh toán');
        }

        // Tính toán các thông tin tài chính
        let finalPrice = booking.finalPrice || 0;
        let laborPrice = 0;
        let itemsTotal = 0;

        // Tính giá công từ quote hoặc technicianService
        if (booking.quote && booking.quote.laborPrice) {
            laborPrice = booking.quote.laborPrice;
        } else if (booking.technicianService) {
            laborPrice = booking.technicianService.price;
        }

        // Tính tổng tiền thiết bị phát sinh
        if (booking.quote && booking.quote.items && booking.quote.items.length > 0) {
            itemsTotal = booking.quote.items.reduce((sum, item) => {
                return sum + (item.price || 0) * (item.quantity || 1);
            }, 0);
        }

        // Tính finalPrice nếu chưa có
        if (!finalPrice) {
            finalPrice = laborPrice + itemsTotal;
        }

        // Cập nhật trạng thái booking với đầy đủ thông tin
        await Booking.findByIdAndUpdate(
            bookingId,
            {
                $set: {
                    status: 'DONE',
                    customerConfirmedDone: true,
                    isChatAllowed: false,
                    isVideoCallAllowed: false,
                    completedAt: new Date(),
                    finalPrice: finalPrice,
                    // Tạm thời để null các trường này theo yêu cầu
                    technicianEarning: null,
                    commissionAmount: null,
                    holdingAmount: null
                }
            },
            { session }
        );

        // Cập nhật trạng thái thợ về FREE nếu có
        if (booking.technicianId) {
            await Technician.findByIdAndUpdate(
                booking.technicianId._id,
                {
                    $set: {
                        availability: 'FREE'
                    }
                },
                { session }
            );
        }

        // Xóa TechnicianSchedule nếu có
        try {
            await technicianScheduleService.deleteScheduleByBookingId(bookingId, session);
            console.log('Đã xóa TechnicianSchedule cho booking hoàn thành:', bookingId);
        } catch (scheduleError) {
            console.error('Lỗi khi xóa TechnicianSchedule:', scheduleError);
            // Không throw error vì đây không phải lỗi nghiêm trọng
        }

        // Lưu log trạng thái
        await BookingStatusLog.create([{
            bookingId,
            fromStatus: booking.status,
            toStatus: 'DONE',
            changedBy: userId,
            role,
            note: 'Khách hàng xác nhận hoàn thành'
        }], { session });

        await session.commitTransaction();

        // Lấy lại booking sau khi cập nhật
        const updatedBooking = await Booking.findById(bookingId);
        return updatedBooking;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

// Thợ gửi báo giá (quote)
const technicianSendQuote = async (bookingId, technicianId, quoteData, io) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(bookingId).session(session);
        const technician = await Technician.findOne({ userId: technicianId });
        console.log('--- TECHNICIAN ---', technician);
        console.log('--- TECHNICIANID ---', technicianId);
        console.log('--- QUOTE DATA ---', quoteData);
        console.log('--- QUOTE DATA NOTE ---', quoteData.note);
        if (!booking) throw new Error('Không tìm thấy booking');
        if (!booking.technicianId || booking.technicianId.toString() !== technician?._id.toString()) {
            throw new Error('Bạn không có quyền gửi báo giá cho booking này');
        }
        if (booking.status !== 'PENDING' && booking.status !== 'IN_PROGRESS' && booking.status !== 'WAITING_CUSTOMER_CONFIRM_ADDITIONAL' && booking.status !== 'CONFIRM_ADDITIONAL') {
            throw new Error('Không thể gửi báo giá ở trạng thái hiện tại');
        }
        // Lấy items hiện có và items mới
        const existingItems = booking.quote?.items || [];
        const newItems = quoteData.items || [];

        // Thêm status PENDING cho tất cả items mới
        const newItemsWithStatus = newItems.map(item => ({
            ...item,
            status: 'PENDING'
        }));

        // Tích lũy items mới vào danh sách hiện có
        const combinedItems = [...existingItems, ...newItemsWithStatus];

        // Tính totalAmount chỉ từ items có status ACCEPTED
        const acceptedItemsTotal = combinedItems
            .filter(item => item.status === 'ACCEPTED')
            .reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);

        const laborPrice = quoteData.laborPrice || booking.quote?.laborPrice || 0;
        const totalAmount = laborPrice + acceptedItemsTotal;

        // Debug warranty duration logic
        console.log('--- BACKEND: Warranty duration debug ---', {
            quoteDataWarrantiesDuration: quoteData.warrantiesDuration,
            quoteDataWarrantiesDurationType: typeof quoteData.warrantiesDuration,
            existingWarrantiesDuration: booking.quote?.warrantiesDuration,
            finalWarrantiesDuration: quoteData.warrantiesDuration !== undefined ? quoteData.warrantiesDuration : (booking.quote?.warrantiesDuration || 1)
        });

        booking.quote = {
            ...booking.quote,
            laborPrice: laborPrice,
            items: combinedItems,
            warrantiesDuration: quoteData.warrantiesDuration !== undefined ? quoteData.warrantiesDuration : (booking.quote?.warrantiesDuration || 1),
            totalAmount: totalAmount,
            note: quoteData.note || 'Yêu cầu phát sinh thiết bị',
            quotedAt: new Date(),
        };
        booking.status = 'WAITING_CUSTOMER_CONFIRM_ADDITIONAL';
        await booking.save({ session });

        const notifData = {
            userId: booking.customerId,
            title: 'Có thiết bị phát sinh mới',
            content: `Kỹ thuật viên đã gửi báo giá cho thiết bị phát sinh trong booking ${booking.bookingCode}. Vui lòng kiểm tra và xác nhận.`,
            referenceModel: 'Booking',
            referenceId: bookingId,
            url: `/booking/booking-processing?bookingId=${bookingId}`,
            type: 'NEW_REQUEST'
        };
        const notify = await notificationService.createNotification(notifData);
        io.to(`user:${notify.userId}`).emit('receiveNotification', notify);

        // Emit socket events cho thiết bị phát sinh
        if (io && newItems.length > 0) {
            // Emit event thêm thiết bị phát sinh
            io.to(`user:${booking.customerId}`).emit('booking:additionalItemsAdded', {
                bookingId: booking._id,
                userId: booking.customerId,
                technicianId: technician.userId._id,
                items: newItemsWithStatus
            });

            // Emit event cập nhật trạng thái cho từng item
            newItemsWithStatus.forEach((item, index) => {
                io.to(`user:${booking.customerId}`).emit('booking:additionalItemsStatusUpdate', {
                    bookingId: booking._id,
                    userId: booking.customerId,
                    technicianId: technician.userId._id,
                    itemId: `new-item-${index}`,
                    status: 'PENDING'
                });
            });
        }

        await session.commitTransaction();
        return booking;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

// Khách đồng ý báo giá
const customerAcceptQuote = async (bookingId, customerId, io) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(bookingId).populate('technicianId', 'userId').session(session);
        console.log('--- BOOKING ---', booking);
        
        if (!booking) throw new Error('Không tìm thấy booking');
        if (booking.customerId.toString() !== customerId) {
            throw new Error('Bạn không có quyền duyệt báo giá cho booking này');
        }
        if (!booking.quote) {
            throw new Error('Không có báo giá chờ duyệt');
        }
        // Cập nhật status của tất cả items PENDING thành ACCEPTED
        if (Array.isArray(booking.quote.items)) {
            booking.quote.items = booking.quote.items.map(item => ({
                ...item,
                status: item.status === 'PENDING' ? 'ACCEPTED' : item.status
            }));
        }

        booking.status = 'CONFIRM_ADDITIONAL';

        // Tính lại totalAmount và finalPrice từ items ACCEPTED
        const acceptedItemsTotal = booking.quote.items
            .filter(item => item.status === 'ACCEPTED')
            .reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);

        booking.quote.totalAmount = (booking.quote.laborPrice || 0) + acceptedItemsTotal;
        booking.finalPrice = booking.quote.totalAmount;
        // TODO: Tính commissionAmount, technicianEarning nếu cần
        await booking.save({ session });

        const notifData = {
            userId: booking?.technicianId?.userId,
            title: 'Yêu cầu thiết bị phát sinh đã được chấp nhận',
            content: `Khách hàng đã chấp nhận báo giá cho thiết bị phát sinh trong booking ${booking.bookingCode}. Vui lòng kiểm tra và tiếp tục công việc.`,
            referenceModel: 'Booking',
            referenceId: bookingId,
            url: `/booking/booking-processing?bookingId=${bookingId}`,
            type: 'NEW_REQUEST'
        };
        const notify = await notificationService.createNotification(notifData);
        io.to(`user:${notify.userId}`).emit('receiveNotification', notify);

        // Emit socket events cho việc chấp nhận thiết bị phát sinh
        if (io && booking.technicianId) {
            const technician = await Technician.findById(booking.technicianId);
            if (technician) {
                // Emit event chấp nhận thiết bị phát sinh
                io.to(`user:${technician.userId}`).emit('booking:additionalItemsAccepted', {
                    bookingId: booking._id,
                    userId: booking.customerId,
                    technicianId: technician.userId,
                    itemIds: booking.quote.items
                        .filter(item => item.status === 'ACCEPTED')
                        .map((item, index) => `item-${index}`)
                });

                // Emit event cập nhật trạng thái cho từng item
                booking.quote.items.forEach((item, index) => {
                    if (item.status === 'ACCEPTED') {
                        io.to(`user:${booking.customerId}`).emit('booking:additionalItemsStatusUpdate', {
                            bookingId: booking._id,
                            userId: booking.customerId,
                            technicianId: technician.userId,
                            itemId: `item-${index}`,
                            status: 'ACCEPTED'
                        });
                    }
                });
            }
        }

        await session.commitTransaction();
        return booking;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

// Khách từ chối báo giá
const customerRejectQuote = async (bookingId, customerId, io) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(bookingId).populate('technicianId', 'userId').session(session);
        if (!booking) throw new Error('Không tìm thấy booking');
        if (booking.customerId.toString() !== customerId) {
            throw new Error('Bạn không có quyền từ chối báo giá cho booking này');
        }
        if (!booking.quote) {
            throw new Error('Không có báo giá chờ duyệt');
        }

        // Cập nhật status của tất cả items PENDING thành REJECTED
        if (Array.isArray(booking.quote.items)) {
            booking.quote.items = booking.quote.items.map(item => ({
                ...item,
                status: item.status === 'PENDING' ? 'REJECTED' : item.status
            }));
        }

        // Giữ nguyên trạng thái booking để thợ có thể gửi lại yêu cầu phát sinh
        booking.status = 'IN_PROGRESS';

        // Tính lại totalAmount chỉ từ items ACCEPTED (không thay đổi finalPrice)
        const acceptedItemsTotal = booking.quote.items
            .filter(item => item.status === 'ACCEPTED')
            .reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);

        booking.quote.totalAmount = (booking.quote.laborPrice || 0) + acceptedItemsTotal;

        await booking.save({ session });

        const notifData = {
            userId: booking?.technicianId?.userId,
            title: 'Yêu cầu thiết bị phát sinh đã bị từ chối',
            content: `Khách hàng đã từ chối báo giá cho thiết bị phát sinh trong booking ${booking.bookingCode}. Vui lòng gửi lại yêu cầu nếu cần.`,
            referenceModel: 'Booking',
            referenceId: bookingId,
            url: `/booking/booking-processing?bookingId=${bookingId}`,
            type: 'NEW_REQUEST'
        };
        const notify = await notificationService.createNotification(notifData);
        io.to(`user:${notify.userId}`).emit('receiveNotification', notify);

        // Emit socket events cho việc từ chối thiết bị phát sinh
        if (io && booking.technicianId) {
            const technician = await Technician.findById(booking.technicianId);
            if (technician) {
                // Emit event từ chối thiết bị phát sinh
                io.to(`user:${technician.userId}`).emit('booking:additionalItemsRejected', {
                    bookingId: booking._id,
                    userId: booking.customerId,
                    technicianId: technician.userId,
                    itemIds: booking.quote.items
                        .filter(item => item.status === 'REJECTED')
                        .map((item, index) => `item-${index}`)
                });

                // Emit event cập nhật trạng thái cho từng item
                booking.quote.items.forEach((item, index) => {
                    if (item.status === 'REJECTED') {
                        io.to(`user:${booking.customerId}`).emit('booking:additionalItemsStatusUpdate', {
                            bookingId: booking._id,
                            userId: booking.customerId,
                            technicianId: technician.userId,
                            itemId: `item-${index}`,
                            status: 'REJECTED'
                        });
                    }
                });
            }
        }

        await session.commitTransaction();
        return booking;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const getTopBookedServices = async (limit) => {
    try {
        const topServices = await Booking.aggregate([
            // 1. Chỉ lọc các booking đã "HOÀN THÀNH"
            { $match: { status: 'DONE' } },

            // 2. Nhóm theo mã dịch vụ và đếm số lượng
            { $group: { _id: '$serviceId', bookingCount: { $sum: 1 } } },

            // 3. Sắp xếp theo số lượt đặt giảm dần
            { $sort: { bookingCount: -1 } },

            // 4. Giới hạn số lượng kết quả
            { $limit: limit },

            // 5. Nối bảng để lấy thông tin chi tiết dịch vụ
            {
                $lookup: {
                    from: 'services',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'serviceDetails'
                }
            },

            // 6. Mở mảng kết quả
            { $unwind: '$serviceDetails' },

            // 7. Định dạng lại đầu ra
            {
                $project: {
                    _id: 0,
                    serviceId: '$_id',
                    service: '$serviceDetails',
                    bookingCount: '$bookingCount'
                }
            }
        ]);

        return topServices;
    } catch (error) {
        console.error("Error fetching top booked services:", error);
        throw new Error("Không thể lấy dữ liệu thống kê dịch vụ.");
    }
};

const selectTechnicianForBooking = async (bookingId, technicianId, customerId, io) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Kiểm tra booking hợp lệ
        const booking = await Booking.findOne({
            _id: bookingId,
            customerId,
            status: { $in: ['PENDING', 'AWAITING_CONFIRM'] },
            technicianId: null
        }).session(session);

        if (!booking) {
            throw new Error('Booking không hợp lệ hoặc đã có thợ nhận');
        }
        if (booking.customerId.toString() !== customerId) throw new Error('Bạn không có quyền chọn thợ cho booking này');

        // 2. Kiểm tra đã có request PENDING và chưa hết hạn cho thợ này chưa
        const existingRequest = await BookingTechnicianRequest.findOne({
            bookingId,
            technicianId,
            status: 'PENDING',
            expiresAt: { $gt: new Date() }
        }).session(session);

        if (existingRequest) {
            throw new Error('Bạn đã gửi yêu cầu cho thợ này và đang chờ phản hồi.');
        }

        // 3. Kiểm tra thời gian giữa các request (5 phút cooldown)
        // const lastRequest = await BookingTechnicianRequest.findOne({
        //     bookingId
        // }).sort({ createdAt: -1 }).session(session);

        // if (lastRequest) {
        //     const timeSinceLastRequest = Date.now() - lastRequest.createdAt;
        //     if (timeSinceLastRequest < 5 * 60 * 1000) {
        //         const secondsLeft = Math.ceil((5 * 60 * 1000 - timeSinceLastRequest) / 1000);
        //         const minutes = Math.floor(secondsLeft / 60);
        //         const seconds = secondsLeft % 60;
        //         throw new Error(`Bạn chỉ có thể gửi yêu cầu cho thợ mới sau ${minutes} phút ${seconds} giây.`);
        //     }
        // }

        // 4. Tính expiresAt theo loại booking
        const expiresAt = booking.isUrgent === true
            ? new Date(Date.now() + 15 * 60 * 1000) // 15 phút cho đặt ngay
            : new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 ngày cho đặt lịch

        // 5. Tạo request mới
        const technician = await Technician.findById(technicianId).populate('userId');
        const request = await BookingTechnicianRequest.create([{
            bookingId,
            technicianId: technician._id,
            status: 'PENDING',
            expiresAt
        }], { session });

        booking.status = 'AWAITING_CONFIRM';
        await booking.save({ session });

        // 6. Gửi thông báo cho thợ
        const notifData = {
            userId: technician?.userId?._id,
            title: 'Bạn được chọn cho đơn mới',
            content: `Khách hàng đã chọn bạn cho đơn ${booking.bookingCode}`,
            referenceModel: 'Booking',
            referenceId: bookingId,
            url: `/booking/booking-processing?bookingId=${bookingId}`,
            type: 'NEW_REQUEST'
        };
        const notify = await notificationService.createNotification(notifData);
        io.to(`user:${notify.userId}`).emit('receiveNotification', notify);

        await session.commitTransaction();
        return { success: true, message: 'Đã gửi yêu cầu thành công', request: request[0] };

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const technicianConfirmBooking = async (bookingId, technicianId) => {
    const io = getIo();
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(bookingId).session(session);
        const technician = await Technician.findOne({ userId: technicianId });
        // console.log('--- TEST TECHID ---', technician);
        // console.log('--- TEST BOOKING ---', booking);

        if (!booking) throw new Error('Không tìm thấy booking');
        if (!booking.technicianId || booking.technicianId.toString() !== technician._id.toString()) throw new Error('Bạn không có quyền xác nhận booking này');
        if (booking.status !== 'AWAITING_CONFIRM') throw new Error('Trạng thái booking không hợp lệ');

        // booking.technicianId = technicianId;
        booking.status = 'IN_PROGRESS';
        booking.isChatAllowed = true;
        booking.isVideoCallAllowed = true;
        await booking.save({ session });

        // Gửi thông báo cho khách
        await notificationService.createNotification({
            userId: booking.customerId,
            title: 'Kỹ thuật viên đã xác nhận',
            content: `Kỹ thuật viên đã xác nhận đơn ${booking.bookingCode}`,
            referenceModel: 'Booking',
            referenceId: bookingId,
            url: `/booking/${bookingId}`,
            type: 'NEW_REQUEST'
        });
        console.log(technician.userId);
        console.log(booking.customerId);

        io.to(`user:${booking.customerId.toString()}`).emit('booking:statusUpdate', {
            bookingId: booking._id,
            status: 'IN_PROGRESS'
        });
        io.to(`user:${technician.userId.toString()}`).emit('booking:statusUpdate', {
            bookingId: booking._id,
            status: 'IN_PROGRESS'
        });
        await session.commitTransaction();
        return { success: true, message: 'Kỹ thuật viên đã xác nhận nhận đơn!' };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const getUserBookingHistory = async (userId, role, limit, skip) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error('ID khách không hợp lệ');
        }

        let query = {};
        if (role === 'CUSTOMER') {
            query.customerId = userId;
        } else if (role === 'TECHNICIAN') {
            query.technicianId = userId;
        } else {
            throw new Error('Vai trò không hợp lệ');
        }
        const bookings = await Booking.find(query)
            .populate({
                path: 'technicianId',
                populate: {
                    path: 'userId'  // This means: inside technicianId, populate userId
                }
            })
            .populate('customerId', 'fullName')
            .populate('serviceId')
            .limit(Number(limit))
            .skip(Number(skip))
            .sort({ createdAt: -1 });
        return bookings;
    } catch (error) {
        console.error('Lỗi khi lấy lịch sử đặt chỗ:', error.message);
        throw error;
    }
}

const getAcceptedBooking = async (bookingId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            throw new Error('ID đặt lịch không hợp lệ');
        }

        const booking = await Booking.findOne({
            _id: bookingId,
            status: 'AWAITING_DONE',
            // status: 'CONFIRMED',

            technicianId: { $exists: true, $ne: null }
        })
            .populate({
                path: 'technicianId',
                populate: {
                    path: 'userId'
                }
            })
            .populate('serviceId')
            .populate('customerId')
            .lean();
        
        if (!booking) {
            throw new Error('Không tìm thấy đơn hàng đã được xác nhận');
        }


        return booking;
    } catch (error) {
        throw error;
    }
}

const updateBookingAddCoupon = async (bookingId, couponCode, discountValue, finalPrice, paymentMethod) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            throw new Error('ID báo giá không hợp lệ');
        }
        const update = {};
        let booking = await getBookingById(bookingId)

        if (!booking) {
            throw new Error('Không tìm thấy báo giá để cập nhật');
        }
        if (couponCode) {
            update.discountCode = couponCode;
            update.discountValue = discountValue
            update.finalPrice = finalPrice;
        } else {
            update.discountCode = null;
            update.discountValue = 0;
            update.finalPrice = finalPrice;
            
            update.holdingAmount = booking.quote.holdingAmount * 0.2;
        }
        const updatedBooking = await Booking.findByIdAndUpdate(
            booking._id,
            { $set: update },
            { new: true, session }
        )
        // const technician = await Technician.findById(updatedBooking.technicianId)
        if (!updatedBooking) {
            throw new Error('Không tìm thấy báo giá để cập nhật');
        }

        let paymentUrl = null;
        if (paymentMethod === 'PAYOS') {
            paymentUrl = await paymentService.createPayOsPayment(updatedBooking._id, updatedBooking.finalPrice);
        } else if (paymentMethod === 'CASH') {
            // Handle cash payment:
            // 1. Update booking status and create receipt


            updatedBooking.paymentStatus = 'PAID';
            updatedBooking.status = 'DONE';
            updatedBooking.isChatAllowed = false
            updatedBooking.customerConfirmedDone = true
            updatedBooking.isVideoCallAllowed = false
            updatedBooking.completedAt = new Date();
            updatedBooking.technicianEarning = booking.quote.totalAmount
            updatedBooking.warrantyExpiresAt = new Date()
            // Set warrantyExpiresAt based on warrantiesDuration (in months)
            const warrantyMonths = Number(updatedBooking.quote?.warrantiesDuration) || 0;
            updatedBooking.warrantyExpiresAt.setMonth(
                updatedBooking.warrantyExpiresAt.getMonth() + warrantyMonths
            );
            await updatedBooking.save({ session });
            const technician = await technicianService.getTechnicianById(updatedBooking.technicianId)
            technician.availability = 'FREE'
            await technician.save({ session })
           
            const TechnicianService = require('../models/TechnicianService');
            const technicianServiceModel = await TechnicianService.findOne({ 
                serviceId: updatedBooking.serviceId,
                technicianId: updatedBooking.technicianId
              });
            console.log(technicianServiceModel);

            const receiptData = {
                bookingId: updatedBooking._id,
                customerId: updatedBooking.customerId,
                technicianId: updatedBooking.technicianId,
                totalAmount: updatedBooking.finalPrice + updatedBooking.discountValue,
                // serviceAmount: updatedBooking.quote.totalAmount,
                serviceAmount: technicianServiceModel.price,

                discountAmount: updatedBooking.discountValue,
                paidAmount: updatedBooking.finalPrice,
                paymentMethod: 'CASH',
                paymentStatus: 'PAID',
                holdingAmount: updatedBooking.finalPrice * 0.2,

            };
            await receiptService.createReceipt(receiptData, session);

            // 2. Deduct commission from technician's balance
            await commissionService.deductCommission(
                updatedBooking.technicianId,
                updatedBooking.finalPrice,
                session
            );
        }

        await session.commitTransaction();
        session.endSession();

        return { booking: updatedBooking, paymentUrl: paymentUrl };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.log(error.message);

        throw error;
    }
}

const technicianAcceptBooking = async (bookingId, technicianId, io) => {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            console.log('--- technicianAcceptBooking ---');
            console.log('bookingId:', bookingId);
            console.log('technicianId:', technicianId);

            const technician = await Technician.findOne({ userId: technicianId }).populate('userId').session(session);
            console.log('--- Technician found ---', technician);

            // Kiểm tra và đảm bảo inspectionFee có giá trị
            if (!technician.inspectionFee) {
                console.log('Technician không có inspectionFee, set giá trị mặc định');
                technician.inspectionFee = 0; // Giá trị mặc định
            }

            // 1. Kiểm tra request còn hiệu lực (chưa hết hạn)
            const request = await BookingTechnicianRequest.findOne({
                bookingId,
                technicianId: technician._id,
                status: 'PENDING',
                expiresAt: { $gt: new Date() } // Chỉ lấy request chưa hết hạn
            }).session(session);
            console.log('BookingTechnicianRequest found:', request);
            if (request) {
                console.log('request.expiresAt:', request.expiresAt, 'now:', new Date(), 'expiresAt-now:', request.expiresAt - new Date());
            }

            if (!request) {
                console.log('Không tìm thấy BookingTechnicianRequest hợp lệ hoặc đã hết hạn');
                throw new Error('Đơn này đã được thợ khác nhận trước. Vui lòng tìm đơn khác.');
            }

            // 2. Kiểm tra booking chưa được assign và cập nhật atomically để tránh race condition
            const bookingUpdateResult = await Booking.findOneAndUpdate(
                {
                    _id: bookingId,
                    status: 'AWAITING_CONFIRM',
                    technicianId: null // Chỉ update nếu chưa có thợ nào được assign
                },
                {
                    $set: {
                        technicianId: technician._id,
                        status: 'IN_PROGRESS',
                        isChatAllowed: true,
                        isVideoCallAllowed: true,
                        'quote.acceptedAt': new Date() // Thêm timestamp khi thợ nhận booking
                    }
                },
                {
                    new: true, // Trả về document sau khi update
                    session: session
                }
            ).populate('serviceId');

            console.log('Booking update result:', bookingUpdateResult);

            if (!bookingUpdateResult) {
                console.log('Booking đã được nhận bởi thợ khác hoặc không còn AWAITING_CONFIRM');
                throw new Error('Đơn này đã được thợ khác nhận trước. Vui lòng tìm đơn khác.');
            }

            // 3. Sử dụng booking đã được cập nhật
            const booking = bookingUpdateResult;

            // 4. Tự động lưu giá công vào quote từ TechnicianService
            const TechnicianService = require('../models/TechnicianService');
            console.log('--- DEBUG TECHNICIAN SERVICE ---');
            console.log('Technician ID:', technician._id);
            console.log('Service ID:', booking.serviceId._id);

            const technicianService = await TechnicianService.findOne({
                technicianId: technician._id,
                serviceId: booking.serviceId._id,
                isActive: true
            }).session(session);

            console.log('TechnicianService found:', technicianService ? 'Yes' : 'No');
            if (technicianService) {
                console.log('TechnicianService details:', {
                    price: technicianService.price,
                    warrantyDuration: technicianService.warrantyDuration
                });

                booking.quote = {
                    status: 'ACCEPTED',
                    laborPrice: technicianService.price,
                    items: [],
                    totalAmount: technicianService.price,
                    warrantiesDuration: technicianService.warrantyDuration || 0,
                    quotedAt: new Date()
                };
                // Set finalPrice
                booking.finalPrice = technicianService.price;
                console.log('Đã tự động lưu giá công cho dịch vụ:', technicianService.price);
            } else {
                console.log('Không tìm thấy TechnicianService, thử tìm không cần điều kiện isActive');
                // Thử tìm TechnicianService không cần điều kiện isActive
                const technicianServiceWithoutActive = await TechnicianService.findOne({
                    technicianId: technician._id,
                    serviceId: booking.serviceId._id
                }).session(session);

                if (technicianServiceWithoutActive) {
                    console.log('Tìm thấy TechnicianService (không active):', {
                        price: technicianServiceWithoutActive.price,
                        warrantyDuration: technicianServiceWithoutActive.warrantyDuration,
                        isActive: technicianServiceWithoutActive.isActive
                    });

                    booking.quote = {
                        status: 'ACCEPTED',
                        laborPrice: technicianServiceWithoutActive.price || 0,
                        items: [],
                        totalAmount: technicianServiceWithoutActive.price || 0,
                        warrantiesDuration: technicianServiceWithoutActive.warrantyDuration || 0,
                        quotedAt: new Date()
                    };
                    booking.finalPrice = technicianServiceWithoutActive.price || 0;
                    console.log('Đã lưu giá công từ TechnicianService (không active):', technicianServiceWithoutActive.price);
                } else {
                    console.log('Không tìm thấy TechnicianService nào, tạo quote với giá trị mặc định');
                    // Tạo quote với giá trị mặc định nếu không tìm thấy technicianService
                    booking.quote = {
                        status: 'ACCEPTED',
                        laborPrice: 0,
                        items: [],
                        totalAmount: 0,
                        warrantiesDuration: 0,
                        quotedAt: new Date()
                    };
                    booking.finalPrice = 0;
                }
            }

            await booking.save({ session });

            // 5. Tạo TechnicianSchedule nếu booking là scheduled type
            if (booking.isUrgent === false && booking.schedule && booking.schedule.startTime && booking.schedule.expectedEndTime) {
                try {
                    await technicianScheduleService.createScheduleForBooking(booking, session);
                    console.log('Đã tạo TechnicianSchedule cho booking scheduled:', booking._id);
                } catch (scheduleError) {
                    console.error('Lỗi khi tạo TechnicianSchedule:', scheduleError);
                    // Không throw error vì đây không phải lỗi nghiêm trọng
                }
            }

            // 6. Cập nhật request chỉ khi thợ này thực sự nhận được booking
            console.log('Cập nhật request: set status ACCEPTED');
            const requestUpdateResult = await BookingTechnicianRequest.findOneAndUpdate(
                {
                    _id: request._id,
                    status: 'PENDING', // Chỉ update nếu request vẫn còn PENDING
                    expiresAt: { $gt: new Date() } // Và chưa hết hạn
                },
                {
                    $set: { status: 'ACCEPTED' }
                },
                {
                    new: true,
                    session: session
                }
            );

            if (!requestUpdateResult) {
                console.log('Request đã được xử lý bởi thợ khác hoặc đã hết hạn');
                throw new Error('Đơn này đã được thợ khác nhận trước. Vui lòng tìm đơn khác.');
            }

            technician.availability = 'ONJOB';
            await technician.save({ session });

            // 7. Hủy các request khác (chỉ những request còn hiệu lực)
            console.log('Hủy các request khác (set status REJECTED)');
            const rejectResult = await BookingTechnicianRequest.updateMany(
                {
                    bookingId,
                    _id: { $ne: requestUpdateResult._id }, // Sử dụng ID của request đã được cập nhật
                    status: 'PENDING',
                    expiresAt: { $gt: new Date() } // Chỉ hủy những request chưa hết hạn
                },
                {
                    status: 'REJECTED'
                },
                { session }
            );
            console.log(`Đã hủy ${rejectResult.modifiedCount} request khác`);

            // 8. Thông báo cho khách hàng
            const notifData = {
                userId: booking?.customerId,
                title: 'Thợ đã nhận đơn của bạn',
                content: `Kỹ thuật viên ${technician?.userId?.fullName} đã chấp nhận yêu cầu của bạn cho đơn ${booking?.bookingCode}`,
                referenceModel: 'Booking',
                referenceId: bookingId,
                url: `/booking/booking-processing?bookingId=${bookingId}`,
                type: 'NEW_REQUEST'
            };
            const notify = await notificationService.createNotification(notifData);
            io.to(`user:${notify.userId}`).emit('receiveNotification', notify);

            // Thông báo cho thợ thắng cuộc
            io.to(`user:${technician.userId._id}`).emit('booking:accepted', {
                bookingId,
                bookingCode: booking.bookingCode,
                customerName: booking.customerId?.fullName || 'Khách hàng'
            });

            // Emit socket event cho booking request accepted
            io.to(`user:${booking.customerId}`).emit('booking:requestAccepted', {
                bookingId: booking._id,
                userId: booking.customerId,
                technicianId: technician.userId._id,
                requestId: requestUpdateResult._id
            });

            // Thông báo cho các thợ bị từ chối
            const rejectedRequests = await BookingTechnicianRequest.find({
                bookingId,
                status: 'REJECTED'
            }).populate('technicianId', 'userId').session(session);
            console.log('Các request bị hủy:', rejectedRequests);

            rejectedRequests.forEach(req => {
                // Lấy userId của thợ từ technicianId
                const technicianUserId = req.technicianId?.userId;
                if (technicianUserId) {
                    io.to(`technician:${technicianUserId}`).emit('booking:cancelled', {
                        bookingId,
                        reason: 'Đã có thợ khác nhận đơn này'
                    });
                }
            });

            // Emit socket event cho booking request status update
            io.to(`user:${booking.customerId}`).emit('booking:requestStatusUpdate', {
                bookingId: booking._id,
                userId: booking.customerId,
                technicianId: technician.userId._id,
                requestId: requestUpdateResult._id,
                status: 'ACCEPTED'
            });

            await session.commitTransaction();
            console.log('Nhận đơn thành công!');
            console.log(`Thợ ${technician.userId.fullName} (ID: ${technician._id}) đã nhận booking ${booking.bookingCode}`);
            console.log('--- BOOKING AFTER ACCEPT ---');
            console.log('booking.technicianId:', booking.technicianId);
            console.log('booking.status:', booking.status);
            console.log('technician.userId._id:', technician.userId._id);
            return { success: true, message: 'Đã nhận đơn thành công', booking };

        } catch (error) {
            await session.abortTransaction();
            console.error('Lỗi trong technicianAcceptBooking (attempt ' + (retryCount + 1) + '):', error);

            // Nếu là lỗi MongoDB transaction conflict, thử lại
            if (error.message.includes('Write conflict') || error.message.includes('Transaction numbers')) {
                retryCount++;
                if (retryCount < maxRetries) {
                    console.log('Retrying... Attempt ' + (retryCount + 1));
                    session.endSession();
                    continue; // Thử lại
                }
            }

            // Xử lý lỗi race condition một cách rõ ràng
            if (error.message.includes('Booking đã được nhận bởi thợ khác') ||
                error.message.includes('Yêu cầu đã được xử lý bởi thợ khác') ||
                error.message.includes('Đơn này đã được thợ khác nhận trước')) {
                throw new Error('Đơn này đã được thợ khác nhận trước. Vui lòng tìm đơn khác.');
            }

            throw error;
        } finally {
            session.endSession();
        }
    }

    // Nếu đã thử hết số lần mà vẫn lỗi
    throw new Error('Có lỗi xảy ra khi xử lý yêu cầu. Vui lòng thử lại.');
};

// Thợ từ chối booking
const technicianRejectBooking = async (bookingId, technicianId, io) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        console.log('--- TECHNICIAN REJECT BACKEND DEBUG ---');
        console.log('Booking ID:', bookingId);
        console.log('Technician ID:', technicianId);

        // Kiểm tra booking tồn tại
        const booking = await Booking.findById(bookingId).session(session);
        console.log('Booking found:', booking ? 'Yes' : 'No');
        if (booking) {
            console.log('Booking status:', booking.status);
            console.log('Booking customerId:', booking.customerId);
            console.log('Booking technicianId:', booking.technicianId);
        }

        // Kiểm tra technician
        const technician = await Technician.findOne({ userId: technicianId }).session(session);
        console.log('Technician found:', technician ? 'Yes' : 'No');
        if (technician) {
            console.log('Technician ID:', technician._id);
            // Kiểm tra và đảm bảo inspectionFee có giá trị
            if (!technician.inspectionFee) {
                console.log('Technician không có inspectionFee, set giá trị mặc định');
                technician.inspectionFee = 0; // Giá trị mặc định
            }
        }

        // 1. Kiểm tra request còn hiệu lực (chưa hết hạn)
        const request = await BookingTechnicianRequest.findOne({
            bookingId,
            technicianId: technician._id,
            status: 'PENDING',
            expiresAt: { $gt: new Date() } // Chỉ lấy request chưa hết hạn
        }).session(session);

        console.log('Request found:', request ? 'Yes' : 'No');
        if (request) {
            console.log('Request status:', request.status);
            console.log('Request expiresAt:', request.expiresAt);
            console.log('Current time:', new Date());
            console.log('Is expired:', request.expiresAt <= new Date());
        } else {
            // Kiểm tra tất cả requests cho booking này
            const allRequests = await BookingTechnicianRequest.find({
                bookingId,
                technicianId: technician._id
            }).session(session);
            console.log('All requests for this booking-technician:', allRequests.length);
            allRequests.forEach((req, index) => {
                console.log(`Request ${index + 1}:`, {
                    status: req.status,
                    expiresAt: req.expiresAt,
                    createdAt: req.createdAt
                });
            });
        }

        // Nếu không có request PENDING, kiểm tra xem booking có đang được assign cho technician này không
        if (!request) {
            if (booking && booking.technicianId && booking.technicianId.toString() === technician._id.toString()) {
                console.log('Booking đã được assign cho technician này, có thể reject trực tiếp');
                // Cập nhật booking status về AWAITING_CONFIRM và remove technicianId
                booking.status = 'AWAITING_CONFIRM';
                booking.technicianId = null;
                booking.isChatAllowed = false;
                booking.isVideoCallAllowed = false;
                await booking.save({ session });

                // Thông báo cho khách
                io.to(`user:${booking.customerId}`).emit('booking:technicianResponse', {
                    bookingId,
                    technicianId: technician._id,
                    status: 'rejected'
                });

                await session.commitTransaction();
                return { success: true, message: 'Đã từ chối yêu cầu thành công' };
            } else {
                throw new Error('Yêu cầu không tồn tại, đã được xử lý hoặc đã hết hạn');
            }
        }

        // 2. Cập nhật request
        request.status = 'REJECTED';
        await request.save({ session });

        // 3. Thông báo cho khách
        if (booking) {
            io.to(`user:${booking.customerId}`).emit('booking:technicianResponse', {
                bookingId,
                technicianId: technician._id,
                status: 'rejected'
            });

            // Emit socket event cho booking request rejected
            io.to(`user:${booking.customerId}`).emit('booking:requestRejected', {
                bookingId: booking._id,
                userId: booking.customerId,
                technicianId: technician.userId._id,
                requestId: request._id
            });

            // Emit socket event cho booking request status update
            io.to(`user:${booking.customerId}`).emit('booking:requestStatusUpdate', {
                bookingId: booking._id,
                userId: booking.customerId,
                technicianId: technician.userId._id,
                requestId: request._id,
                status: 'REJECTED'
            });
        }

        await session.commitTransaction();
        return { success: true, message: 'Đã từ chối yêu cầu thành công' };

    } catch (error) {
        console.log('--- TECHNICIAN REJECT ERROR ---', error.message);
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const getBookingTechnicianRequests = async (bookingId) => {
    return await BookingTechnicianRequest.find({ bookingId });
};

// Hàm helper để lấy thông tin request status và thời gian còn lại
const getRequestStatusInfo = async (bookingId, technicianId) => {
    const request = await BookingTechnicianRequest.findOne({
        bookingId,
        technicianId,
        status: { $in: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'] }
    });

    if (!request) {
        return {
            status: 'NONE',
            canSendRequest: true,
            timeLeft: null
        };
    }

    let canSendRequest = false;
    let timeLeft = null;

    if (request.status === 'PENDING') {
        if (request.expiresAt > new Date()) {
            // Request còn hiệu lực
            timeLeft = Math.max(0, request.expiresAt - new Date());
            canSendRequest = false;
        } else {
            // Request đã hết hạn nhưng chưa được update bởi cronjob
            canSendRequest = true;
        }
    } else if (request.status === 'EXPIRED') {
        canSendRequest = true;
    } else {
        // ACCEPTED hoặc REJECTED
        canSendRequest = false;
    }

    return {
        status: request.status,
        canSendRequest,
        timeLeft,
        createdAt: request.createdAt,
        expiresAt: request.expiresAt
    };
};

const getTechniciansFoundByBookingId = async (bookingId) => {
    try {
        const search = await BookingTechnicianSearch.findOne({ bookingId });
        if (!search || !search.foundTechniciansDetail || search.foundTechniciansDetail.length === 0) {
            console.log(`Không tìm thấy dữ liệu tìm kiếm cho booking ${bookingId}`);
            return [];
        }

        // Kiểm tra xem dữ liệu có đầy đủ không
        const hasCompleteData = search.foundTechniciansDetail.every(tech => 
            tech.estimatedArrivalTime && 
            tech.isSubscribe !== undefined && 
            tech.subscriptionStatus &&
            tech.isFavorite !== undefined &&
            tech.favoritePriority !== undefined
        );

        if (!hasCompleteData) {
            console.log(`Dữ liệu tìm kiếm cho booking ${bookingId} chưa đầy đủ, chạy lại tìm kiếm...`);
            // console.log('--- DEBUG: Dữ liệu cũ ---', search.foundTechniciansDetail.map(tech => ({
            //     id: tech._id,
            //     name: tech.userInfo?.fullName,
            //     isFavorite: tech.isFavorite,
            //     favoritePriority: tech.favoritePriority,
            //     subscriptionStatus: tech.subscriptionStatus
            // })));
            
            // Lấy thông tin booking để chạy lại tìm kiếm
            const booking = await Booking.findById(bookingId);
            if (!booking) {
                console.log(`Không tìm thấy booking ${bookingId}`);
                return search.foundTechniciansDetail; // Trả về dữ liệu cũ nếu không tìm thấy booking
            }

            // Chạy lại tìm kiếm để có dữ liệu đầy đủ
            const searchParams = {
                latitude: booking.location.geojson.coordinates[1],
                longitude: booking.location.geojson.coordinates[0],
                serviceId: booking.serviceId,
                availability: ['FREE', 'ONJOB'],
                status: 'APPROVED',
                minBalance: 0,
                isSubscribe: true,
                subscriptionStatus: ['BASIC', 'TRIAL', 'STANDARD', 'PREMIUM'],
                isUrgent: booking.isUrgent || false,
                customerId: booking.customerId // Thêm customerId để có thông tin favorite
            };

            const result = await findTechniciansWithExpandingRadiusAndSave(
                searchParams,
                bookingId,
                null // Không cần io ở đây
            );

            // Cập nhật lại dữ liệu trong database
            if (result && result.data && result.data.length > 0) {
                await BookingTechnicianSearch.findOneAndUpdate(
                    { bookingId },
                    {
                        $set: {
                            foundTechniciansDetail: result.data,
                            lastSearchAt: new Date()
                        }
                    }
                );
                console.log(`Đã cập nhật lại dữ liệu tìm kiếm cho booking ${bookingId}`);
                // console.log('--- DEBUG: Dữ liệu mới ---', result.data.map(tech => ({
                //     id: tech._id,
                //     name: tech.userInfo?.fullName,
                //     isFavorite: tech.isFavorite,
                //     favoritePriority: tech.favoritePriority,
                //     subscriptionStatus: tech.subscriptionStatus
                // })));
                return result.data;
            }
        }

        console.log(`Trả về dữ liệu tìm kiếm đầy đủ cho booking ${bookingId}:`, search.foundTechniciansDetail.length, 'thợ');
        return search.foundTechniciansDetail;
    } catch (error) {
        console.error(`Lỗi khi lấy danh sách thợ cho booking ${bookingId}:`, error.message);
        // Trả về dữ liệu cũ nếu có lỗi
        const search = await BookingTechnicianSearch.findOne({ bookingId });
        return search?.foundTechniciansDetail || [];
    }
};

// Lấy các mô tả booking phổ biến nhất với Redis cache
const getPopularDescriptions = async (limit = 10) => {
    try {
        // Kiểm tra cache trước
        const cacheKey = `popular_descriptions_${limit}`;
        const cached = await redisService.get(cacheKey);
        
        if (cached) {
            console.log('Lấy popular descriptions từ Redis cache');
            return {
                success: true,
                data: cached
            };
        }

        // Nếu không có cache, chạy aggregation
        console.log('Chạy aggregation để lấy popular descriptions');
        const popularDescriptions = await Booking.aggregate([
            {
                $match: {
                    description: { $exists: true, $ne: null, $ne: "" }
                }
            },
            {
                $group: {
                    _id: "$description",
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $limit: parseInt(limit)
            },
            {
                $project: {
                    description: "$_id",
                    count: 1,
                    _id: 0
                }
            }
        ]);

        // Cache kết quả trong 15 phút
        await redisService.set(cacheKey, popularDescriptions, 900);

        return {
            success: true,
            data: popularDescriptions
        };
    } catch (error) {
        console.error('Lỗi khi lấy mô tả phổ biến:', error);
        return {
            success: false,
            message: 'Lỗi server khi lấy mô tả phổ biến'
        };
    }
};

// Tìm kiếm mô tả theo từ khóa với Redis cache
const searchDescriptions = async (query, limit = 5) => {
    try {
        if (!query || query.trim().length < 2) {
            return {
                success: true,
                data: []
            };
        }

        // Kiểm tra cache trước
        const cacheKey = `search_descriptions_${query.trim().toLowerCase()}_${limit}`;
        const cached = await redisService.get(cacheKey);
        
        if (cached) {
            console.log('Lấy search results từ Redis cache cho query:', query);
            return {
                success: true,
                data: cached
            };
        }

        // Nếu không có cache, chạy aggregation
        console.log('Chạy aggregation để tìm kiếm descriptions cho query:', query);
        const searchResults = await Booking.aggregate([
            {
                $match: {
                    description: {
                        $regex: query.trim(),
                        $options: 'i'
                    }
                }
            },
            {
                $group: {
                    _id: "$description",
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $limit: parseInt(limit)
            },
            {
                $project: {
                    description: "$_id",
                    count: 1,
                    _id: 0
                }
            }
        ]);

        // Cache kết quả trong 10 phút (ngắn hơn vì search thay đổi nhiều)
        await redisService.set(cacheKey, searchResults, 600);

        return {
            success: true,
            data: searchResults
        };
    } catch (error) {
        console.error('Lỗi khi tìm kiếm mô tả:', error);
        return {
            success: false,
            message: 'Lỗi server khi tìm kiếm mô tả'
        };
    }
};

module.exports = {
    createRequestAndNotify,
    getBookingById,
    cancelBooking,
    confirmJobDone,
    getAcceptedBooking,
    updateBookingAddCoupon,
    findTechniciansWithExpandingRadiusAndSave,
    // getDetailBookingById,
    technicianSendQuote,
    customerAcceptQuote,
    customerRejectQuote,
    getTopBookedServices,
    selectTechnicianForBooking,
    technicianConfirmBooking,
    getUserBookingHistory,
    technicianRejectBooking,
    technicianAcceptBooking,
    getBookingTechnicianRequests,
    getTechniciansFoundByBookingId,
    getRequestStatusInfo,
    getPopularDescriptions,
    searchDescriptions,
};
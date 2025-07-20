// const bookingItemService = require('../services/bookingItemService');
// const { getIo } = require('../sockets/socketManager');

// const proposeAdditionalItems = async (req, res) => {
//     try {
//         const { bookingId } = req.params;
//         const userId = req.user.userId;
//         // console.log('--- USER ID ---', userId);
        
//         const { items, reason } = req.body;

//         const result = await bookingItemService.proposeAdditionalItems(
//             bookingId,
//             userId,
//             items,
//             reason
//         );

//         res.status(201).json({
//             success: true,
//             message: 'Đề xuất thêm chi phí đã được gửi thành công',
//             data: result
//         });
//     } catch (error) {
//         console.error('Lỗi khi đề xuất thêm chi phí:', error);
//         res.status(400).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// const getAdditionalItemsByBooking = async (req, res) => {
//     try {
//         const { bookingId } = req.params;
//         const userId = req.user.userId;
//         const role = req.user.role;

//         const items = await bookingItemService.getAdditionalItemsByBooking(
//             bookingId,
//             userId,
//             role
//         );

//         res.status(200).json({
//             success: true,
//             message: 'Lấy danh sách chi phí phát sinh thành công',
//             data: items
//         });
//     } catch (error) {
//         console.error('Lỗi khi lấy danh sách chi phí phát sinh:', error);
//         res.status(400).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// const approveAdditionalItems = async (req, res) => {
//     try {
//         const { bookingId } = req.params;
//         const customerId = req.user.userId;
//         const { reason } = req.body || {};

//         const result = await bookingItemService.approveAdditionalItems(
//             bookingId,
//             customerId,
//             reason
//         );

//         res.status(200).json({
//             success: true,
//             message: 'Đã xác nhận chi phí phát sinh',
//             data: result
//         });
//     } catch (error) {
//         console.error('Lỗi khi xác nhận chi phí phát sinh:', error);
//         res.status(400).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// const rejectAdditionalItems = async (req, res) => {
//     try {
//         const { bookingId } = req.params;
//         const customerId = req.user.userId;
//         const { reason } = req.body || {};

//         const result = await bookingItemService.rejectAllAdditionalItems(
//             bookingId,
//             customerId,
//             reason
//         );

//         res.status(200).json({
//             success: true,
//             message: 'Đã từ chối chi phí phát sinh',
//             data: result
//         });
//     } catch (error) {
//         console.error('Lỗi khi từ chối chi phí phát sinh:', error);
//         res.status(400).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// module.exports = {
//     proposeAdditionalItems,
//     getAdditionalItemsByBooking,
//     approveAdditionalItems,
//     rejectAdditionalItems
// };
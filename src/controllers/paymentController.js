const bookingPriceService = require("../services/bookingPriceService");
const paymentService = require('../services/paymentService');
const BookingPrice = require('../models/BookingPrice');
const { generateToken } = require('../utils/jwt');
const { generateCookie } = require('../utils/generateCode');

const finalizeBooking = async (req, res) => {
    try {
        const { bookingPriceId } = req.params;
        const { couponCode, discountValue, finalPrice, paymentMethod } = req.body;
        const updatedBookingPrice = await bookingPriceService.updateBookingPriceAddCoupon(
            bookingPriceId,
            couponCode,
            discountValue,
            finalPrice,
            paymentMethod
        );
        console.log("Updated Booking Price :",updatedBookingPrice);
        
        const paymentUrl = updatedBookingPrice.paymentUrl || null;

        res.status(200).json({
            success: true,
            message: 'Cập nhật và xử lý thanh toán thành công',
            data: {
                bookingPrice: updatedBookingPrice.bookingPrice,
                paymentUrl: paymentUrl
            }
        });
    } catch (error) {
        console.error('Lỗi khi xử lý thanh toán:', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi xử lý thanh toán',
            error: error.message
        });
    }
};

const handlePayOsSuccess = async (req, res) => {
    const { orderCode, bookingPriceId } = req.query;
    try {
        await paymentService.handleSuccessfulPayment(orderCode, bookingPriceId);

        const bookingPrice = await bookingPriceService.getBookingPriceIdForUser(bookingPriceId)

        if (bookingPrice && bookingPrice.bookingId && bookingPrice.bookingId.customerId) {
            const user = bookingPrice.bookingId.customerId.toObject();
            console.log('---------USER------------',user);

            const token = generateToken(user);
            await generateCookie(token, res);
        }

        res.redirect(`${process.env.FRONT_END_URL}/payment-success`);
    } catch (error) {
        console.error('Error in PayOS success handler:', error);
        try {
            if (bookingPriceId) {
                const bookingPrice = await bookingPriceService.getBookingPriceIdForUser(bookingPriceId)

                if (bookingPrice && bookingPrice.bookingId && bookingPrice.bookingId.customerId) {
                    const user = bookingPrice.bookingId.customerId.toObject();
                    console.log('---------USER------------',user);
                    
                    const token = generateToken(user);
                    await generateCookie(token, res);
                }
            }
        } catch (loginError) {
            console.error('Error during login on payment failure:', loginError);
        }
        res.redirect(`${process.env.FRONT_END_URL}/payment-failed?error=${error.message}`);
    }
};

const handlePayOsCancel = async (req, res) => {
    const { bookingPriceId } = req.query;
    try {
        if (bookingPriceId) {
            const bookingPrice = await bookingPriceService.getBookingPriceIdForUser(bookingPriceId)

            if (bookingPrice && bookingPrice.bookingId && bookingPrice.bookingId.customerId) {
                const user = bookingPrice.bookingId.customerId.toObject();
                console.log('---------USER------------',user);

                const token = generateToken(user);
                await generateCookie(token, res);
            }
        }
    } catch (error) {
        console.error('Error in PayOS cancel handler:', error);
    } finally {
        res.redirect(`${process.env.FRONT_END_URL}/payment-cancel?error=Payment was cancelled by the user.`);
    }
};

module.exports = {
    finalizeBooking,
    handlePayOsSuccess,
    handlePayOsCancel
}; 

const bookingService = require("../services/bookingService");
const paymentService = require('../services/paymentService');
const { generateToken } = require('../utils/jwt');
const { generateCookie } = require('../utils/generateCode');
const userService = require('../services/userService')

const finalizeBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;

        const { couponCode, discountValue, finalPrice, paymentMethod } = req.body;
        const updatedBooking = await bookingService.updateBookingAddCoupon(
            bookingId,
            couponCode,
            discountValue,
            finalPrice,
            paymentMethod
        );

        const paymentUrl = updatedBooking.paymentUrl || null;

        res.status(200).json({
            success: true,
            message: 'Cập nhật và xử lý thanh toán thành công',
            data: {
                booking: updatedBooking,
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
    const { orderCode, bookingId } = req.query;
    try {
        await paymentService.handleSuccessfulPayment(orderCode, bookingId);

        const booking = await bookingService.getBookingById(bookingId)

        if (booking && booking.customerId) {
            const userWithRole = await userService.findUserById(booking.customerId._id)
            console.log(userWithRole);
            const token = generateToken(userWithRole);
            await generateCookie(token, res);
        }

        res.redirect(`${process.env.FRONT_END_URL}/feedback/submit/${booking._id}`);
    } catch (error) {
        console.error('Error in PayOS success handler:', error);
        try {
            if (bookingPriceId) {
                const booking = await bookingService.getBookingById(bookingId)
                if (booking && booking.customerId) {
                    const userWithRole = await userService.findUserById(booking.customerId._id)
                    console.log(userWithRole);
                    const token = generateToken(userWithRole);
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
    const { bookingId } = req.query;
    try {
        if (bookingId) {
            const booking = await bookingService.getBookingById(bookingId)

            if (booking && booking.customerId) {

                const userWithRole = await userService.findUserById(booking.customerId._id)
                console.log(userWithRole);

                const token = generateToken(userWithRole);

                await generateCookie(token, res);
            }
            res.redirect(`${process.env.FRONT_END_URL}/checkout?bookingId=${booking._id}`);

        }

    } catch (error) {
        console.error('Error in PayOS cancel handler:', error);
    }
};

const depositBalance = async (req, res) => {
    try {
        const { amount } = req.body
        const depositURL = await paymentService.createPayOsDeposit(req.user.userId, amount)
        res.status(200).json({
            success: true,
            message: 'Cập nhật và xử lý nạp tiền thành công',
            data: {
                depositURL: depositURL
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi xử lý nạp tiền',
            error: error.message
        });
    }
}

const handleDepositPayOsSuccess = async (req, res) => {
    const { amount, userId } = req.query;
    try {
        await paymentService.handleSuccessfulDeposit(amount, userId);

        const user = await userService.findUserById(userId)

        if (user) {
            const token = generateToken(user);
            await generateCookie(token, res);
        }

        res.redirect(`${process.env.FRONT_END_URL}/technician/deposit`);
    } catch (error) {
        console.error('Error in PayOS success handler:', error);
        try {
            const user = await userService.findUserById(userId)

            if (user) {
                const token = generateToken(user);
                await generateCookie(token, res);
            }
        } catch (loginError) {
            console.error('Error during login on payment failure:', loginError);
        }
        res.redirect(`${process.env.FRONT_END_URL}/deposit-fail?error=${error.message}`);
    }
}

const handleDepositPayOsCancel = async (req, res) => {
    const { amount, userId } = req.query;
    try {
        if (userId) {
            await paymentService.handleCancelDeposit(amount, userId);
            const user = await userService.findUserById(userId)
            if (user) {
                const token = generateToken(user);
                await generateCookie(token, res);
            }
        }
    } catch (error) {
        console.error('Error in PayOS cancel handler:', error);
    } finally {
        res.redirect(`${process.env.FRONT_END_URL}/technician/deposit`);
    }
};

module.exports = {
    finalizeBooking,
    handlePayOsSuccess,
    handlePayOsCancel,
    depositBalance,
    handleDepositPayOsSuccess,
    handleDepositPayOsCancel
};  

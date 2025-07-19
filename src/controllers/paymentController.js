const bookingPriceService = require("../services/bookingPriceService");
const paymentService = require('../services/paymentService');
const { generateToken } = require('../utils/jwt');
const { generateCookie } = require('../utils/generateCode');
const userService = require('../services/userService')
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
            const token = generateToken(user);
            await generateCookie(token, res);
        }

        res.redirect(`${process.env.FRONT_END_URL}/feedback`);
    } catch (error) {
        console.error('Error in PayOS success handler:', error);
        try {
            if (bookingPriceId) {
                const bookingPrice = await bookingPriceService.getBookingPriceIdForUser(bookingPriceId)

                if (bookingPrice && bookingPrice.bookingId && bookingPrice.bookingId.customerId) {
                    const user = bookingPrice.bookingId.customerId.toObject();
                    console.log('---------USER------------', user);

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

                const token = generateToken(user);
                await generateCookie(token, res);
            }
            res.redirect(`${process.env.FRONT_END_URL}/checkout?bookingId=${bookingPrice.bookingId._id}`);

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
    const { amount,userId } = req.query;
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

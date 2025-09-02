const bookingService = require("../services/bookingService");
const paymentService = require('../services/paymentService');
const { generateToken } = require('../utils/jwt');
const { generateCookie } = require('../utils/generateCode');
const userService = require('../services/userService');
const { userInfo } = require("node:os");

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
           
                const booking = await bookingService.getBookingById(bookingId)
                if (booking && booking.customerId) {
                    const userWithRole = await userService.findUserById(booking.customerId._id)
                    console.log(userWithRole);
                    const token = generateToken(userWithRole);
                    await generateCookie(token, res);
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

const handleSubscriptionPayOsSuccess = async (req, res) => {
    const { amount, userId, packageId } = req.query;
    try {
        await paymentService.handleSuccessfulSubscription(amount, userId, packageId);

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

const handleSubscriptionPayOsCancel = async (req, res) => {
    const { amount, userId } = req.query;
    try {
        if (userId) {
            await paymentService.handleCancelSubscription(amount, userId);
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

const subscriptionBalance = async (req, res) => {
    try {
        const { amount } = req.body
        const depositURL = await paymentService.createPayOsSubscription(req.user.userId, amount)
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

const extendSubscription = async (req, res) => {
    try {
        const { days, technicianId, packageId } = req.body;
        if (!days || !technicianId || !packageId) {
            return res.status(400).json({ message: 'Thiếu thông tin!' });
        }

        const packageInfo = await paymentService.getPackageById(packageId);
        if (!packageInfo) return res.status(404).json({ message: 'Không tìm thấy gói!' });

        const amount = Math.round((packageInfo.price / 30) * days);
        const  userId = technicianId;

        // const paymentPayload = {
        //     amount,
        //     description: `Gia hạn gói ${packageId} thêm ${days} ngày`,
        //     userId: technicianId, // userId trong userService = technician.userId
        //     packageId,
        //     days,
        //     redirectUrl: `${process.env.BACK_END_URL}/api/payment/subscription/extend/success`,
        // };

       

        const checkoutUrl = await paymentService.createExtendPayOsPayment(userId, {
            amount,
            packageId,
            days
        });

        res.json({ checkoutUrl });
    } catch (err) {
        console.error('Error in extendSubscription:', err);
        res.status(500).json({ message: 'Lỗi tạo thanh toán gia hạn' });
    }
};

const handleExtendPayOsSuccess = async (req, res) => {
    const { amount, userId, packageId, days } = req.query;

    try {
        await paymentService.handleExtendSubscription(
            parseInt(amount),
            userId,
            packageId,
            parseInt(days)
        );

        const user = await userService.findUserById(userId);
        if (user) {
            const token = generateToken(user);
            await generateCookie(token, res);
        }

        res.redirect(`${process.env.FRONT_END_URL}/technician/deposit`);
    } catch (error) {
        console.error('Error in handleExtendPayOsSuccess:', error);

        try {
            const user = await userService.findUserById(userId);
            if (user) {
                const token = generateToken(user);
                await generateCookie(token, res);
            }
        } catch (loginError) {
            console.error('Error during login on extend failure:', loginError);
        }

        res.redirect(`${process.env.FRONT_END_URL}/deposit-fail?error=${encodeURIComponent(error.message)}`);
    }
};

const handleSubscriptionExtendCancel = async (req, res) => {
  const { userId, packageId, days } = req.query;

  try {
    if (!userId || !packageId || !days) {
      throw new Error('Thiếu thông tin để hủy gia hạn');
    }

    await paymentService.handleExtendSubscriptionCancel(userId, packageId, Number(days));

    const user = await userService.findUserById(userId);
    if (user) {
      const token = generateToken(user);
      await generateCookie(token, res);
    }
  } catch (error) {
    console.error('Error in cancel subscription extension handler:', error);
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
    handleDepositPayOsCancel,
    subscriptionBalance,
    handleSubscriptionPayOsSuccess,
    handleSubscriptionPayOsCancel,
    extendSubscription,
    handleExtendPayOsSuccess,
    handleSubscriptionExtendCancel
};  

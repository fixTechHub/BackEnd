const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Sends a verification email to the provided address with a verification code.
 * @param {string} email - The recipient's email address.
 * @param {string} code - The verification code.
 */
exports.sendVerificationEmail = async (email, code) => {
    const emailHTML = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Chào mừng bạn đến với FixHub!</h2>
            <p>Mã xác thực của bạn là: <b style='font-size: 20px;'>${code}</b></p>
            <p>Mã này có hiệu lực trong 5 phút.</p>
            <p>Nếu bạn không yêu cầu đăng ký, vui lòng bỏ qua email này.</p>
        </div>
    `;

    const mailOptions = {
        from: `"FixHub" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Mã xác thực đăng ký tài khoản - FixHub",
        html: emailHTML,
        text: `Mã xác thực của bạn là: ${code}. Mã này có hiệu lực trong 5 phút.`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Verification code sent to ${email}`);
    } catch (error) {
        console.error(`Failed to send verification code to ${email}:`, error.message);
    }
};

exports.sendResetPassword = async (email, resetLink) => {

    const emailHTML = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Welcome!</h2>
            <p>Please reset your password by clicking the link below:</p>
            <a href="${resetLink}" style="display: inline-block; padding: 10px 15px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
            <p>If you did not change for this account, you can safely ignore this email.</p>
        </div>
    `;

    const mailOptions = {
        from: `"FixHub" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Reset Password -FixHub",
        html: emailHTML,
        text: `Reset your password by visiting this link: ${resetLink}`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Reset password sent to ${email}`);
    } catch (error) {
        console.error(`Failed to reset password to ${email}:`, error.message);
    }
};
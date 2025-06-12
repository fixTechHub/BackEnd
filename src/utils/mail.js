const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Sends a verification email to the provided address with the tokenized link.
 * @param {string} email - The recipient's email address.
 * @param {string} token - The verification token.
 */
exports.sendVerificationEmail = async (email, token) => {
    const verificationLink = `${process.env.BACK_END_URL}/auth/verify_email?token=${token}`;

    const emailHTML = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Welcome!</h2>
            <p>Please verify your email by clicking the link below:</p>
            <a href="${verificationLink}" style="display: inline-block; padding: 10px 15px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
            <p>If you did not sign up for this account, you can safely ignore this email.</p>
        </div>
    `;

    const mailOptions = {
        from: `"FixHub" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Verify Your Email -FixHub",
        html: emailHTML,
        text: `Please verify your email by visiting this link: ${verificationLink}`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Verification email sent to ${email}`);
    } catch (error) {
        console.error(`Failed to send verification email to ${email}:`, error.message);
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
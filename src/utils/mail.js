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
const sendVerificationEmail = async (email, code) => {
    const mailOptions = {
        from: `"FixHub" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Xác thực email của bạn | FixTech',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Xin chào!</h2>
                <p>Cảm ơn bạn đã đăng ký tài khoản tại FixTech. Để hoàn tất quá trình đăng ký, vui lòng sử dụng mã xác thực sau:</p>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
                    <h1 style="color: #007bff; margin: 0; letter-spacing: 5px;">${code}</h1>
                </div>
                <p><strong>Lưu ý:</strong> Mã xác thực này sẽ hết hạn sau 5 phút.</p>
                <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này hoặc liên hệ với chúng tôi nếu bạn có bất kỳ thắc mắc nào.</p>
                <hr style="border: 1px solid #eee; margin: 20px 0;">
                <p style="color: #666; font-size: 12px;">Email này được gửi tự động từ hệ thống FixTech. Vui lòng không trả lời email này.</p>
                <p style="color: #666; font-size: 12px;">© 2024 FixTech. Tất cả các quyền được bảo lưu.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Verification email sent successfully');
    } catch (error) {
        console.error('Error sending verification email:', error);
        throw new Error('Không thể gửi email xác thực');
    }
};

const sendPasswordResetEmail = async (email, resetToken) => {
    const resetLink = `${process.env.FRONT_END_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
        from: `"FixHub" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Yêu cầu đặt lại mật khẩu | FixTech',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Xin chào!</h2>
                <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại FixTech.</p>
                <p>Để đặt lại mật khẩu, vui lòng nhấn vào nút bên dưới:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" 
                       style="background-color: #007bff; 
                              color: white; 
                              padding: 12px 25px; 
                              text-decoration: none; 
                              border-radius: 5px;
                              display: inline-block;
                              font-weight: bold;">
                        Đặt lại mật khẩu
                    </a>
                </div>
                
                <p><strong>Lưu ý:</strong></p>
                <ul style="color: #666;">
                    <li>Link đặt lại mật khẩu này sẽ hết hạn sau 5 phút</li>
                    <li>Nếu nút không hoạt động, bạn có thể copy và dán đường link sau vào trình duyệt:</li>
                </ul>
                
                <p style="background-color: #f8f9fa; 
                          padding: 15px; 
                          border-radius: 5px; 
                          word-break: break-all;
                          font-size: 14px;
                          color: #666;">
                    ${resetLink}
                </p>

                <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này và đảm bảo rằng bạn vẫn có thể đăng nhập vào tài khoản của mình.</p>
                
                <p>Nếu bạn cần hỗ trợ thêm, đừng ngần ngại liên hệ với chúng tôi.</p>

                <hr style="border: 1px solid #eee; margin: 20px 0;">
                
                <div style="color: #666; font-size: 12px;">
                    <p>Email này được gửi tự động từ hệ thống FixTech. Vui lòng không trả lời email này.</p>
                    <p>Vì lý do bảo mật, vui lòng không chia sẻ email này với bất kỳ ai.</p>
                    <p>© 2024 FixTech. Tất cả các quyền được bảo lưu.</p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Password reset email sent successfully');
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw new Error('Không thể gửi email đặt lại mật khẩu');
    }
};

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail
};
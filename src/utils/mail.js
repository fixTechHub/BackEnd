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
    } catch (error) {
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
    } catch (error) {
        throw new Error('Không thể gửi email đặt lại mật khẩu');
    }
};

/**
 * Sends a deactivation verification email to the provided address with a verification code.
 * @param {string} email - The recipient's email address.
 * @param {string} code - The verification code.
 * @param {string} subject - The email subject (optional).
 */
const sendDeactivateVerificationEmail = async (email, code, subject = 'Xác thực vô hiệu hóa tài khoản | FixTech') => {
    const mailOptions = {
        from: `"FixHub" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: subject,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Xin chào!</h2>
                <p>Chúng tôi nhận được yêu cầu vô hiệu hóa tài khoản của bạn tại FixTech.</p>
                <p>Để xác nhận việc vô hiệu hóa tài khoản, vui lòng sử dụng mã xác thực sau:</p>
                
                <div style="background-color: #fff3cd; 
                          border: 1px solid #ffeaa7; 
                          padding: 20px; 
                          border-radius: 8px; 
                          margin: 25px 0; 
                          text-align: center;">
                    <h1 style="color: #856404; 
                               margin: 0; 
                               letter-spacing: 8px; 
                               font-size: 32px; 
                               font-weight: bold;">${code}</h1>
                </div>
                
                <div style="background-color: #f8f9fa; 
                          border-left: 4px solid #dc3545; 
                          padding: 15px; 
                          margin: 20px 0;">
                    <p style="margin: 0; color: #721c24;">
                        <strong>⚠️ Cảnh báo:</strong> Việc vô hiệu hóa tài khoản sẽ tạm thời khóa tài khoản của bạn. 
                        Bạn có thể kích hoạt lại bất cứ lúc nào bằng cách đăng nhập.
                    </p>
                </div>
                
                <p><strong>Lưu ý quan trọng:</strong></p>
                <ul style="color: #666;">
                    <li>Mã xác thực này sẽ hết hạn sau 5 phút</li>
                    <li>Chỉ sử dụng mã này nếu bạn thực sự muốn vô hiệu hóa tài khoản</li>
                    <li>Tài khoản vô hiệu hóa vẫn có thể được kích hoạt lại</li>
                </ul>
                
                <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này và đảm bảo rằng tài khoản của bạn vẫn an toàn.</p>
                
                <p>Nếu bạn cần hỗ trợ hoặc có thắc mắc, đừng ngần ngại liên hệ với chúng tôi.</p>

                <hr style="border: 1px solid #eee; margin: 20px 0;">
                
                <div style="color: #666; font-size: 12px;">
                    <p>Email này được gửi tự động từ hệ thống FixTech. Vui lòng không trả lời email này.</p>
                    <p>Vì lý do bảo mật, vui lòng không chia sẻ mã xác thực này với bất kỳ ai.</p>
                    <p>© 2024 FixTech. Tất cả các quyền được bảo lưu.</p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        throw new Error('Không thể gửi email xác thực vô hiệu hóa tài khoản');
    }
};

/**
 * Sends a delete account verification email to the provided address with a verification code.
 * @param {string} email - The recipient's email address.
 * @param {string} code - The verification code.
 * @param {string} subject - The email subject (optional).
 */
const sendDeleteVerificationEmail = async (email, code, subject = 'Xác thực xóa tài khoản | FixTech') => {
    const mailOptions = {
        from: `"FixHub" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: subject,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Xin chào!</h2>
                <p>Chúng tôi nhận được yêu cầu <strong>XÓA VĨNH VIỄN</strong> tài khoản của bạn tại FixTech.</p>
                
                <div style="background-color: #f8d7da; 
                          border: 1px solid #f5c6cb; 
                          padding: 20px; 
                          border-radius: 8px; 
                          margin: 25px 0;">
                    <h3 style="color: #721c24; margin: 0 0 15px 0;">🚨 CẢNH BÁO QUAN TRỌNG</h3>
                    <p style="color: #721c24; margin: 0;">
                        <strong>Việc xóa tài khoản là KHÔNG THỂ HOÀN TÁC!</strong><br>
                        Tất cả dữ liệu của bạn sẽ bị xóa vĩnh viễn và không thể khôi phục.
                    </p>
                </div>
                
                <p>Để xác nhận việc xóa tài khoản, vui lòng sử dụng mã xác thực sau:</p>
                
                <div style="background-color: #dc3545; 
                          color: white;
                          padding: 25px; 
                          border-radius: 8px; 
                          margin: 25px 0; 
                          text-align: center;">
                    <h1 style="color: white; 
                               margin: 0; 
                               letter-spacing: 8px; 
                               font-size: 32px; 
                               font-weight: bold;">${code}</h1>
                </div>
                
                <div style="background-color: #fff3cd; 
                          border: 1px solid #ffeaa7; 
                          padding: 15px; 
                          margin: 20px 0;">
                    <p style="margin: 0; color: #856404;">
                        <strong>📋 Dữ liệu sẽ bị xóa:</strong>
                    </p>
                    <ul style="color: #856404; margin: 10px 0 0 20px;">
                        <li>Thông tin cá nhân</li>
                        <li>Lịch sử đặt dịch vụ</li>
                        <li>Đánh giá và phản hồi</li>
                        <li>Tất cả dữ liệu liên quan khác</li>
                    </ul>
                </div>
                
                <p><strong>Lưu ý quan trọng:</strong></p>
                <ul style="color: #666;">
                    <li>Mã xác thực này sẽ hết hạn sau 5 phút</li>
                    <li>Chỉ sử dụng mã này nếu bạn thực sự muốn xóa vĩnh viễn tài khoản</li>
                    <li>Việc xóa tài khoản là KHÔNG THỂ HOÀN TÁC</li>
                    <li>Nếu bạn chỉ muốn tạm thời khóa tài khoản, hãy sử dụng tính năng "Vô hiệu hóa tài khoản" thay thế</li>
                </ul>
                
                <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này và đảm bảo rằng tài khoản của bạn vẫn an toàn.</p>
                
                <p>Nếu bạn cần hỗ trợ hoặc có thắc mắc, đừng ngần ngại liên hệ với chúng tôi.</p>

                <hr style="border: 1px solid #eee; margin: 20px 0;">
                
                <div style="color: #666; font-size: 12px;">
                    <p>Email này được gửi tự động từ hệ thống FixTech. Vui lòng không trả lời email này.</p>
                    <p>Vì lý do bảo mật, vui lòng không chia sẻ mã xác thực này với bất kỳ ai.</p>
                    <p>© 2024 FixTech. Tất cả các quyền được bảo lưu.</p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        throw new Error('Không thể gửi email xác thực xóa tài khoản');
    }
};

/**
 * Sends a deletion reminder email to the user about their pending account deletion.
 * @param {string} email - The recipient's email address.
 * @param {number} daysLeft - Number of days left before permanent deletion.
 * @param {string} subject - The email subject (optional).
 */
const sendDeletionReminderEmail = async (email, daysLeft, subject = 'Nhắc nhở: Tài khoản sẽ bị xóa vĩnh viễn | FixTech') => {
    const mailOptions = {
        from: `"FixHub" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: subject,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Xin chào!</h2>
                <p>Tài khoản của bạn đã được đánh dấu để xóa vĩnh viễn.</p>
                
                <div style="background-color: #f8d7da; 
                          border: 1px solid #f5c6cb; 
                          padding: 20px; 
                          border-radius: 8px; 
                          margin: 25px 0;">
                    <h3 style="color: #721c24; margin: 0 0 15px 0;">⏰ THỜI GIAN CÒN LẠI</h3>
                    <p style="color: #721c24; margin: 0; font-size: 1.2rem; font-weight: bold;">
                        Còn ${daysLeft} ngày trước khi tài khoản bị xóa vĩnh viễn
                    </p>
                </div>
                
                <div style="background-color: #d1ecf1; 
                          border: 1px solid #bee5eb; 
                          padding: 15px; 
                          border-radius: 8px; 
                          margin: 20px 0;">
                    <h4 style="color: #0c5460; margin: 0 0 10px 0;">🔄 Cách khôi phục tài khoản:</h4>
                    <p style="color: #0c5460; margin: 0;">
                        Chỉ cần <strong>đăng nhập lại</strong> vào tài khoản trong thời gian này, 
                        việc xóa tài khoản sẽ được hủy bỏ tự động.
                    </p>
                </div>
                
                <div style="background-color: #fff3cd; 
                          border: 1px solid #ffeaa7; 
                          padding: 15px; 
                          margin: 20px 0;">
                    <p style="margin: 0; color: #856404;">
                        <strong>📋 Dữ liệu sẽ bị xóa vĩnh viễn:</strong>
                    </p>
                    <ul style="color: #856404; margin: 10px 0 0 20px;">
                        <li>Thông tin cá nhân</li>
                        <li>Lịch sử đặt dịch vụ</li>
                        <li>Đánh giá và phản hồi</li>
                        <li>Tất cả dữ liệu liên quan khác</li>
                    </ul>
                </div>
                
                <p><strong>Lưu ý quan trọng:</strong></p>
                <ul style="color: #666;">
                    <li>Sau ${daysLeft} ngày, tài khoản sẽ bị xóa vĩnh viễn và không thể khôi phục</li>
                    <li>Chỉ cần đăng nhập lại để hủy bỏ việc xóa tài khoản</li>
                    <li>Nếu bạn không muốn xóa tài khoản, hãy đăng nhập ngay bây giờ</li>
                </ul>
                
                <p>Nếu bạn cần hỗ trợ hoặc có thắc mắc, đừng ngần ngại liên hệ với chúng tôi.</p>

                <hr style="border: 1px solid #eee; margin: 20px 0;">
                
                <div style="color: #666; font-size: 12px;">
                    <p>Email này được gửi tự động từ hệ thống FixTech. Vui lòng không trả lời email này.</p>
                    <p>© 2024 FixTech. Tất cả các quyền được bảo lưu.</p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        throw new Error('Không thể gửi email nhắc nhở xóa tài khoản');
    }
};


const sendWarningEmail = async (email, warningContent, subject = 'CẢNH BÁO TÀI KHOẢN | FixTech') => {
    const mailOptions = {
        from: `"FixHub" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: subject,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #dc3545; border-radius: 8px; padding: 20px;">
                <h2 style="color: #dc3545; text-align: center; font-weight: bold;">⚠️ CẢNH BÁO TỪ FIXTECH ⚠️</h2>
                <p style="color: #333; font-size: 16px;">Chúng tôi phát hiện hành vi vi phạm liên quan đến tài khoản của bạn tại FixTech.</p>
                <p style="font-weight: bold; color: #dc3545;">Chi tiết cảnh báo:</p>
                <div style="background-color: #f8d7da; 
                          border: 1px solid #dc3545; 
                          padding: 20px; 
                          border-radius: 8px; 
                          margin: 20px 0; 
                          text-align: center;">
                    <p style="color: #721c24; margin: 0; font-size: 18px; font-weight: bold;">
                        ${warningContent}
                    </p>
                </div>
                
                <div style="background-color: #fff3cd; 
                          border-left: 4px solid #dc3545; 
                          padding: 15px; 
                          margin: 20px 0;">
                    <p style="margin: 0; color: #721c24; font-weight: bold;">
                        🚨 <strong>Hậu quả nếu tiếp tục vi phạm:</strong> Tài khoản của bạn có thể bị tạm khóa hoặc vô hiệu hóa vĩnh viễn.
                    </p>
                </div>
                
                <p style="font-weight: bold; color: #333;">Hành động cần thực hiện ngay:</p>
              
                
                <p style="color: #721c24;">Nếu bạn tin rằng đây là một nhầm lẫn, vui lòng liên hệ ngay để được hỗ trợ. Hành động kịp thời sẽ giúp tránh các biện pháp nghiêm ngặt hơn.</p>
                
                <p style="color: #333;">Trân trọng,</p>
                <p style="color: #333; font-weight: bold;">Đội ngũ FixTech</p>

                <hr style="border: 1px solid #dc3545; margin: 20px 0;">
                
                <div style="color: #666; font-size: 12px; text-align: center;">
                    <p>Email này được gửi tự động từ hệ thống FixTech. Vui lòng không trả lời email này.</p>
                    <p>Vì lý do bảo mật, không chia sẻ thông tin này với bất kỳ ai.</p>
                    <p>© 2025 FixTech. Tất cả các quyền được bảo lưu.</p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        throw new Error('Không thể gửi email cảnh báo tài khoản');
    }
};


module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendDeactivateVerificationEmail,
    sendDeleteVerificationEmail,
    sendDeletionReminderEmail,
    sendWarningEmail
};
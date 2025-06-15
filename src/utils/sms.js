const twilio = require('twilio');

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

exports.sendVerificationSMS = async (phone, otp) => {
    try {
        await client.messages.create({
            body: `Mã xác thực của bạn là: ${otp}. Mã này có hiệu lực trong 5 phút.`,
            to: phone,
            from: process.env.TWILIO_PHONE_NUMBER
        });
        console.log(`Verification SMS sent to ${phone}`);
    } catch (error) {
        console.error(`Failed to send verification SMS to ${phone}:`, error.message);
        throw error;
    }
}; 
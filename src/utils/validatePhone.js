module.exports = function validatePhone(phone) {
  return /^0[0-9]{9}$/.test(phone);  // Việt Nam 10 số bắt đầu bằng 0
};

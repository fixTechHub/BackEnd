const cron = require('node-cron');

const cleanupTask = () => {
  console.log('Running cleanup task');
  // xóa dữ liệu cũ, v.v...
};

cron.schedule('0 0 * * *', cleanupTask); // chạy mỗi ngày 0h

module.exports = cleanupTask;

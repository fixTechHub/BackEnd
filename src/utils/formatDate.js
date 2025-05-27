module.exports = function formatDate(date) {
  return new Date(date).toISOString().split('T')[0];
};

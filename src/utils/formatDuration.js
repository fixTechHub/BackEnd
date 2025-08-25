/**
 * Format duration in seconds to human readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) {
        return '0s';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    let result = '';

    if (hours > 0) {
        result += `${hours}h `;
    }

    if (minutes > 0) {
        result += `${minutes}m `;
    }

    if (remainingSeconds > 0 || result === '') {
        result += `${remainingSeconds}s`;
    }

    return result.trim();
};

/**
 * Format duration in seconds to short format (e.g., "2:30:45" or "45:30")
 * @param {number} seconds - Duration in seconds
 * @returns {string} Short formatted duration string
 */
const formatDurationShort = (seconds) => {
    if (!seconds || seconds <= 0) {
        return '0:00';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
};

/**
 * Calculate duration between two dates
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} Duration in seconds
 */
const calculateDuration = (startDate, endDate) => {
    if (!startDate || !endDate) {
        return 0;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationInMs = end.getTime() - start.getTime();
    
    return Math.floor(durationInMs / 1000);
};

const formatDurationMMSS = (seconds) => {
    if (!seconds || seconds <= 0) {
        return '00:00';
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

module.exports = {
    formatDuration,
    formatDurationShort,
    calculateDuration,
    formatDurationMMSS
}; 
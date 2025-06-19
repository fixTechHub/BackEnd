const validateContract = (data) => {
    const requiredFields = [
        'technicianId',
        'fullName',
        'email',
        'address',
        'idNumber',
        'effectiveDate',
        'content'
    ];

    for (const field of requiredFields) {
        if (!data[field]) {
            return `${field} is required`;
        }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
        return 'Invalid email format';
    }

    // Validate effective date
    const effectiveDate = new Date(data.effectiveDate);
    if (isNaN(effectiveDate.getTime())) {
        return 'Invalid effective date';
    }

    // Validate that effective date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (effectiveDate < today) {
        return 'Effective date cannot be in the past';
    }

    return null;
};

module.exports = {
    validateContract
}; 
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Booking = require('../models/Booking'); // Adjust path if needed

dotenv.config(); // Load .env

const bookingData = {
    bookingCode: 'BOOK123456',
    customerId: new mongoose.Types.ObjectId('68477c06b6efa9a3615217dd'),
    technicianId: new mongoose.Types.ObjectId('686172da3f79b68e4dbe5bbb'),
    serviceId: new mongoose.Types.ObjectId('686e57346e339ebfbc0bc41f'),
    location: {
        address: '123 Main St, Hanoi',
        geojson: {
            type: 'Point',
            coordinates: [105.8342, 21.0278]
        }
    },
    description: 'Fixing air conditioner',
    images: ['https://example.com/image1.jpg'],
    schedule: {
        startTime: new Date('2025-07-12T09:00:00Z'),
        expectedEndTime: new Date('2025-07-12T11:00:00Z')
    },
    isUrgent: true,
    quote: {
        status: 'PENDING',
        laborPrice: 150000,
        items: [
            {
                name: 'Coolant',
                price: 50000,
                quantity: 1,
                note: 'R-32 type'
            }
        ],
        totalAmount: 200000,
        warrantiesDuration: 60,
        justification: '',
        quotedAt: new Date()
    },
    discountCode: 'SUMMER2025',
    discountValue: 20000,
    technicianEarning: 160000,
    commissionAmount: 20000,
    holdingAmount: 10000,
    finalPrice: 180000,
    customerConfirmedDone: false,
    technicianConfirmedDone: false,
    status: 'PENDING',
    isChatAllowed: false,
    isVideoCallAllowed: false,
    warrantyExpiresAt: new Date('2025-09-10T00:00:00Z'),
    paymentStatus: 'PENDING'
};

async function seedBooking() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const existing = await Booking.findOne({ bookingCode: bookingData.bookingCode });
        if (!existing) {
            await Booking.create(bookingData);
            console.log(`Inserted booking: ${bookingData.bookingCode}`);
        } else {
            console.log(`Booking already exists: ${bookingData.bookingCode}`);
        }
    } catch (err) {
        console.error('Error inserting booking:', err.message);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

seedBooking();

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Technician = require('../models/Technician'); // Adjust path if needed

dotenv.config(); // Load .env

// Technician ID to update
const technicianId = new mongoose.Types.ObjectId('686172da3f79b68e4dbe5bbb');

// Update data with inspectionFee and laborTiers
const updateData = {
    rates: {
        inspectionFee: 100000,  // required
        laborTiers: {
            tier1: 200000,      // simple repairs
            tier2: 300000,      // medium repairs
            tier3: 500000       // complex repairs
        }
    },
    pricesLastUpdatedAt: new Date() // optional: track when prices were updated
};

async function updateTechnician() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const technician = await Technician.findById(technicianId);
        if (!technician) {
            console.log(`Technician not found: ${technicianId}`);
            return;
        }

        technician.rates = {
            ...technician.rates?.toObject(), // keep any other keys if they exist
            ...updateData.rates
        };
        technician.pricesLastUpdatedAt = updateData.pricesLastUpdatedAt;

        await technician.save();
        console.log(`✅ Updated Technician ${technicianId} with inspectionFee and laborTiers.`);
    } catch (err) {
        console.error('❌ Error updating technician:', err.message, err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

updateTechnician();

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Technician = require('../models/Technician'); // Adjust path if needed

dotenv.config(); // Load .env

async function updateAllTechnicians() {
    console.log('Starting migration to add debBalance to all technicians...');

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Start a MongoDB session for transaction
        const session = await mongoose.startSession();
        await session.withTransaction(async () => {
            // Update all technicians where debBalance is missing or null
            const result = await Technician.updateMany(
                {
                    $or: [
                        { debBalance: { $exists: false } },
                        { debBalance: null }
                    ]
                },
                {
                    $set: { debBalance: 0 }
                },
                { session }
            );

            console.log(`Updated ${result.modifiedCount} technicians with debBalance: 0`);
            console.log('All technicians updated successfully');
        });

        session.endSession();
    } catch (err) {
        console.error('❌ Error updating technicians:', err.message, err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the migration
updateAllTechnicians();
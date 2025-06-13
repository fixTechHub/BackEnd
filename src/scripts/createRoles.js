const mongoose = require('mongoose');
const Role = require('../models/Role');
require('dotenv').config();

const roles = ['ADMIN', 'CUSTOMER', 'TECHNICIAN'];

async function createRoles() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        for (const roleName of roles) {
            const existingRole = await Role.findOne({ name: roleName });
            if (!existingRole) {
                await Role.create({ name: roleName });
                console.log(`Created role: ${roleName}`);
            } else {
                console.log(`Role already exists: ${roleName}`);
            }
        }

        console.log('All roles created successfully');
    } catch (error) {
        console.error('Error creating roles:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

createRoles(); 
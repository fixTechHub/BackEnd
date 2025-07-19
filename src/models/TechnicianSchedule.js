const mongoose = require('mongoose');

const technicianScheduleSchema = new mongoose.Schema({
    technicianId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Technician',
        required: true
    },
    scheduleType: {
        type: String,
        enum: ['AVAILABLE', 'UNAVAILABLE'],
        required: true
    },
    scheduleType: {
        type: String,
        enum: ['BOOKING','WARRANTY'],
        default: 'BOOKING'
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        required: false
    },
    note: String
}, {
    timestamps: true
});

technicianScheduleSchema.index({ technicianId: 1 });
technicianScheduleSchema.index({ scheduleType: 1 });
technicianScheduleSchema.index({ technicianId: 1, startTime: 1 });
technicianScheduleSchema.index({ technicianId: 1, scheduleType: 1 });
technicianScheduleSchema.index({ technicianId: 1, startTime: 1, endTime: 1 });

module.exports = mongoose.model('TechnicianSchedule', technicianScheduleSchema);

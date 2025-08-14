const { userSocketMap } = require('../sockets/socket');
const User = require('../models/User');
const videoCallService = require('../services/videoCallService');
const { formatDuration, formatDurationMMSS } = require('../utils/formatDuration');

const getOnlineUsers = async (req, res) => {
    try {
        const onlineUserIds = Array.from(userSocketMap.keys());
        const onlineUsers = await User.find({
            '_id': { $in: onlineUserIds },
            'role': { $in: ['TECHNICIAN', 'CUSTOMER'] }
        }).select('firstName lastName role');

        // Filter out the current user from the list
        const filteredUsers = onlineUsers.filter(user => user._id.toString() !== req.user._id.toString());

        res.status(200).json(filteredUsers);
    } catch (error) {
        console.error('Error fetching online users:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getVideoCallStatus = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const videoCall = await videoCallService.getVideoCallBySessionId(sessionId);
        if (!videoCall) {
            return res.status(404).json({ message: 'Video call not found' });
        }
        
        // Add formatted duration to response
        const response = videoCall.toObject();
        response.formattedDuration = formatDuration(videoCall.duration);
        response.formattedDurationMMSS = formatDurationMMSS(videoCall.duration);
        
        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching video call status:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updateVideoCallStatus = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { status } = req.body;
        const endedAt = status === 'ENDED' || status === 'DECLINED' ? new Date() : undefined;
        const updated = await videoCallService.updateVideoCallStatus(sessionId, status, endedAt);
        if (!updated) {
            return res.status(404).json({ message: 'Video call not found' });
        }
        
        // If call ended, calculate duration
        if (status === 'ENDED' || status === 'DECLINED') {
            const videoCallWithDuration = await videoCallService.calculateAndUpdateDuration(sessionId);
            const response = videoCallWithDuration.toObject();
            response.formattedDuration = formatDuration(videoCallWithDuration.duration);
            response.formattedDurationMMSS = formatDurationMMSS(videoCallWithDuration.duration);
            return res.status(200).json(response);
        }
        
        res.status(200).json(updated);
    } catch (error) {
        console.error('Error updating video call status:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// New controller functions for handling video call events
const initiateCall = async (req, res) => {
    try {
        const { bookingId, to, signalData,warrantyId, name } = req.body;
        const from = req.user.userId;
        
        const videoCall = await videoCallService.initiateVideoCall({
            bookingId,
            from,
            to,
            signalData,
            name,
            warrantyId
        });
        
        res.status(201).json(videoCall);
    } catch (error) {
        console.error('Error initiating video call:', error);
        res.status(500).json({ message: 'Failed to initiate call', error: error.message });
    }
};

const answerCall = async (req, res) => {
    try {
        const { sessionId, signal, to } = req.body;
        
        const videoCall = await videoCallService.answerVideoCall({
            sessionId,
            signal,
            to
        });
        
        res.status(200).json(videoCall);
    } catch (error) {
        console.error('Error answering video call:', error);
        res.status(500).json({ message: 'Failed to answer call', error: error.message });
    }
};

const endCall = async (req, res) => {
    try {
        const { sessionId, to } = req.body;
        
        const videoCall = await videoCallService.endVideoCall({
            sessionId,
            to
        });
        
        // Add formatted duration to response
        const response = videoCall.toObject();
        response.formattedDuration = formatDuration(videoCall.duration);
        response.formattedDurationMMSS = formatDurationMMSS(videoCall.duration);
        
        res.status(200).json(response);
    } catch (error) {
        console.error('Error ending video call:', error);
        res.status(500).json({ message: 'Failed to end call', error: error.message });
    }
};

const declineCall = async (req, res) => {
    try {
        const { sessionId, to } = req.body;
        const from = req.user.userId;
        
        const videoCall = await videoCallService.declineVideoCall({
            sessionId,
            to,
            from
        });
        
        // Add formatted duration to response
        const response = videoCall.toObject();
        response.formattedDuration = formatDuration(videoCall.duration);
        response.formattedDurationMMSS = formatDurationMMSS(videoCall.duration);
        
        res.status(200).json(response);
    } catch (error) {
        console.error('Error declining video call:', error);
        res.status(500).json({ message: 'Failed to decline call', error: error.message });
    }
};

// New endpoint to get call history for a booking
const getCallHistory = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const VideoCall = require('../models/VideoCall');
        
        const calls = await VideoCall.find({ 
            bookingId,
            status: { $in: ['ENDED', 'DECLINED'] }
        }).sort({ endedAt: -1 });
        
        // Add formatted duration to each call
        const callsWithFormattedDuration = calls.map(call => {
            const callObj = call.toObject();
            callObj.formattedDuration = formatDuration(call.duration);
            callObj.formattedDurationMMSS = formatDurationMMSS(call.duration);
            return callObj;
        });
        
        res.status(200).json(callsWithFormattedDuration);
    } catch (error) {
        console.error('Error fetching call history:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getOnlineUsers,
    getVideoCallStatus,
    updateVideoCallStatus,
    initiateCall,
    answerCall,
    endCall,
    declineCall,
    getCallHistory
};

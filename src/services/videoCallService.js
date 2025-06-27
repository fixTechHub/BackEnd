const VideoCall = require('../models/VideoCall');
const { getIo } = require('../sockets/socketManager');

/**
 * Create a new video call record
 */
const createVideoCall = async ({ bookingId, sessionId, startedAt }) => {
    const videoCall = new VideoCall({
        bookingId,
        sessionId,
        startedAt,
        status: 'INITIATED'
    });
    return await videoCall.save();
};

/**
 * Update the status and timestamps of a video call
 */
const updateVideoCallStatus = async (sessionId, status, endedAt = null) => {
    const update = { status };
    if (endedAt) update.endedAt = endedAt;
    return await VideoCall.findOneAndUpdate(
        { sessionId },
        { $set: update },
        { new: true }
    );
};

/**
 * Get a video call by sessionId
 */
const getVideoCallBySessionId = async (sessionId) => {
    return await VideoCall.findOne({ sessionId });
};

/**
 * Calculate and update call duration
 */
const calculateAndUpdateDuration = async (sessionId) => {
    const videoCall = await VideoCall.findOne({ sessionId });
    if (!videoCall || !videoCall.startedAt || !videoCall.endedAt) {
        return videoCall;
    }

    const durationInSeconds = Math.floor((videoCall.endedAt - videoCall.startedAt) / 1000);
    
    return await VideoCall.findOneAndUpdate(
        { sessionId },
        { $set: { duration: durationInSeconds } },
        { new: true }
    );
};

/**
 * Handle video call initiation - save to database and emit socket events
 */
const initiateVideoCall = async (callData) => {
    const io = getIo();
    const { bookingId, from, to, signalData, name } = callData;
    
    // Generate a unique session ID for this call
    const sessionId = `call_${Date.now()}_${from}_${to}`;
    
    // Create video call record in database
    const videoCall = await createVideoCall({
        bookingId,
        sessionId,
        startedAt: new Date()
    });

    // Emit socket events
    io.to(`user:${to}`).emit("callUser", { 
        signal: signalData, 
        from, 
        name,
        sessionId: videoCall.sessionId 
    });

    return videoCall;
};

/**
 * Handle video call answer - update database and emit socket events
 */
const answerVideoCall = async (answerData) => {
    const io = getIo();
    const { sessionId, signal, to } = answerData;
    
    // Update video call status to ONGOING
    const videoCall = await updateVideoCallStatus(sessionId, 'ONGOING');
    
    // Emit socket events
    io.to(`user:${to}`).emit("callAccepted", signal);
    
    return videoCall;
};

/**
 * Handle video call end - update database and emit socket events
 */
const endVideoCall = async (endData) => {
    const io = getIo();
    const { sessionId, to } = endData;
    
    const endedAt = new Date();
    
    // Update video call status to ENDED
    const videoCall = await updateVideoCallStatus(sessionId, 'ENDED', endedAt);
    
    // Calculate and update duration
    const updatedVideoCall = await calculateAndUpdateDuration(sessionId);
    
    // Emit socket events
    if (to) {
        io.to(`user:${to}`).emit("callEnded");
    }
    
    return updatedVideoCall;
};

/**
 * Handle video call decline - update database and emit socket events
 */
const declineVideoCall = async (declineData) => {
    const io = getIo();
    const { sessionId, to, from } = declineData;
    
    const endedAt = new Date();
    
    // Update video call status to DECLINED
    const videoCall = await updateVideoCallStatus(sessionId, 'DECLINED', endedAt);
    
    // Calculate and update duration
    const updatedVideoCall = await calculateAndUpdateDuration(sessionId);
    
    // Emit socket events
    if (to) {
        io.to(`user:${to}`).emit("callDeclined", { from });
    }
    
    return updatedVideoCall;
};

module.exports = {
    createVideoCall,
    updateVideoCallStatus,
    getVideoCallBySessionId,
    calculateAndUpdateDuration,
    initiateVideoCall,
    answerVideoCall,
    endVideoCall,
    declineVideoCall
};
const { getIo } = require('../sockets/socketManager');
const { userSocketMap } = require('../sockets/socket');

// Store active video calls
const activeCalls = new Map(); // callId -> { caller, callee, status, startTime }

const videoCallController = {
  // Initiate a video call
  initiateCall: async (req, res) => {
    try {
      const { callerId, calleeId, bookingId, callerName, calleeName } = req.body;
      
      if (!callerId || !calleeId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Caller and callee IDs are required' 
        });
      }

      // Check if callee is online
      const calleeSocketId = userSocketMap.get(calleeId);
      if (!calleeSocketId) {
        return res.status(404).json({ 
          success: false, 
          message: 'User is not online' 
        });
      }

      // Generate unique call ID
      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store call information
      activeCalls.set(callId, {
        callerId,
        callerName,
        calleeId,
        calleeName,
        bookingId,
        status: 'ringing',
        startTime: new Date(),
        endTime: null
      });

      // Emit call request to callee
      const io = getIo();
      io.to(calleeSocketId).emit('incoming_call', {
        callId,
        callerId,
        callerName,
        calleeId,
        bookingId,
        timestamp: new Date()
      });

      res.status(200).json({
        success: true,
        message: 'Call initiated successfully',
        callId
      });

    } catch (error) {
      console.error('Error initiating call:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate call',
        error: error.message
      });
    }
  },

  // Accept a video call
  acceptCall: async (req, res) => {
    try {
      const { callId, calleeId } = req.body;
      
      const call = activeCalls.get(callId);
      if (!call) {
        return res.status(404).json({
          success: false,
          message: 'Call not found'
        });
      }

      if (call.calleeId !== calleeId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to accept this call'
        });
      }

      if (call.status !== 'ringing') {
        return res.status(400).json({
          success: false,
          message: 'Call is not in ringing state'
        });
      }

      // Update call status
      call.status = 'active';
      activeCalls.set(callId, call);

      // Notify caller that call was accepted
      const callerSocketId = userSocketMap.get(call.callerId);
      const io = getIo();
      
      if (callerSocketId) {
        io.to(callerSocketId).emit('call_accepted', {
          callId,
          ...call
        });
      }

      res.status(200).json({
        success: true,
        message: 'Call accepted successfully'
      });

    } catch (error) {
      console.error('Error accepting call:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to accept call',
        error: error.message
      });
    }
  },

  // Reject a video call
  rejectCall: async (req, res) => {
    try {
      const { callId, calleeId, reason } = req.body;
      
      const call = activeCalls.get(callId);
      if (!call) {
        return res.status(404).json({
          success: false,
          message: 'Call not found'
        });
      }

      if (call.calleeId !== calleeId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to reject this call'
        });
      }

      // Update call status
      call.status = 'rejected';
      call.endTime = new Date();
      activeCalls.set(callId, call);

      // Notify caller that call was rejected
      const callerSocketId = userSocketMap.get(call.callerId);
      const io = getIo();
      
      if (callerSocketId) {
        io.to(callerSocketId).emit('call_rejected', {
          callId,
          calleeId,
          reason: reason || 'Call rejected'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Call rejected successfully'
      });

    } catch (error) {
      console.error('Error rejecting call:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject call',
        error: error.message
      });
    }
  },

  // End a video call
  endCall: async (req, res) => {
    try {
      const { callId, userId } = req.body;
      
      const call = activeCalls.get(callId);
      if (!call) {
        return res.status(404).json({
          success: false,
          message: 'Call not found'
        });
      }

      if (call.callerId !== userId && call.calleeId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to end this call'
        });
      }

      // Update call status
      call.status = 'ended';
      call.endTime = new Date();
      activeCalls.set(callId, call);

      // Notify both parties that call ended
      const io = getIo();
      const callerSocketId = userSocketMap.get(call.callerId);
      const calleeSocketId = userSocketMap.get(call.calleeId);

      if (callerSocketId) {
        io.to(callerSocketId).emit('call_ended', {
          callId,
          endedBy: userId
        });
      }

      if (calleeSocketId) {
        io.to(calleeSocketId).emit('call_ended', {
          callId,
          endedBy: userId
        });
      }

      res.status(200).json({
        success: true,
        message: 'Call ended successfully'
      });

    } catch (error) {
      console.error('Error ending call:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to end call',
        error: error.message
      });
    }
  },

  // Get call history for a user
  getCallHistory: async (req, res) => {
    try {
      const { userId } = req.params;
      
      // In a real application, you would store call history in database
      // For now, we'll return active calls that involve this user
      const userCalls = Array.from(activeCalls.entries())
        .filter(([callId, call]) => 
          call.callerId === userId || call.calleeId === userId
        )
        .map(([callId, call]) => ({
          callId,
          ...call,
          isCaller: call.callerId === userId
        }));

      res.status(200).json({
        success: true,
        calls: userCalls
      });

    } catch (error) {
      console.error('Error getting call history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get call history',
        error: error.message
      });
    }
  },

  // Get active call for a user
  getActiveCall: async (req, res) => {
    try {
      const { userId } = req.params;
      
      const activeCall = Array.from(activeCalls.entries())
        .find(([callId, call]) => 
          (call.callerId === userId || call.calleeId === userId) && 
          call.status === 'active'
        );

      if (!activeCall) {
        return res.status(404).json({
          success: false,
          message: 'No active call found'
        });
      }

      const [callId, call] = activeCall;
      res.status(200).json({
        success: true,
        call: {
          callId,
          ...call,
          isCaller: call.callerId === userId
        }
      });

    } catch (error) {
      console.error('Error getting active call:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get active call',
        error: error.message
      });
    }
  }
};

module.exports = videoCallController;

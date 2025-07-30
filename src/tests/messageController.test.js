const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const messageController = require('../controllers/messageController');
const messageService = require('../services/messageService');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { getIo } = require('../sockets/socketManager');
const notificationService = require('../services/notificationService');

jest.mock('../services/messageService');
jest.mock('../services/notificationService');
jest.mock('../middlewares/authMiddleware');
jest.mock('../sockets/socketManager');

const app = express();
app.use(express.json());
app.use('/api/messages', require('../routes/messageRoutes'));

describe('Message Controller', () => {
  const bookingId = new mongoose.Types.ObjectId('507f191e810c19729de860ea');
  const bookingWarrantyId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  const fromUserId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');
  const toUserId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439013');

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock authenticateToken to provide an existing user
    authenticateToken.mockImplementation(() => (req, res, next) => {
      req.user = {
        userId: fromUserId // Matches fromUser in message
      };
      next();
    });
    // Mock getIo
    getIo.mockReturnValue({
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    });
  });

  describe('GET /api/messages', () => {
    it('should get messages by bookingId successfully', async () => {
      const messageId = new mongoose.Types.ObjectId(); // Unique ID for this test
      const mockMessages = [
        {
          _id: messageId,
          bookingId: bookingId,
          fromUser: fromUserId,
          toUser: toUserId,
          content: 'Test message',
          type: 'GENERAL'
        }
      ];
      messageService.getMessagesByBookingOrWarrantyId.mockResolvedValue(mockMessages);

      const response = await request(app)
        .get('/api/messages')
        .query({ bookingId: bookingId.toString() });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.arrayContaining([
        expect.objectContaining({
          _id: messageId.toString(),
          bookingId: bookingId.toString(),
          fromUser: fromUserId.toString(),
          toUser: toUserId.toString(),
          content: 'Test message'
        })
      ]));
      expect(messageService.getMessagesByBookingOrWarrantyId).toHaveBeenCalledWith(
        bookingId.toString(),
        undefined
      );
    });

    it('should get messages by bookingWarrantyId successfully', async () => {
      const messageId = new mongoose.Types.ObjectId(); // Unique ID for this test
      const mockMessages = [
        {
          _id: messageId,
          bookingWarrantyId: bookingWarrantyId,
          fromUser: fromUserId,
          toUser: toUserId,
          content: 'Test warranty message',
          type: 'GENERAL'
        }
      ];
      messageService.getMessagesByBookingOrWarrantyId.mockResolvedValue(mockMessages);

      const response = await request(app)
        .get('/api/messages')
        .query({ bookingWarrantyId: bookingWarrantyId.toString() });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.arrayContaining([
        expect.objectContaining({
          _id: messageId.toString(),
          bookingWarrantyId: bookingWarrantyId.toString(),
          fromUser: fromUserId.toString(),
          toUser: toUserId.toString(),
          content: 'Test warranty message'
        })
      ]));
      expect(messageService.getMessagesByBookingOrWarrantyId).toHaveBeenCalledWith(
        undefined,
        bookingWarrantyId.toString()
      );
    });

    it('should return 500 if neither bookingId nor bookingWarrantyId is provided', async () => {
      messageService.getMessagesByBookingOrWarrantyId.mockRejectedValue(
        new Error('At least bookingId or bookingWarrantyId is required')
      );

      const response = await request(app)
        .get('/api/messages')
        .query({});

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: 'Lỗi khi lấy tin nhắn:',
        error: 'At least bookingId or bookingWarrantyId is required'
      });
      expect(messageService.getMessagesByBookingOrWarrantyId).toHaveBeenCalledWith(
        undefined,
        undefined
      );
    });

    it('should return 500 if bookingId is invalid', async () => {
      messageService.getMessagesByBookingOrWarrantyId.mockRejectedValue(
        new Error('Invalid ObjectId')
      );

      const response = await request(app)
        .get('/api/messages')
        .query({ bookingId: 'invalid-id' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: 'Lỗi khi lấy tin nhắn:',
        error: 'Invalid ObjectId'
      });
    });
  });

  describe('POST /api/messages', () => {
    it('should send a text message successfully', async () => {
      const messageId = new mongoose.Types.ObjectId(); // Unique ID for this test
      const mockMessage = {
        _id: messageId,
        bookingId: bookingId,
        fromUser: fromUserId,
        toUser: toUserId,
        content: 'Test message',
        type: 'GENERAL'
      };
      const mockNotification = {
        userId: toUserId,
        title: 'Tin nhắn mới từ',
        content: 'Test message',
        type: 'MESSAGE',
        referenceId: messageId,
        referenceModel: 'Message'
      };
      messageService.sendMessage.mockResolvedValue(mockMessage);
      notificationService.createNotification.mockResolvedValue(mockNotification);

      const response = await request(app)
        .post('/api/messages')
        .send({
          bookingId: bookingId.toString(),
          toUser: toUserId.toString(),
          content: 'Test message',
          type: 'GENERAL'
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(expect.objectContaining({
        _id: messageId.toString(),
        bookingId: bookingId.toString(),
        fromUser: fromUserId.toString(),
        toUser: toUserId.toString(),
        content: 'Test message'
      }));
      expect(messageService.sendMessage).toHaveBeenCalledWith({
        bookingId: bookingId.toString(),
        fromUser: fromUserId,
        toUser: toUserId.toString(),
        content: 'Test message',
        type: 'GENERAL'
      });
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: toUserId,
          title: 'Tin nhắn mới từ',
          content: 'Test message',
          type: 'MESSAGE',
          referenceId: messageId,
          referenceModel: 'Message'
        })
      );
      expect(getIo().to).toHaveBeenCalledWith(`user:${toUserId}`);
      expect(getIo().to().emit).toHaveBeenCalledWith('receiveNotification', mockNotification);
      expect(getIo().to).toHaveBeenCalledWith(`user:${fromUserId}`);
      expect(getIo().to().emit).toHaveBeenCalledWith('receiveMessage', mockMessage);
      expect(getIo().to).toHaveBeenCalledWith(`user:${toUserId}`);
      expect(getIo().to().emit).toHaveBeenCalledWith('receiveMessage', mockMessage);
    });

    it('should send a file message successfully', async () => {
      const messageId = new mongoose.Types.ObjectId(); // Unique ID for this test
      const mockMessage = {
        _id: messageId,
        bookingId: bookingId,
        fromUser: fromUserId,
        toUser: toUserId,
        content: 'https://s3.amazonaws.com/messages/test.jpg',
        type: 'GENERAL'
      };
      const mockNotification = {
        userId: toUserId,
        title: 'Tin nhắn mới từ',
        content: 'https://s3.amazonaws.com/messages/test.jpg',
        type: 'MESSAGE',
        referenceId: messageId,
        referenceModel: 'Message'
      };
      messageService.sendMessage.mockResolvedValue(mockMessage);
      notificationService.createNotification.mockResolvedValue(mockNotification);

      const response = await request(app)
        .post('/api/messages')
        .send({
          bookingId: bookingId.toString(),
          toUser: toUserId.toString(),
          fileBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          originalName: 'test.jpg',
          mimetype: 'image/jpeg',
          type: 'GENERAL'
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(expect.objectContaining({
        _id: messageId.toString(),
        bookingId: bookingId.toString(),
        fromUser: fromUserId.toString(),
        toUser: toUserId.toString(),
        content: 'https://s3.amazonaws.com/messages/test.jpg'
      }));
      expect(messageService.sendMessage).toHaveBeenCalledWith({
        bookingId: bookingId.toString(),
        fromUser: fromUserId,
        toUser: toUserId.toString(),
        fileBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        originalName: 'test.jpg',
        mimetype: 'image/jpeg',
        type: 'GENERAL'
      });
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: toUserId,
          title: 'Tin nhắn mới từ',
          content: 'https://s3.amazonaws.com/messages/test.jpg',
          type: 'MESSAGE',
          referenceId: messageId,
          referenceModel: 'Message'
        })
      );
      expect(getIo().to).toHaveBeenCalledWith(`user:${toUserId}`);
      expect(getIo().to().emit).toHaveBeenCalledWith('receiveNotification', mockNotification);
      expect(getIo().to).toHaveBeenCalledWith(`user:${fromUserId}`);
      expect(getIo().to().emit).toHaveBeenCalledWith('receiveMessage', mockMessage);
      expect(getIo().to).toHaveBeenCalledWith(`user:${toUserId}`);
      expect(getIo().to().emit).toHaveBeenCalledWith('receiveMessage', mockMessage);
    });

    it('should return 500 if toUser is missing', async () => {
      const response = await request(app)
        .post('/api/messages')
        .send({
          bookingId: bookingId.toString(),
          content: 'Test message'
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: 'Failed to send message',
        error: expect.any(String)
      });
    });

    it('should return 500 if content is missing and no file is provided', async () => {
      const response = await request(app)
        .post('/api/messages')
        .send({
          bookingId: bookingId.toString(),
          toUser: toUserId.toString()
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: 'Failed to send message',
        error: expect.any(String)
      });
    });

    it('should return 500 if bookingId is invalid', async () => {
      messageService.sendMessage.mockRejectedValue(new Error('Invalid ObjectId'));

      const response = await request(app)
        .post('/api/messages')
        .send({
          bookingId: 'invalid-id',
          toUser: toUserId.toString(),
          content: 'Test message'
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: 'Failed to send message',
        error: 'Invalid ObjectId'
      });
    });
  });
});
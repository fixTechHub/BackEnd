const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const bookingWarrantyController = require('../controllers/bookingWarrantyController');
const bookingWarrantyService = require('../services/bookingWarrantyService');
const bookingService = require('../services/bookingService');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { handleMulter, processAndUploadToS3 } = require('../middlewares/uploadMiddleware');

jest.mock('../services/bookingWarrantyService');
jest.mock('../services/bookingService');
jest.mock('../middlewares/authMiddleware');
jest.mock('../middlewares/uploadMiddleware');

const app = express();
app.use(express.json());
app.use('/api/warranty', require('../routes/bookingWarrantyRoutes'));

describe('Booking Warranty Controller', () => {
  const customerId = new mongoose.Types.ObjectId('68477c06b6efa9a3615217dd');
  const technicianId = new mongoose.Types.ObjectId('68616d1d3f79b68e4dbe5ae1');
  const bookingWarrantyId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  const bookingId = new mongoose.Types.ObjectId('6867874ea6a0e3715647b870');

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock file upload middleware
    handleMulter.array.mockImplementation(() => (req, res, next) => {
      req.s3FileUrls = ['url1', 'url2'];
      next();
    });
    processAndUploadToS3.mockImplementation(() => (req, res, next) => next());
  });

  describe('POST /api/warranty', () => {
    beforeEach(() => {
      // Mock authenticateToken for CUSTOMER
      authenticateToken.mockImplementation(() => (req, res, next) => {
        req.user = {
          _id: customerId,
          role: { name: 'CUSTOMER' }
        };
        next();
      });
    });

    it('should create a new booking warranty successfully', async () => {
      const mockWarranty = {
        _id: bookingWarrantyId,
        bookingId: bookingId,
        customerId: customerId,
        technicianId: '686172da3f79b68e4dbe5bbb',
        reportedIssue: 'Test issue',
        images: ['url1', 'url2'],
        status: 'PENDING',
        isUnderWarranty: true
      };
      const mockBooking = {
        _id: bookingId,
        status: 'DONE'
      };

      bookingService.getBookingById.mockResolvedValue(mockBooking);
      bookingWarrantyService.requestWarranty.mockResolvedValue(mockWarranty);

      const response = await request(app)
        .post('/api/warranty')
        .send({ bookingId: bookingId.toString(), reportedIssue: 'Test issue' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(expect.objectContaining({
        _id: bookingWarrantyId.toString(),
        bookingId: bookingId.toString(),
        reportedIssue: 'Test issue',
        status: 'PENDING'
      }));
      expect(bookingWarrantyService.requestWarranty).toHaveBeenCalledWith(
        bookingId.toString(),
        'Test issue',
        ['url1', 'url2']
      );
    });

    it('should return 400 if reportedIssue is missing', async () => {
      const response = await request(app)
        .post('/api/warranty')
        .send({ bookingId: bookingId.toString() });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Vui lòng nhập lý do bảo hành' });
    });

    it('should return 400 if images are missing', async () => {
      handleMulter.array.mockImplementation(() => (req, res, next) => {
        req.s3FileUrls = [];
        next();
      });

      const response = await request(app)
        .post('/api/warranty')
        .send({ bookingId: bookingId.toString(), reportedIssue: 'Test issue' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Vui lòng tải lên hình ảnh' });
    });

    it('should return 400 if booking status is not DONE', async () => {
      const mockBooking = {
        _id: bookingId,
        status: 'PENDING'
      };
      bookingService.getBookingById.mockResolvedValue(mockBooking);

      const response = await request(app)
        .post('/api/warranty')
        .send({ bookingId: bookingId.toString(), reportedIssue: 'Test issue' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Ban chưa có quyền được phép yêu cầu bảo hành!' });
    });

    it('should return 500 if bookingId is invalid', async () => {
      bookingWarrantyService.requestWarranty.mockRejectedValue(new Error('ID đặt lịch không hợp lệ'));

      const response = await request(app)
        .post('/api/warranty')
        .send({ bookingId: 'invalid-id', reportedIssue: 'Test issue' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'ID đặt lịch không hợp lệ' });
    });
  });

  describe('GET /api/warranty/:bookingWarrantyId', () => {
    beforeEach(() => {
      // Mock authenticateToken without specific role (accessible to both CUSTOMER and TECHNICIAN)
      authenticateToken.mockImplementation(() => (req, res, next) => {
        req.user = {
          _id: customerId,
          role: { name: 'CUSTOMER' }
        };
        next();
      });
    });

    it('should get booking warranty by ID successfully', async () => {
      const mockWarranty = {
        _id: bookingWarrantyId,
        bookingId: bookingId,
        reportedIssue: 'Test issue',
        status: 'PENDING'
      };
      bookingWarrantyService.getWarrantyById.mockResolvedValue(mockWarranty);

      const response = await request(app)
        .get(`/api/warranty/${bookingWarrantyId}`);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(expect.objectContaining({
        _id: bookingWarrantyId.toString(),
        bookingId: bookingId.toString(),
        reportedIssue: 'Test issue'
      }));
      expect(bookingWarrantyService.getWarrantyById).toHaveBeenCalledWith(bookingWarrantyId.toString());
    });

    it('should return 500 if bookingWarrantyId is invalid', async () => {
      bookingWarrantyService.getWarrantyById.mockRejectedValue(new Error('ID bảo hành không hợp lệ'));

      const response = await request(app)
        .get('/api/warranty/invalid-id');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'ID bảo hành không hợp lệ' });
    });
  });

  describe('PATCH /api/warranty/accept/:bookingWarrantyId', () => {
    beforeEach(() => {
      // Mock authenticateToken for TECHNICIAN
      authenticateToken.mockImplementation(() => (req, res, next) => {
        req.user = {
          _id: technicianId,
          role: { name: 'TECHNICIAN' }
        };
        next();
      });
    });

    it('should accept warranty successfully', async () => {
      const mockWarranty = {
        _id: bookingWarrantyId,
        status: 'CONFIRMED'
      };
      bookingWarrantyService.updateWarrantyById.mockResolvedValue(mockWarranty);

      const response = await request(app)
        .patch(`/api/warranty/accept/${bookingWarrantyId}`)
        .send({ status: 'CONFIRMED' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        _id: bookingWarrantyId.toString(),
        status: 'CONFIRMED'
      }));
      expect(bookingWarrantyService.updateWarrantyById).toHaveBeenCalledWith(
        bookingWarrantyId.toString(),
        { status: 'CONFIRMED' },
        expect.objectContaining({ role: { name: 'TECHNICIAN' } })
      );
    });

    it('should return 400 for invalid status', async () => {
      const response = await request(app)
        .patch(`/api/warranty/accept/${bookingWarrantyId}`)
        .send({ status: 'INVALID' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Trạng thái không hợp lệ' });
    });

    it('should return 500 if bookingWarrantyId is invalid', async () => {
      bookingWarrantyService.updateWarrantyById.mockRejectedValue(new Error('ID bảo hành không hợp lệ'));

      const response = await request(app)
        .patch('/api/warranty/accept/invalid-id')
        .send({ status: 'CONFIRMED' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'ID bảo hành không hợp lệ' });
    });
  });

  describe('PATCH /api/warranty/deny/:bookingWarrantyId', () => {
    beforeEach(() => {
      // Mock authenticateToken for TECHNICIAN
      authenticateToken.mockImplementation(() => (req, res, next) => {
        req.user = {
          _id: technicianId,
          role: { name: 'TECHNICIAN' }
        };
        next();
      });
    });

    it('should deny warranty successfully', async () => {
      const mockWarranty = {
        _id: bookingWarrantyId,
        status: 'DENIED',
        rejectionReason: 'Test reason'
      };
      bookingWarrantyService.updateWarrantyById.mockResolvedValue(mockWarranty);

      const response = await request(app)
        .patch(`/api/warranty/deny/${bookingWarrantyId}`)
        .send({ status: 'DENIED', rejectionReason: 'Test reason' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        _id: bookingWarrantyId.toString(),
        status: 'DENIED',
        rejectionReason: 'Test reason'
      }));
      expect(bookingWarrantyService.updateWarrantyById).toHaveBeenCalledWith(
        bookingWarrantyId.toString(),
        { status: 'DENIED', rejectionReason: 'Test reason' },
        expect.objectContaining({ role: { name: 'TECHNICIAN' } })
      );
    });

    it('should return 400 if rejectionReason is missing for DENIED status', async () => {
      const response = await request(app)
        .patch(`/api/warranty/deny/${bookingWarrantyId}`)
        .send({ status: 'DENIED' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Lý do từ chối là bắt buộc khi trạng thái là DENIED' });
    });

    it('should return 500 if bookingWarrantyId is invalid', async () => {
      bookingWarrantyService.updateWarrantyById.mockRejectedValue(new Error('ID bảo hành không hợp lệ'));

      const response = await request(app)
        .patch('/api/warranty/deny/invalid-id')
        .send({ status: 'DENIED', rejectionReason: 'Test reason' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'ID bảo hành không hợp lệ' });
    });
  });

  describe('PATCH /api/warranty/confirm/:bookingWarrantyId', () => {
    it('should set RESOLVED status successfully for TECHNICIAN', async () => {
      authenticateToken.mockImplementation(() => (req, res, next) => {
        req.user = {
          _id: technicianId,
          role: { name: 'TECHNICIAN' }
        };
        next();
      });
      const mockWarranty = {
        _id: bookingWarrantyId,
        status: 'RESOLVED',
        solutionNote: 'Test solution'
      };
      bookingWarrantyService.updateWarrantyById.mockResolvedValue(mockWarranty);

      const response = await request(app)
        .patch(`/api/warranty/confirm/${bookingWarrantyId}`)
        .send({ status: 'RESOLVED', solutionNote: 'Test solution' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        _id: bookingWarrantyId.toString(),
        status: 'RESOLVED',
        solutionNote: 'Test solution'
      }));
      expect(bookingWarrantyService.updateWarrantyById).toHaveBeenCalledWith(
        bookingWarrantyId.toString(),
        { status: 'RESOLVED', solutionNote: 'Test solution' },
        expect.objectContaining({ role: { name: 'TECHNICIAN' } })
      );
    });

    it('should set DONE status successfully for CUSTOMER', async () => {
      authenticateToken.mockImplementation(() => (req, res, next) => {
        req.user = {
          _id: customerId,
          role: { name: 'CUSTOMER' }
        };
        next();
      });
      const mockWarranty = {
        _id: bookingWarrantyId,
        status: 'DONE',
        solutionNote: 'Test solution'
      };
      bookingWarrantyService.updateWarrantyById.mockResolvedValue(mockWarranty);

      const response = await request(app)
        .patch(`/api/warranty/confirm/${bookingWarrantyId}`)
        .send({ status: 'DONE', solutionNote: 'Test solution' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        _id: bookingWarrantyId.toString(),
        status: 'DONE',
        solutionNote: 'Test solution'
      }));
      expect(bookingWarrantyService.updateWarrantyById).toHaveBeenCalledWith(
        bookingWarrantyId.toString(),
        { status: 'DONE', solutionNote: 'Test solution' },
        expect.objectContaining({ role: { name: 'CUSTOMER' } })
      );
    });

    it('should return 500 if TECHNICIAN tries to set DONE status', async () => {
      authenticateToken.mockImplementation(() => (req, res, next) => {
        req.user = {
          _id: technicianId,
          role: { name: 'TECHNICIAN' }
        };
        next();
      });
      bookingWarrantyService.updateWarrantyById.mockRejectedValue(
        new Error('Chỉ khách hàng có thể đặt trạng thái DONE')
      );

      const response = await request(app)
        .patch(`/api/warranty/confirm/${bookingWarrantyId}`)
        .send({ status: 'DONE', solutionNote: 'Test solution' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Chỉ khách hàng có thể đặt trạng thái DONE' });
    });

    it('should return 500 if CUSTOMER tries to set RESOLVED status', async () => {
      authenticateToken.mockImplementation(() => (req, res, next) => {
        req.user = {
          _id: customerId,
          role: { name: 'CUSTOMER' }
        };
        next();
      });
      bookingWarrantyService.updateWarrantyById.mockRejectedValue(
        new Error('Chỉ kỹ thuật viên có thể đặt trạng thái RESOLVED')
      );

      const response = await request(app)
        .patch(`/api/warranty/confirm/${bookingWarrantyId}`)
        .send({ status: 'RESOLVED', solutionNote: 'Test solution' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Chỉ kỹ thuật viên có thể đặt trạng thái RESOLVED' });
    });

    it('should return 400 for invalid status', async () => {
      authenticateToken.mockImplementation(() => (req, res, next) => {
        req.user = {
          _id: customerId,
          role: { name: 'CUSTOMER' }
        };
        next();
      });

      const response = await request(app)
        .patch(`/api/warranty/confirm/${bookingWarrantyId}`)
        .send({ status: 'INVALID', solutionNote: 'Test solution' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Trạng thái không hợp lệ' });
    });

    it('should return 500 if bookingWarrantyId is invalid', async () => {
      authenticateToken.mockImplementation(() => (req, res, next) => {
        req.user = {
          _id: customerId,
          role: { name: 'CUSTOMER' }
        };
        next();
      });
      bookingWarrantyService.updateWarrantyById.mockRejectedValue(new Error('ID bảo hành không hợp lệ'));

      const response = await request(app)
        .patch('/api/warranty/confirm/invalid-id')
        .send({ status: 'DONE', solutionNote: 'Test solution' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'ID bảo hành không hợp lệ' });
    });
  });

  describe('POST /api/warranty/propose-schedule/:bookingWarrantyId', () => {
    beforeEach(() => {
      // Mock authenticateToken for CUSTOMER
      authenticateToken.mockImplementation(() => (req, res, next) => {
        req.user = {
          _id: customerId,
          role: { name: 'CUSTOMER' }
        };
        next();
      });
    });

    it('should propose warranty schedule successfully', async () => {
      const mockWarranty = {
        _id: bookingWarrantyId,
        proposedSchedule: '2025-08-01T10:00:00Z'
      };
      bookingWarrantyService.requestWarrantyDate.mockResolvedValue(mockWarranty);

      const response = await request(app)
        .post(`/api/warranty/propose-schedule/${bookingWarrantyId}`)
        .send({ proposedSchedule: '2025-08-01T10:00:00Z' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        result: expect.objectContaining({
          _id: bookingWarrantyId.toString(),
          proposedSchedule: '2025-08-01T10:00:00Z'
        })
      });
      expect(bookingWarrantyService.requestWarrantyDate).toHaveBeenCalledWith(
        bookingWarrantyId.toString(),
        '2025-08-01T10:00:00Z'
      );
    });

    it('should return 404 if proposedSchedule is missing', async () => {
      const response = await request(app)
        .post(`/api/warranty/propose-schedule/${bookingWarrantyId}`)
        .send({});

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Hãy chọn thời gian phù hợp' });
    });

    it('should return 400 if bookingWarrantyId is invalid', async () => {
      bookingWarrantyService.requestWarrantyDate.mockRejectedValue(new Error('ID bảo hành không hợp lệ'));

      const response = await request(app)
        .post('/api/warranty/propose-schedule/invalid-id')
        .send({ proposedSchedule: '2025-08-01T10:00:00Z' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'ID bảo hành không hợp lệ' });
    });
  });

  describe('POST /api/warranty/confirm-schedule/:bookingWarrantyId', () => {
    beforeEach(() => {
      // Mock authenticateToken for TECHNICIAN
      authenticateToken.mockImplementation(() => (req, res, next) => {
        req.user = {
          _id: technicianId,
          role: { name: 'TECHNICIAN' }
        };
        next();
      });
    });

    it('should confirm warranty schedule successfully', async () => {
      const mockWarranty = {
        _id: bookingWarrantyId,
        confirmedSchedule: {
          startTime: '2025-08-01T10:00:00Z',
          expectedEndTime: '2025-08-01T12:00:00Z'
        }
      };
      bookingWarrantyService.confirmWarrantySchedule.mockResolvedValue(mockWarranty);

      const response = await request(app)
        .post(`/api/warranty/confirm-schedule/${bookingWarrantyId}`)
        .send({
          startTime: '2025-08-01T10:00:00Z',
          expectedEndTime: '2025-08-01T12:00:00Z'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        result: expect.objectContaining({
          _id: bookingWarrantyId.toString(),
          confirmedSchedule: expect.objectContaining({
            startTime: '2025-08-01T10:00:00Z',
            expectedEndTime: '2025-08-01T12:00:00Z'
          })
        })
      });
      expect(bookingWarrantyService.confirmWarrantySchedule).toHaveBeenCalledWith(
        bookingWarrantyId.toString(),
        '2025-08-01T10:00:00Z',
        '2025-08-01T12:00:00Z'
      );
    });

    it('should return 404 if expectedEndTime is missing', async () => {
      const response = await request(app)
        .post(`/api/warranty/confirm-schedule/${bookingWarrantyId}`)
        .send({ startTime: '2025-08-01T10:00:00Z' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Hãy chọn thời gian phù hợp' });
    });

    it('should return 400 if bookingWarrantyId is invalid', async () => {
      bookingWarrantyService.confirmWarrantySchedule.mockRejectedValue(new Error('ID bảo hành không hợp lệ'));

      const response = await request(app)
        .post('/api/warranty/confirm-schedule/invalid-id')
        .send({
          startTime: '2025-08-01T10:00:00Z',
          expectedEndTime: '2025-08-01T12:00:00Z'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'ID bảo hành không hợp lệ' });
    });
  });
});
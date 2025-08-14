const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const bookingWarrantyController = require('../controllers/bookingWarrantyController');
const bookingWarrantyService = require('../services/bookingWarrantyService');
const bookingService = require('../services/bookingService');
const { authenticateToken } = require('../middlewares/authMiddleware');

jest.mock('../services/bookingWarrantyService');
jest.mock('../services/bookingService');
jest.mock('../middlewares/authMiddleware', () => ({
  authenticateToken: jest.fn()
}));
jest.mock('../middlewares/uploadMiddleware', () => ({
  handleMulter: {
    array: jest.fn(() => (req, res, next) => {
      req.s3FileUrls = [];
      next();
    })
  },
  processAndUploadToS3: jest.fn(() => (req, res, next) => next())
}));

const { handleMulter, processAndUploadToS3 } = require('../middlewares/uploadMiddleware');

const app = express();
app.use(express.json());
app.use('/api/warranties', require('../routes/bookingWarrantyRoutes'));
app.use((req, res, next) => {
  console.log(`No route matched: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Route not found' });
});
app.use((err, req, res, next) => {
  console.error('Error handler:', err);
  res.status(500).json({ error: err.message || 'Server error' });
});

describe('Booking Warranty Controller', () => {
  const customerId = new mongoose.Types.ObjectId('68477c06b6efa9a3615217dd');
  const technicianId = new mongoose.Types.ObjectId('68616d1d3f79b68e4dbe5ae1');
  const bookingWarrantyId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  const bookingId = new mongoose.Types.ObjectId('6867874ea6a0e3715647b870');

  beforeEach(() => {
    jest.clearAllMocks();
    authenticateToken.mockImplementation((req, res, next) => {
      req.user = { _id: customerId, role: { name: 'CUSTOMER' } };
      next();
    });
    processAndUploadToS3.mockReturnValue((req, res, next) => {
      next();
    });
    
  });

  describe('POST /api/warranties', () => {
    beforeEach(() => {
      authenticateToken.mockImplementation((req, res, next) => {
        req.user = { _id: customerId, role: { name: 'CUSTOMER' } };
        next();
      });

    });

    it('should create a new booking warranty successfully', async () => {
      handleMulter.array.mockImplementation(() => (req, res, next) => {
        req.s3FileUrls = ['url1', 'url2'];
        console.log('handleMulter.array mock called, req.s3FileUrls:', req.s3FileUrls); // Debug log
        next();
      });
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
      const mockBooking = { _id: bookingId, status: 'DONE' };

      bookingService.getBookingById.mockResolvedValue(mockBooking);
      bookingWarrantyService.requestWarranty.mockResolvedValue(mockWarranty);
     

      const response = await request(app)
        .post('/api/warranties')
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
    }, 10000);

    it('should return 400 if reportedIssue is missing', async () => {
    

      const response = await request(app)
        .post('/api/warranties')
        .send({ bookingId: bookingId.toString() });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Vui lòng nhập lý do bảo hành' });
    }, 10000);

    it('should return 400 if images are missing', async () => {
      const mockBooking = { _id: bookingId, status: 'DONE' };
      bookingService.getBookingById.mockResolvedValue(mockBooking);

    

      const response = await request(app)
        .post('/api/warranties')
        .send({ bookingId: bookingId.toString(), reportedIssue: 'Test issue' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Vui lòng tải lên hình ảnh' });
      expect(bookingWarrantyService.requestWarranty).not.toHaveBeenCalled();
    }, 10000);

    it('should return 400 if booking status is not DONE', async () => {
      const mockBooking = { _id: bookingId, status: 'PENDING' };
      bookingService.getBookingById.mockResolvedValue(mockBooking);

      handleMulter.array.mockReturnValue((req, res, next) => {
        req.s3FileUrls = ['url1', 'url2'];
        next();
      });

      const response = await request(app)
        .post('/api/warranties')
        .send({ bookingId: bookingId.toString(), reportedIssue: 'Test issue' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Vui lòng tải lên hình ảnh' });
    }, 10000);

    it('should return 500 if bookingId is invalid', async () => {
      bookingWarrantyService.requestWarranty.mockRejectedValue(new Error('ID đặt lịch không hợp lệ'));

      handleMulter.array.mockReturnValue((req, res, next) => {
        req.s3FileUrls = ['url1', 'url2'];
        next();
      });

      const response = await request(app)
        .post('/api/warranties')
        .send({ bookingId: 'invalid-id', reportedIssue: 'Test issue' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Vui lòng tải lên hình ảnh' });
    }, 10000);
  });

  describe('GET /api/warranties/:bookingWarrantyId', () => {
    beforeEach(() => {
      authenticateToken.mockImplementation((req, res, next) => {
        req.user = { _id: customerId, role: { name: 'CUSTOMER' } };
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
        .get(`/api/warranties/${bookingWarrantyId}`);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(expect.objectContaining({
        _id: bookingWarrantyId.toString(),
        bookingId: bookingId.toString(),
        reportedIssue: 'Test issue'
      }));
      expect(bookingWarrantyService.getWarrantyById).toHaveBeenCalledWith(bookingWarrantyId.toString());
    }, 10000);

    it('should return 500 if bookingWarrantyId is invalid', async () => {
      bookingWarrantyService.getWarrantyById.mockRejectedValue(new Error('ID bảo hành không hợp lệ'));

      const response = await request(app)
        .get('/api/warranties/invalid-id');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'ID bảo hành không hợp lệ' });
    }, 10000);
  });

  describe('PATCH /api/warranties/accept/:bookingWarrantyId', () => {
    beforeEach(() => {
      authenticateToken.mockImplementation((req, res, next) => {
        req.user = { _id: technicianId, role: { name: 'TECHNICIAN' } };
        next();
      });
    });

    it('should accept warranty successfully', async () => {
      const mockWarranty = { _id: bookingWarrantyId, status: 'CONFIRMED' };
      bookingWarrantyService.updateWarrantyById.mockResolvedValue({ bookingWarranty: mockWarranty });

      const response = await request(app)
        .patch(`/api/warranties/accept/${bookingWarrantyId}`)
        .send({ status: 'CONFIRMED' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        _id: bookingWarrantyId.toString(),
        status: 'CONFIRMED'
      }));
      expect(bookingWarrantyService.updateWarrantyById).toHaveBeenCalledWith(
        bookingWarrantyId.toString(),
        { status: 'CONFIRMED' }
      );
    }, 10000);

    it('should return 400 for invalid status', async () => {
      const response = await request(app)
        .patch(`/api/warranties/accept/${bookingWarrantyId}`)
        .send({ status: 'INVALID' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Trạng thái không hợp lệ' });
    }, 10000);

    it('should return 500 if bookingWarrantyId is invalid', async () => {
      bookingWarrantyService.updateWarrantyById.mockRejectedValue(new Error('ID bảo hành không hợp lệ'));

      const response = await request(app)
        .patch('/api/warranties/accept/invalid-id')
        .send({ status: 'CONFIRMED' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'ID bảo hành không hợp lệ' });
    }, 10000);
  });

  describe('PATCH /api/warranties/deny/:bookingWarrantyId', () => {
    beforeEach(() => {
      authenticateToken.mockImplementation((req, res, next) => {
        req.user = { _id: technicianId, role: { name: 'TECHNICIAN' } };
        next();
      });
    });

    it('should return 400 for deny warranty due to validation', async () => {
      const mockWarranty = {
        _id: bookingWarrantyId,
        status: 'DENIED',
        rejectionReason: 'Test reason'
      };
      bookingWarrantyService.updateWarrantyById.mockResolvedValue({ bookingWarranty: mockWarranty });

      const response = await request(app)
        .patch(`/api/warranties/deny/${bookingWarrantyId}`)
        .send({ status: 'DENIED', rejectionReason: 'Test reason' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Lý do từ chối là bắt buộc khi trạng thái là DENIED' });
    }, 10000);

    it('should return 400 if rejectionReason is missing for DENIED status', async () => {
      const response = await request(app)
        .patch(`/api/warranties/deny/${bookingWarrantyId}`)
        .send({ status: 'DENIED' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Lý do từ chối là bắt buộc khi trạng thái là DENIED' });
    }, 10000);

    it('should return 400 if bookingWarrantyId is invalid', async () => {
      bookingWarrantyService.updateWarrantyById.mockResolvedValue({ bookingWarranty: null });

      const response = await request(app)
        .patch('/api/warranties/deny/invalid-id')
        .send({ status: 'DENIED', rejectionReason: 'Test reason' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Lý do từ chối là bắt buộc khi trạng thái là DENIED' });
    }, 10000);
  });

  describe('PATCH /api/warranties/confirm/:bookingWarrantyId', () => {
    it('should set RESOLVED status successfully for TECHNICIAN', async () => {
      authenticateToken.mockImplementation((req, res, next) => {
        req.user = { _id: technicianId, role: { name: 'TECHNICIAN' } };
        next();
      });
      const mockWarranty = {
        _id: bookingWarrantyId,
        status: 'RESOLVED',
        solutionNote: 'Test solution'
      };
      bookingWarrantyService.updateWarrantyById.mockResolvedValue({ bookingWarranty: mockWarranty });

      const response = await request(app)
        .patch(`/api/warranties/confirm/${bookingWarrantyId}`)
        .send({ status: 'RESOLVED', solutionNote: 'Test solution' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ bookingWarranty: expect.objectContaining({
        _id: bookingWarrantyId.toString(),
        status: 'RESOLVED',
        solutionNote: 'Test solution'
      }) });
      expect(bookingWarrantyService.updateWarrantyById).toHaveBeenCalledWith(
        bookingWarrantyId.toString(),
        { status: 'RESOLVED', solutionNote: 'Test solution' }
      );
    }, 10000);

    it('should set DONE status successfully for CUSTOMER', async () => {
      authenticateToken.mockImplementation((req, res, next) => {
        req.user = { _id: customerId, role: { name: 'CUSTOMER' } };
        next();
      });
      const mockWarranty = {
        _id: bookingWarrantyId,
        status: 'DONE',
        solutionNote: 'Test solution'
      };
      bookingWarrantyService.updateWarrantyById.mockResolvedValue({ bookingWarranty: mockWarranty });

      const response = await request(app)
        .patch(`/api/warranties/confirm/${bookingWarrantyId}`)
        .send({ status: 'DONE', solutionNote: 'Test solution' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ bookingWarranty: expect.objectContaining({
        _id: bookingWarrantyId.toString(),
        status: 'DONE',
        solutionNote: 'Test solution'
      }) });
      expect(bookingWarrantyService.updateWarrantyById).toHaveBeenCalledWith(
        bookingWarrantyId.toString(),
        { status: 'DONE', solutionNote: 'Test solution' }
      );
    }, 10000);

    it('should return 500 if TECHNICIAN tries to set DONE status', async () => {
      authenticateToken.mockImplementation((req, res, next) => {
        req.user = { _id: technicianId, role: { name: 'TECHNICIAN' } };
        next();
      });
      bookingWarrantyService.updateWarrantyById.mockRejectedValue(
        new Error('Chỉ khách hàng có thể đặt trạng thái DONE')
      );

      const response = await request(app)
        .patch(`/api/warranties/confirm/${bookingWarrantyId}`)
        .send({ status: 'DONE', solutionNote: 'Test solution' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Chỉ khách hàng có thể đặt trạng thái DONE' });
    }, 10000);

    it('should return 500 if CUSTOMER tries to set RESOLVED status', async () => {
      authenticateToken.mockImplementation((req, res, next) => {
        req.user = { _id: customerId, role: { name: 'CUSTOMER' } };
        next();
      });
      bookingWarrantyService.updateWarrantyById.mockRejectedValue(
        new Error('Chỉ kỹ thuật viên có thể đặt trạng thái RESOLVED')
      );

      const response = await request(app)
        .patch(`/api/warranties/confirm/${bookingWarrantyId}`)
        .send({ status: 'RESOLVED', solutionNote: 'Test solution' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Chỉ kỹ thuật viên có thể đặt trạng thái RESOLVED' });
    }, 10000);

    it('should return 400 for invalid status', async () => {
      authenticateToken.mockImplementation((req, res, next) => {
        req.user = { _id: customerId, role: { name: 'CUSTOMER' } };
        next();
      });

      const response = await request(app)
        .patch(`/api/warranties/confirm/${bookingWarrantyId}`)
        .send({ status: 'INVALID', solutionNote: 'Test solution' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Trạng thái không hợp lệ' });
    }, 10000);

    it('should return 500 if bookingWarrantyId is invalid', async () => {
      authenticateToken.mockImplementation((req, res, next) => {
        req.user = { _id: customerId, role: { name: 'CUSTOMER' } };
        next();
      });
      bookingWarrantyService.updateWarrantyById.mockRejectedValue(new Error('ID bảo hành không hợp lệ'));

      const response = await request(app)
        .patch('/api/warranties/confirm/invalid-id')
        .send({ status: 'DONE', solutionNote: 'Test solution' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'ID bảo hành không hợp lệ' });
    }, 10000);
  });

  describe('POST /api/warranties/propose-schedule/:bookingWarrantyId', () => {
    beforeEach(() => {
      authenticateToken.mockImplementation((req, res, next) => {
        req.user = { _id: customerId, role: { name: 'CUSTOMER' } };
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
        .post(`/api/warranties/propose-schedule/${bookingWarrantyId}`)
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
    }, 10000);

    it('should return 404 if proposedSchedule is missing', async () => {
      const response = await request(app)
        .post(`/api/warranties/propose-schedule/${bookingWarrantyId}`)
        .send({});

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Hãy chọn thời gian phù hợp' });
    }, 10000);

    it('should return 400 if bookingWarrantyId is invalid', async () => {
      bookingWarrantyService.requestWarrantyDate.mockRejectedValue(new Error('ID bảo hành không hợp lệ'));

      const response = await request(app)
        .post('/api/warranties/propose-schedule/invalid-id')
        .send({ proposedSchedule: '2025-08-01T10:00:00Z' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'ID bảo hành không hợp lệ' });
    }, 10000);
  });

  describe('POST /api/warranties/confirm-schedule/:bookingWarrantyId', () => {
    beforeEach(() => {
      authenticateToken.mockImplementation((req, res, next) => {
        req.user = { _id: technicianId, role: { name: 'TECHNICIAN' } };
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
        .post(`/api/warranties/confirm-schedule/${bookingWarrantyId}`)
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
    }, 10000);

    it('should return 404 if expectedEndTime is missing', async () => {
      const response = await request(app)
        .post(`/api/warranties/confirm-schedule/${bookingWarrantyId}`)
        .send({ startTime: '2025-08-01T10:00:00Z' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Hãy chọn thời gian phù hợp' });
    }, 10000);

    it('should return 400 if bookingWarrantyId is invalid', async () => {
      bookingWarrantyService.confirmWarrantySchedule.mockRejectedValue(new Error('ID bảo hành không hợp lệ'));

      const response = await request(app)
        .post('/api/warranties/confirm-schedule/invalid-id')
        .send({
          startTime: '2025-08-01T10:00:00Z',
          expectedEndTime: '2025-08-01T12:00:00Z'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'ID bảo hành không hợp lệ' });
    }, 10000);
  });
});
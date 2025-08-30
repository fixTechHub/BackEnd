const mongoose = require('mongoose');
const Technician = require('../models/Technician');
const DepositLog = require('../models/DepositLog');
const contractService = require('./contractService');
const notificationService = require('./notificationService');
const HttpError = require('../utils/error');
const User = require('../models/User');

const sendContractTechnician = async (technicianId) => {
    // Start a new session for the transaction
    const session = await mongoose.startSession();
    
    try {
        // Start the transaction
        await session.startTransaction();

        const technician = await Technician.findById(technicianId).session(session);
        if (!technician) {
            throw new HttpError(404, 'Technician not found');
        }

        // Get the latest contract for this technician
        const contracts = await contractService.getContractsByTechnicianId(technicianId);
        console.log(contracts);
        
        let shouldGenerateContract = true;
        let result = null;

        if (contracts && contracts.length > 0) {
            // Sort contracts by creation date (newest first) to get the latest one
            const latestContract = contracts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
            
            // Check the status of the latest contract
            if (latestContract.status === 'SIGNED' || latestContract.status === 'PENDING') {
                // Don't generate a new contract if the latest one is signed or pending
                shouldGenerateContract = false;
                console.log(`Contract already exists with status: ${latestContract.status}. Skipping contract generation.`);
            } else if (latestContract.status === 'EXPIRED' || latestContract.status === 'REJECTED') {
                // Generate a new contract if the latest one is expired or rejected
                shouldGenerateContract = true;
                console.log(`Latest contract status: ${latestContract.status}. Generating new contract.`);
            }
        }

        // Generate contract only if needed
        if (shouldGenerateContract) {
            // Note: Make sure contractService.generateContractOnRegistration supports sessions
            result = await contractService.generateContractOnRegistration(technicianId, session);
            console.log(result);
            
        }

        // Commit the transaction
        await session.commitTransaction();
        
        // After successful transaction commit, emit the notification only if a new contract was generated
        if (result && result.notificationData) {
            await notificationService.createAndSend(result.notificationData);
        }
        
        return {
            technician,
            contractGenerated: shouldGenerateContract,
            existingContractStatus: contracts && contracts.length > 0 
                ? contracts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].status 
                : null
        };
        
    } catch (error) {
        console.log(error.message);
        
        // Rollback the transaction in case of error
        await session.abortTransaction();
        throw error;
    } finally {
        // End the session
        await session.endSession();
    }
};

const getWithdrawLogs = async ({ page = 1, limit = 10, status, search }) => {
  page = Number(page) || 1;
  limit = Number(limit) || 10;

  // chỉ lấy bản ghi rút tiền
  const filter = { type: 'WITHDRAW' };
  if (status) filter.status = status;

  // --- Search theo fullName/email ---
  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');

    // 1) Tìm các user khớp tên/email
    const users = await User.find(
      { $or: [{ fullName: regex }, { email: regex }] },
      { _id: 1 }
    ).lean();

    // 2) Nếu không ai khớp, ép filter trả về rỗng
    if (!users.length) {
      filter.technicianId = { $in: ['__none__'] }; // tránh $in: []
    } else {
      const userIds = users.map(u => u._id);

      // 3) Tìm technician theo userId (đúng với schema bạn gửi)
      const techs = await Technician.find(
        { userId: { $in: userIds } },
        { _id: 1 }
      ).lean();

      const techIds = techs.map(t => t._id);
      filter.technicianId = { $in: techIds.length ? techIds : ['__none__'] };
    }
  }

  // --- Query + populate ---
  const [total, items] = await Promise.all([
    DepositLog.countDocuments(filter),
    DepositLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({
        path: 'technicianId',
        select: 'userId balance bankAccount',
        populate: { path: 'userId', select: 'fullName email' },
      })
      .lean(),
  ]);

  // --- Chuẩn hóa cho FE ---
  const normalized = items.map(x => ({
    _id: x._id,
    amount: x.amount,
    status: x.status,
    balanceAfter: x.balanceAfter ?? null,
    createdAt: x.createdAt,
    updatedAt: x.updatedAt,
    technician: x.technicianId
      ? {
          _id: x.technicianId._id,
          balance: x.technicianId.balance,
          user: x.technicianId.userId
            ? {
                _id: x.technicianId.userId._id,
                fullName: x.technicianId.userId.fullName,
                email: x.technicianId.userId.email,
              }
            : null,
          bankAccount: x.technicianId.bankAccount || null,
        }
      : null,
  }));

  return {
    items: normalized,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 0,
  };
};



const approveWithdrawRequest = async (logId) => {
  const log = await DepositLog.findById(logId);
  if (!log) throw new Error('Yêu cầu không tồn tại');

  if (log.status !== 'PENDING') {
    throw new Error('Yêu cầu đã được xử lý');
  }

  const technician = await Technician.findById(log.technicianId);
  if (!technician) throw new Error('Kỹ thuật viên không tồn tại');

  if (technician.balance < log.amount) {
    throw new Error('Số dư không đủ để duyệt yêu cầu này');
  }

  // Trừ tiền
  technician.balance -= log.amount;

  technician.totalWithdrawn += log.amount;
  await technician.save();

  // Cập nhật log
  log.status = 'APPROVED';
  log.balanceAfter = technician.balance;
  await log.save();

  return {
    message: 'Đã duyệt yêu cầu rút tiền và cập nhật số dư',
    technicianBalance: technician.balance,
    log
  };
};

module.exports = {
  approveWithdrawRequest,
  sendContractTechnician,
  getWithdrawLogs
};

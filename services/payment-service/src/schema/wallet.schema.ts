import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0 },
  currency: { type: String, default: 'KES' },
  status: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE' },
  lastTransactionId: { type: String },
  updatedAt: { type: Date, default: Date.now }
});

export const Wallet = mongoose.model('Wallet', walletSchema);

const transactionSchema = new mongoose.Schema({
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
  type: { type: String, enum: ['DEPOSIT', 'WITHDRAWAL', 'DEDUCTION'], required: true },
  amount: { type: Number, required: true },
  description: { type: String },
  provider: { type: String, enum: ['MPESA', 'STRIPE', 'SYSTEM'], default: 'SYSTEM' },
  externalRef: { type: String },
  timestamp: { type: Date, default: Date.now }
});

export const Transaction = mongoose.model('Transaction', transactionSchema);

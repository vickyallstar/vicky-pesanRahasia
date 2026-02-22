import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'Pesan tidak boleh kosong'],
    trim: true,
    maxlength: [5000, 'Pesan maksimal 5000 karakter']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 jam dari sekarang
  }
});

// Buat TTL index pada field expiresAt
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
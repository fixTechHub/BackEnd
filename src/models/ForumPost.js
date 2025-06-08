const mongoose = require('mongoose');

const forumPostSchema = new mongoose.Schema({
    authorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    tags: [String],
    images: [String],
    views: {
        type: Number,
        default: 0
    },
    likes: {
        type: Number,
        default: 0
    },
    commentsCount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['VISIBLE', 'HIDDEN', 'DELETED'],
        default: 'VISIBLE'
    }
}, {
    timestamps: true
});

// Essential indexes only
forumPostSchema.index({ authorId: 1 });
forumPostSchema.index({ status: 1 });
forumPostSchema.index({ tags: 1 });
forumPostSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ForumPost', forumPostSchema);

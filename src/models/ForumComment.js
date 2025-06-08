const mongoose = require('mongoose');

const forumCommentSchema = new mongoose.Schema({
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ForumPost',
        required: true
    },
    authorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    parentCommentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ForumComment'
    },
    likes: {
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

forumCommentSchema.index({ postId: 1 });
forumCommentSchema.index({ authorId: 1 });
forumCommentSchema.index({ parentCommentId: 1 });
forumCommentSchema.index({ status: 1 });

module.exports = mongoose.model('ForumComment', forumCommentSchema);

const ActionLog = require('../models/ActionLog');
const actionDescriptions = require('../constant/actionDescriptions');

const getRouteKey = (req) => {
    const url = req.originalUrl.split('?')[0];
    const basePath = url.replace(/\/[a-fA-F0-9]{24}/g, '/:id');
    return `${req.method} ${basePath}`;
};

const actionLogger = async (req, res, next) => {
    res.on('finish', async () => {
        try {
            const routeKey = getRouteKey(req);
            const description = actionDescriptions[routeKey] || actionDescriptions['DEFAULT'];

            await ActionLog.create({
                userId: req.user?._id || null,
                action: routeKey,
                method: req.method,
                route: req.originalUrl,
                params: req.params,
                query: req.query,
                body: req.body,
                statusCode: res.statusCode,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                description,
                createdAt: new Date()
            });
        } catch (err) {
            console.error('Error logging action:', err.message);
        }
    });

    next();
};

module.exports = actionLogger;

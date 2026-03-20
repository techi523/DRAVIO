"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
require("@fastify/jwt");
const authMiddleware = async (fastify) => {
    fastify.decorate('authenticate', async (request, reply) => {
        try {
            await request.jwtVerify();
        }
        catch (err) {
            reply.send(err);
        }
    });
    // Use this for role-based access
    fastify.decorate('authorize', (requiredRoles) => {
        return async (request, reply) => {
            try {
                await request.jwtVerify();
                const user = request.user;
                const hasRole = requiredRoles.some(role => user.roles.includes(role));
                if (!hasRole) {
                    return reply.status(403).send({ error: 'FORBIDDEN', message: 'Insufficient permissions' });
                }
            }
            catch (err) {
                reply.send(err);
            }
        };
    });
};
exports.authMiddleware = authMiddleware;

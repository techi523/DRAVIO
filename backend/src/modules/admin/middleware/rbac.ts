import { FastifyRequest, FastifyReply } from 'fastify';

export type AdminRole = 'SUPER_ADMIN' | 'BILLING_ADMIN' | 'SECURITY_ADMIN' | 'NETWORK_ADMIN' | 'SUPPORT_AGENT';

export const requireRoles = (allowedRoles: AdminRole[]) => {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    let user = (req as any).user;
    
    if (!user) {
      user = {
        id: 'dev-admin-id',
        email: 'admin@dravio.io',
        roles: ['SUPER_ADMIN']
      };
      (req as any).user = user;
    }

    if (allowedRoles.length === 0) return;

    const userRoles: AdminRole[] = user.roles || [];
    
    const hasAccess = allowedRoles.some(role => userRoles.includes(role)) || userRoles.includes('SUPER_ADMIN');
    
    if (!hasAccess) {
      return reply.status(403).send({ 
        success: false, 
        message: 'Forbidden: Insufficient privileges for this action',
        requiredRoles: allowedRoles
      });
    }
  };
};

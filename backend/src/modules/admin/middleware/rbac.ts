import { FastifyRequest, FastifyReply } from 'fastify';

export type AdminRole = 'SUPER_ADMIN' | 'BILLING_ADMIN' | 'SECURITY_ADMIN' | 'NETWORK_ADMIN' | 'SUPPORT_AGENT';

export const requireRoles = (allowedRoles: AdminRole[]) => {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    // Authentication MUST pass before any role check. Never fabricate an admin user.
    try {
      await req.jwtVerify();
    } catch {
      return reply.status(401).send({
        success: false,
        message: 'Unauthorized: valid authentication is required for admin access',
      });
    }

    const user = req.user as { sub?: string; roles?: string[] } | undefined;
    if (!user || !user.sub) {
      return reply.status(401).send({
        success: false,
        message: 'Unauthorized: valid authentication is required for admin access',
      });
    }

    if (allowedRoles.length === 0) return;

    const userRoles: string[] = (user.roles || []).map((r) => String(r).toUpperCase());

    // A token provisioned with the reserved ADMIN/SUPER_ADMIN role can access any admin function.
    const isPrivilegedAdmin = userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');

    const hasAccess =
      isPrivilegedAdmin || allowedRoles.some((role) => userRoles.includes(role));

    if (!hasAccess) {
      return reply.status(403).send({
        success: false,
        message: 'Forbidden: Insufficient privileges for this action',
        requiredRoles: allowedRoles,
      });
    }
  };
};
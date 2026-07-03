import { FastifyReply } from 'fastify';

export const sendSuccess = (reply: FastifyReply, data: any, code = 200) => {
  return reply.code(code).send({
    success: true,
    data,
  });
};

export const sendError = (reply: FastifyReply, message: string, code = 400, details?: any) => {
  return reply.code(code).send({
    success: false,
    error: message,
    details,
  });
};

/**
 * 同步服务占位（P2）。
 * 职责：账号、端到端加密同步、托管额度。技术方向为 Fastify + PostgreSQL。
 * 实现归后端工程师，部署与监控归运维。不开同步时客户端必须能完整使用。
 */
export const packageId = '@ai-notes/server' as const;

export const stage = 'p2' as const;

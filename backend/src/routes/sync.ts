import { FastifyPluginAsync } from 'fastify';
import { TodoistService } from '../services/todoist';
import { SyncRequestSchema } from '../schemas/task';

const syncRoutes: FastifyPluginAsync = async (fastify) => {
  // Sync endpoint
  fastify.post('/', {
    schema: {
      body: SyncRequestSchema,
    },
  }, async (request, reply) => {
    try {
      const { direction, entityType } = request.body as any;
      const todoistToken = process.env.TODOIST_API_TOKEN;

      if (!todoistToken) {
        reply.code(500);
        return { error: 'Todoist API token not configured' };
      }

      const todoistService = new TodoistService(todoistToken);
      const results: any[] = [];

      switch (direction) {
        case 'FROM_TODOIST':
          // Sync from Todoist to local database
          if (entityType === 'projects' || entityType === 'all') {
            const projectResults = await todoistService.syncProjectsFromTodoist();
            results.push(...projectResults);
          }
          if (entityType === 'tasks' || entityType === 'all') {
            const taskResults = await todoistService.syncTasksFromTodoist();
            results.push(...taskResults);
          }
          break;

        case 'TO_TODOIST':
          // Upload local changes to Todoist
          const uploadResults = await todoistService.uploadToTodoist();
          results.push(...uploadResults);
          break;

        case 'BIDIRECTIONAL':
          // First upload local changes, then sync from Todoist
          const uploadResults2 = await todoistService.uploadToTodoist();
          results.push(...uploadResults2);

          if (entityType === 'projects' || entityType === 'all') {
            const projectResults = await todoistService.syncProjectsFromTodoist();
            results.push(...projectResults);
          }
          if (entityType === 'tasks' || entityType === 'all') {
            const taskResults = await todoistService.syncTasksFromTodoist();
            results.push(...taskResults);
          }
          break;

        default:
          reply.code(400);
          return { error: 'Invalid sync direction' };
      }

      return {
        success: true,
        direction,
        entityType,
        results,
        summary: {
          total: results.length,
          created: results.filter(r => r.action === 'created').length,
          updated: results.filter(r => r.action === 'updated').length,
          errors: results.filter(r => r.action === 'error').length,
        },
      };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { 
        error: 'Sync failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get sync status
  fastify.get('/status', async (request, reply) => {
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      const [projectStats, taskStats, recentLogs] = await Promise.all([
        // Project sync status
        prisma.project.groupBy({
          by: ['syncStatus'],
          _count: {
            syncStatus: true,
          },
        }),
        // Task sync status
        prisma.task.groupBy({
          by: ['syncStatus'],
          _count: {
            syncStatus: true,
          },
        }),
        // Recent sync logs
        prisma.syncLog.findMany({
          orderBy: {
            timestamp: 'desc',
          },
          take: 20,
        }),
      ]);

      return {
        projects: {
          stats: projectStats.reduce((acc: any, stat: any) => {
            acc[stat.syncStatus] = stat._count.syncStatus;
            return acc;
          }, {}),
        },
        tasks: {
          stats: taskStats.reduce((acc: any, stat: any) => {
            acc[stat.syncStatus] = stat._count.syncStatus;
            return acc;
          }, {}),
        },
        recentLogs,
      };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to fetch sync status' };
    }
  });

  // Get sync logs
  fastify.get('/logs', async (request, reply) => {
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      const { entityType, limit = 50, offset = 0 } = request.query as any;

      const where = entityType ? { entityType } : {};

      const [logs, total] = await Promise.all([
        prisma.syncLog.findMany({
          where,
          orderBy: {
            timestamp: 'desc',
          },
          take: parseInt(limit),
          skip: parseInt(offset),
        }),
        prisma.syncLog.count({ where }),
      ]);

      return {
        logs,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to fetch sync logs' };
    }
  });
};

export default syncRoutes;

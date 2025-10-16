import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { CreateProjectSchema, UpdateProjectSchema } from '../schemas/task';

const prisma = new PrismaClient();

const projectRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all projects
  fastify.get('/', async (request, reply) => {
    try {
      const projects = await prisma.project.findMany({
        include: {
          tasks: {
            select: {
              id: true,
              completed: true,
            },
          },
          _count: {
            select: {
              tasks: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      return projects.map((project: any) => ({
        ...project,
        taskCount: project._count.tasks,
        completedCount: project.tasks.filter((t: any) => t.completed).length,
        tasks: undefined,
        _count: undefined,
      }));
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to fetch projects' };
    }
  });

  // Get single project
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      
      const project = await prisma.project.findUnique({
        where: { id },
        include: {
          tasks: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

      if (!project) {
        reply.code(404);
        return { error: 'Project not found' };
      }

      return project;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to fetch project' };
    }
  });

  // Create project
  fastify.post('/', {
    schema: {
      body: CreateProjectSchema,
    },
  }, async (request, reply) => {
    try {
      const data = request.body as any;
      
      const project = await prisma.project.create({
        data: {
          ...data,
          syncStatus: 'PENDING_UPLOAD',
        },
      });

      // Trigger real-time sync if WebSocket service is available
      if ((global as any).syncWebSocketService) {
        (global as any).syncWebSocketService.triggerSyncOnChange().catch(console.error);
      }

      return project;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to create project' };
    }
  });

  // Update project
  fastify.put('/:id', {
    schema: {
      body: UpdateProjectSchema,
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = request.body as any;
      
      const existingProject = await prisma.project.findUnique({
        where: { id },
      });

      if (!existingProject) {
        reply.code(404);
        return { error: 'Project not found' };
      }

      const project = await prisma.project.update({
        where: { id },
        data: {
          ...data,
          syncStatus: 'PENDING_UPLOAD',
        },
      });

      // Trigger real-time sync if WebSocket service is available
      if ((global as any).syncWebSocketService) {
        (global as any).syncWebSocketService.triggerSyncOnChange().catch(console.error);
      }

      return project;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to update project' };
    }
  });

  // Delete project
  fastify.delete('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      
      const existingProject = await prisma.project.findUnique({
        where: { id },
      });

      if (!existingProject) {
        reply.code(404);
        return { error: 'Project not found' };
      }

      await prisma.project.delete({
        where: { id },
      });

      return { message: 'Project deleted successfully' };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to delete project' };
    }
  });
};

export default projectRoutes;

import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { CreateTaskSchema, UpdateTaskSchema } from '../schemas/task';

// Global reference to WebSocket service for triggering real-time sync
let globalSyncWebSocketService: any;

const prisma = new PrismaClient();

const taskRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all tasks
  fastify.get('/', async (request, reply) => {
    try {
      const { projectId } = request.query as { projectId?: string };

      const where = projectId ? { projectId } : {};

      const tasks = await prisma.task.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
          children: {
            include: {
              project: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
            },
          },
          assignedDays: {
            include: {
              day: {
                include: {
                  week: {
                    include: {
                      year: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      return tasks;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to fetch tasks' };
    }
  });

  // Get single task
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const task = await prisma.task.findUnique({
        where: { id },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
          parent: {
            select: {
              id: true,
              text: true,
            },
          },
          children: {
            include: {
              project: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
            },
          },
          assignedDays: {
            include: {
              day: {
                include: {
                  week: {
                    include: {
                      year: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!task) {
        reply.code(404);
        return { error: 'Task not found' };
      }

      return task;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to fetch task' };
    }
  });

  // Create task
  fastify.post('/', {
    schema: {
      body: CreateTaskSchema,
    },
  }, async (request, reply) => {
    try {
      const data = request.body as any;
      
      // Verify project exists
      const project = await prisma.project.findUnique({
        where: { id: data.projectId },
      });

      if (!project) {
        reply.code(404);
        return { error: 'Project not found' };
      }

      const task = await prisma.task.create({
        data: {
          ...data,
          syncStatus: 'PENDING_UPLOAD',
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });

      // Trigger real-time sync if WebSocket service is available
      if ((global as any).syncWebSocketService) {
        (global as any).syncWebSocketService.triggerSyncOnChange().catch(console.error);
      }

      return task;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to create task' };
    }
  });

  // Update task
  fastify.put('/:id', {
    schema: {
      body: UpdateTaskSchema,
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = request.body as any;
      
      const existingTask = await prisma.task.findUnique({
        where: { id },
      });

      if (!existingTask) {
        reply.code(404);
        return { error: 'Task not found' };
      }

      // If changing project, verify new project exists
      if (data.projectId && data.projectId !== existingTask.projectId) {
        const project = await prisma.project.findUnique({
          where: { id: data.projectId },
        });

        if (!project) {
          reply.code(404);
          return { error: 'Project not found' };
        }
      }

      const task = await prisma.task.update({
        where: { id },
        data: {
          ...data,
          syncStatus: 'PENDING_UPLOAD',
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });

      // Trigger real-time sync if WebSocket service is available
      if ((global as any).syncWebSocketService) {
        (global as any).syncWebSocketService.triggerSyncOnChange().catch(console.error);
      }

      return task;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to update task' };
    }
  });

  // Toggle task completion
  fastify.patch('/:id/toggle', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      
      const existingTask = await prisma.task.findUnique({
        where: { id },
      });

      if (!existingTask) {
        reply.code(404);
        return { error: 'Task not found' };
      }

      const task = await prisma.task.update({
        where: { id },
        data: {
          completed: !existingTask.completed,
          syncStatus: 'PENDING_UPLOAD',
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });

      // Trigger real-time sync if WebSocket service is available
      if ((global as any).syncWebSocketService) {
        (global as any).syncWebSocketService.triggerSyncOnChange().catch(console.error);
      }

      return task;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to toggle task' };
    }
  });

  // Delete task
  fastify.delete('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const existingTask = await prisma.task.findUnique({
        where: { id },
      });

      if (!existingTask) {
        reply.code(404);
        return { error: 'Task not found' };
      }

      await prisma.task.delete({
        where: { id },
      });

      // Trigger real-time sync if WebSocket service is available
      if ((global as any).syncWebSocketService) {
        (global as any).syncWebSocketService.triggerSyncOnChange().catch(console.error);
      }

      return { message: 'Task deleted successfully' };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to delete task' };
    }
  });

  // Assign task to day
  fastify.post('/:id/assign-day', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { dayId } = request.body as { dayId: string };

      const task = await prisma.task.findUnique({
        where: { id },
      });

      if (!task) {
        reply.code(404);
        return { error: 'Task not found' };
      }

      const day = await prisma.day.findUnique({
        where: { id: dayId },
      });

      if (!day) {
        reply.code(404);
        return { error: 'Day not found' };
      }

      // Remove existing assignments
      await prisma.taskOnDay.deleteMany({
        where: { taskId: id },
      });

      // Create new assignment
      const assignment = await prisma.taskOnDay.create({
        data: {
          taskId: id,
          dayId,
        },
      });

      return assignment;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to assign task to day' };
    }
  });

  // Remove task from day
  fastify.delete('/:id/assign-day/:dayId', async (request, reply) => {
    try {
      const { id, dayId } = request.params as { id: string; dayId: string };

      await prisma.taskOnDay.deleteMany({
        where: {
          taskId: id,
          dayId,
        },
      });

      return { message: 'Task removed from day successfully' };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to remove task from day' };
    }
  });

  // Move task to different parent
  fastify.patch('/:id/move', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { parentId, projectId } = request.body as { parentId?: string; projectId?: string };

      const task = await prisma.task.findUnique({
        where: { id },
      });

      if (!task) {
        reply.code(404);
        return { error: 'Task not found' };
      }

      // Verify parent exists if provided
      if (parentId) {
        const parent = await prisma.task.findUnique({
          where: { id: parentId },
        });

        if (!parent) {
          reply.code(404);
          return { error: 'Parent task not found' };
        }
      }

      // Verify project exists if provided
      if (projectId) {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
        });

        if (!project) {
          reply.code(404);
          return { error: 'Project not found' };
        }
      }

      const updatedTask = await prisma.task.update({
        where: { id },
        data: {
          parentId,
          projectId,
          syncStatus: 'PENDING_UPLOAD',
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });

      return updatedTask;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to move task' };
    }
  });
};

export default taskRoutes;

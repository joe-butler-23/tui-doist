import { TodoistApi } from '@doist/todoist-api-typescript';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class TodoistService {
  private api: TodoistApi;

  constructor(apiToken: string) {
    // Clean the token (remove any Bearer prefix if present)
    const cleanToken = apiToken.replace(/^Bearer\s+/i, '').trim();
    console.log('Initializing Todoist API with cleaned token');
    this.api = new TodoistApi(cleanToken);
  }

  // Sync projects from Todoist
  async syncProjectsFromTodoist() {
    try {
      console.log('Fetching Todoist projects...');
      const response = await this.api.getProjects();
      console.log('Todoist projects response:', response);

      // Handle new API response format: { results: [...], nextCursor: null }
      let todoistProjects: any[] = [];
      if (Array.isArray(response)) {
        todoistProjects = response;
      } else if (response && response.results && Array.isArray(response.results)) {
        todoistProjects = response.results;
      } else {
        throw new Error(`Invalid response from Todoist API: expected array or object with results array, got ${typeof response}`);
      }

      const syncResults = [];

      for (const todoistProject of todoistProjects) {
        const existingProject = await prisma.project.findUnique({
          where: { todoistId: todoistProject.id },
        });

        if (existingProject) {
          // Update existing project
          const updatedProject = await prisma.project.update({
            where: { id: existingProject.id },
            data: {
              name: todoistProject.name,
              syncStatus: 'SYNCED',
            },
          });

          await this.logSync({
            entityType: 'project',
            entityId: existingProject.id,
            action: 'UPDATE',
            direction: 'FROM_TODOIST',
            todoistId: todoistProject.id,
          });

          syncResults.push({ action: 'updated', project: updatedProject });
        } else {
          // Create new project
          const newProject = await prisma.project.create({
            data: {
              name: todoistProject.name,
              color: this.mapTodoistColor(todoistProject.color),
              todoistId: todoistProject.id,
              syncStatus: 'SYNCED',
            },
          });

          await this.logSync({
            entityType: 'project',
            entityId: newProject.id,
            action: 'CREATE',
            direction: 'FROM_TODOIST',
            todoistId: todoistProject.id,
          });

          syncResults.push({ action: 'created', project: newProject });
        }
      }

      return syncResults;
    } catch (error) {
      console.error('Error syncing projects from Todoist:', error);
      throw error;
    }
  }

  // Sync tasks from Todoist
  async syncTasksFromTodoist() {
    try {
      console.log('Fetching Todoist tasks...');
      const response = await this.api.getTasks();
      console.log('Todoist tasks response type:', typeof response);
      console.log('Todoist tasks response:', response);

      // Handle different response types
      let tasksArray: any[] = [];
      if (Array.isArray(response)) {
        tasksArray = response;
      } else if (response && typeof response === 'object') {
        // Handle new API response format: { results: [...], nextCursor: null }
        tasksArray = response.results || [];
      }

      if (!Array.isArray(tasksArray)) {
        throw new Error(`Invalid tasks response from Todoist API: expected array, got ${typeof tasksArray}`);
      }

      const syncResults = [];

      for (const todoistTask of tasksArray) {
        // Find corresponding project
        const project = await prisma.project.findUnique({
          where: { todoistId: todoistTask.projectId },
        });

        if (!project) {
          console.warn(`Project not found for Todoist task ${todoistTask.id}`);
          continue;
        }

        const existingTask = await prisma.task.findUnique({
          where: { todoistId: todoistTask.id },
        });

        const taskData = {
          text: todoistTask.content,
          completed: todoistTask.isCompleted,
          priority: this.mapTodoistPriority(todoistTask.priority),
          notes: todoistTask.description || '',
          dueDate: todoistTask.due?.datetime ? new Date(todoistTask.due.datetime) : null,
          projectId: project.id,
        };

        if (existingTask) {
          // Update existing task
          const updatedTask = await prisma.task.update({
            where: { id: existingTask.id },
            data: {
              ...taskData,
              syncStatus: 'SYNCED',
            },
          });

          await this.logSync({
            entityType: 'task',
            entityId: existingTask.id,
            action: 'UPDATE',
            direction: 'FROM_TODOIST',
            todoistId: todoistTask.id,
          });

          syncResults.push({ action: 'updated', task: updatedTask });
        } else {
          // Create new task
          const newTask = await prisma.task.create({
            data: {
              ...taskData,
              todoistId: todoistTask.id,
              syncStatus: 'SYNCED',
            },
          });

          await this.logSync({
            entityType: 'task',
            entityId: newTask.id,
            action: 'CREATE',
            direction: 'FROM_TODOIST',
            todoistId: todoistTask.id,
          });

          syncResults.push({ action: 'created', task: newTask });
        }
      }

      return syncResults;
    } catch (error) {
      console.error('Error syncing tasks from Todoist:', error);
      throw error;
    }
  }

  // Upload local changes to Todoist
  async uploadToTodoist() {
    try {
      const results = [];

      // Upload pending projects
      const pendingProjects = await prisma.project.findMany({
        where: { syncStatus: 'PENDING_UPLOAD' },
      });

      for (const project of pendingProjects) {
        try {
          if (project.todoistId) {
            // Update existing project
            await this.api.updateProject(project.todoistId, {
              name: project.name,
            });

            await this.logSync({
              entityType: 'project',
              entityId: project.id,
              action: 'UPDATE',
              direction: 'TO_TODOIST',
              todoistId: project.todoistId,
            });
          } else {
            // Create new project
            const todoistProject = await this.api.addProject({
              name: project.name,
            });

            await prisma.project.update({
              where: { id: project.id },
              data: {
                todoistId: todoistProject.id,
                syncStatus: 'SYNCED',
              },
            });

            await this.logSync({
              entityType: 'project',
              entityId: project.id,
              action: 'CREATE',
              direction: 'TO_TODOIST',
              todoistId: todoistProject.id,
            });
          }

          await prisma.project.update({
            where: { id: project.id },
            data: { syncStatus: 'SYNCED' },
          });

          results.push({ type: 'project', action: 'uploaded', id: project.id });
        } catch (error) {
          await prisma.project.update({
            where: { id: project.id },
            data: { syncStatus: 'ERROR' },
          });

          await this.logSync({
            entityType: 'project',
            entityId: project.id,
            action: 'UPDATE',
            direction: 'TO_TODOIST',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });

          results.push({ type: 'project', action: 'error', id: project.id, error });
        }
      }

      // Upload pending tasks
      const pendingTasks = await prisma.task.findMany({
        where: { syncStatus: 'PENDING_UPLOAD' },
        include: { project: true },
      });

      for (const task of pendingTasks) {
        try {
          if (!task.project.todoistId) {
            console.warn(`Project ${task.projectId} not synced to Todoist, skipping task ${task.id}`);
            continue;
          }

          const taskData = {
            content: task.text,
            projectId: task.project.todoistId,
            description: task.notes || '',
            priority: this.mapToTodoistPriority(task.priority),
            dueDate: task.dueDate ? task.dueDate.toISOString().split('T')[0] : undefined,
          };

          if (task.todoistId) {
            // Update existing task
            await this.api.updateTask(task.todoistId, taskData);

            // Handle completion status separately
            if (task.completed) {
              await this.api.closeTask(task.todoistId);
            } else {
              await this.api.reopenTask(task.todoistId);
            }

            await this.logSync({
              entityType: 'task',
              entityId: task.id,
              action: 'UPDATE',
              direction: 'TO_TODOIST',
              todoistId: task.todoistId,
            });
          } else {
            // Create new task
            const todoistTask = await this.api.addTask(taskData);

            await prisma.task.update({
              where: { id: task.id },
              data: {
                todoistId: todoistTask.id,
                syncStatus: 'SYNCED',
              },
            });

            await this.logSync({
              entityType: 'task',
              entityId: task.id,
              action: 'CREATE',
              direction: 'TO_TODOIST',
              todoistId: todoistTask.id,
            });
          }

          await prisma.task.update({
            where: { id: task.id },
            data: { syncStatus: 'SYNCED' },
          });

          results.push({ type: 'task', action: 'uploaded', id: task.id });
        } catch (error) {
          await prisma.task.update({
            where: { id: task.id },
            data: { syncStatus: 'ERROR' },
          });

          await this.logSync({
            entityType: 'task',
            entityId: task.id,
            action: 'UPDATE',
            direction: 'TO_TODOIST',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });

          results.push({ type: 'task', action: 'error', id: task.id, error });
        }
      }

      return results;
    } catch (error) {
      console.error('Error uploading to Todoist:', error);
      throw error;
    }
  }

  private async logSync(data: {
    entityType: string;
    entityId: string;
    action: string;
    direction: string;
    todoistId?: string;
    errorMessage?: string;
  }) {
    await prisma.syncLog.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        action: data.action as any,
        direction: data.direction as any,
        todoistId: data.todoistId,
        errorMessage: data.errorMessage,
        ...(data.entityType === 'project'
          ? { projectId: data.entityId }
          : { taskId: data.entityId }
        ),
      },
    });
  }

  private mapTodoistColor(todoistColor: string | number): string {
    const colorMap: { [key: string]: string } = {
      'berry_red': 'red',
      'red': 'red',
      'orange': 'orange',
      'yellow': 'yellow',
      'olive_green': 'green',
      'green': 'green',
      'teal': 'blue',
      'blue': 'blue',
      'purple': 'purple',
      'pink': 'purple',
      'brown': 'gray',
      'gray': 'gray',
      'charcoal': 'gray',
      'grey': 'gray',
      // Legacy numeric codes
      30: 'red',
      31: 'orange',
      32: 'yellow',
      33: 'green',
      34: 'blue',
      35: 'purple',
      36: 'pink',
      37: 'brown',
      38: 'gray',
      39: 'gray',
    };
    return colorMap[todoistColor.toString()] || 'blue';
  }

  private mapTodoistPriority(todoistPriority: number): number {
    // Todoist: P4=1, P3=2, P2=3, P1=4
    // Our system: P1=1, P2=2, P3=3, P4=4
    return 5 - todoistPriority;
  }

  private mapToTodoistPriority(priority: number): number {
    // Our system: P1=1, P2=2, P3=3, P4=4
    // Todoist: P4=1, P3=2, P2=3, P1=4
    return 5 - priority;
  }
}

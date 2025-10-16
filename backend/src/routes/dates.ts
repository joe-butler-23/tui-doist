import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const dateRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all years
  fastify.get('/years', async (request, reply) => {
    try {
      const years = await prisma.year.findMany({
        include: {
          weeks: {
            include: {
              days: {
                include: {
                  tasks: {
                    include: {
                      task: {
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
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          year: 'asc',
        },
      });

      return years;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to fetch years' };
    }
  });

  // Get or create year
  fastify.get('/years/:year', async (request, reply) => {
    try {
      const { year } = request.params as { year: string };
      const yearNum = parseInt(year);

      let yearRecord = await prisma.year.findUnique({
        where: { year: yearNum },
        include: {
          weeks: {
            include: {
              days: {
                include: {
                  tasks: {
                    include: {
                      task: {
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
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!yearRecord) {
        yearRecord = await prisma.year.create({
          data: {
            year: yearNum,
          },
          include: {
            weeks: {
              include: {
                days: {
                  include: {
                    tasks: {
                      include: {
                        task: {
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
                      },
                    },
                  },
                },
              },
            },
          },
        });
      }

      return yearRecord;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to fetch or create year' };
    }
  });

  // Get or create week for specific year
  fastify.get('/years/:year/weeks/:weekNumber', async (request, reply) => {
    try {
      const { year, weekNumber } = request.params as { year: string; weekNumber: string };
      const yearNum = parseInt(year);
      const weekNum = parseInt(weekNumber);

      // Calculate start and end dates for the week
      const startDate = new Date(yearNum, 0, 1 + (weekNum - 1) * 7);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);

      let weekRecord = await prisma.week.findUnique({
        where: {
          yearId_weekNumber: {
            yearId: `${yearNum}`,
            weekNumber: weekNum,
          },
        },
        include: {
          year: true,
          days: {
            include: {
              tasks: {
                include: {
                  task: {
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
                },
              },
            },
          },
        },
      });

      if (!weekRecord) {
        // Ensure year exists
        let yearRecord = await prisma.year.findUnique({
          where: { year: yearNum },
        });

        if (!yearRecord) {
          yearRecord = await prisma.year.create({
            data: { year: yearNum },
          });
        }

        weekRecord = await prisma.week.create({
          data: {
            yearId: yearRecord.id,
            weekNumber: weekNum,
            startDate,
            endDate,
          },
          include: {
            year: true,
            days: {
              include: {
                tasks: {
                  include: {
                    task: {
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
                  },
                },
              },
            },
          },
        });
      }

      return weekRecord;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to fetch or create week' };
    }
  });

  // Get or create day for specific week
  fastify.get('/weeks/:weekId/days/:date', async (request, reply) => {
    try {
      const { weekId, date } = request.params as { weekId: string; date: string };
      const dayDate = new Date(date);

      let dayRecord = await prisma.day.findUnique({
        where: { date: dayDate },
        include: {
          week: {
            include: {
              year: true,
            },
          },
          tasks: {
            include: {
              task: {
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
            },
          },
        },
      });

      if (!dayRecord) {
        dayRecord = await prisma.day.create({
          data: {
            weekId,
            date: dayDate,
          },
          include: {
            week: {
              include: {
                year: true,
              },
            },
            tasks: {
              include: {
                task: {
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
              },
            },
          },
        });
      }

      return dayRecord;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to fetch or create day' };
    }
  });

  // Get tasks for a specific day
  fastify.get('/days/:dayId/tasks', async (request, reply) => {
    try {
      const { dayId } = request.params as { dayId: string };

      const dayWithTasks = await prisma.day.findUnique({
        where: { id: dayId },
        include: {
          tasks: {
            include: {
              task: {
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
            },
          },
        },
      });

      if (!dayWithTasks) {
        reply.code(404);
        return { error: 'Day not found' };
      }

      return dayWithTasks.tasks.map((tod: any) => tod.task);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: 'Failed to fetch day tasks' };
    }
  });
};

export default dateRoutes;

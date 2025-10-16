import { Type } from '@sinclair/typebox';

export const CreateProjectSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  color: Type.String({ default: 'blue' }),
});

export const UpdateProjectSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  color: Type.Optional(Type.String()),
  todoistId: Type.Optional(Type.String()),
});

export const CreateTaskSchema = Type.Object({
  text: Type.String({ minLength: 1, maxLength: 500 }),
  projectId: Type.String(),
  priority: Type.Integer({ minimum: 1, maximum: 4, default: 2 }),
  notes: Type.String({ default: '' }),
  dueDate: Type.Optional(Type.String({ format: 'date-time' })),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export const UpdateTaskSchema = Type.Object({
  text: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
  completed: Type.Optional(Type.Boolean()),
  priority: Type.Optional(Type.Integer({ minimum: 1, maximum: 4 })),
  notes: Type.Optional(Type.String()),
  dueDate: Type.Optional(Type.String({ format: 'date-time' })),
  projectId: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export const SyncRequestSchema = Type.Object({
  direction: Type.Union([Type.Literal('TO_TODOIST'), Type.Literal('FROM_TODOIST'), Type.Literal('BIDIRECTIONAL')]),
  entityType: Type.Union([Type.Literal('projects'), Type.Literal('tasks'), Type.Literal('all')], { default: 'all' }),
});

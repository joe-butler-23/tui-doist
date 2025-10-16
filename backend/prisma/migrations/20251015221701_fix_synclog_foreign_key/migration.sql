-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_sync_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "todoistId" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorMessage" TEXT,
    "projectId" TEXT,
    "taskId" TEXT,
    CONSTRAINT "sync_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sync_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_sync_logs" ("action", "direction", "entityId", "entityType", "errorMessage", "id", "timestamp", "todoistId") SELECT "action", "direction", "entityId", "entityType", "errorMessage", "id", "timestamp", "todoistId" FROM "sync_logs";
DROP TABLE "sync_logs";
ALTER TABLE "new_sync_logs" RENAME TO "sync_logs";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

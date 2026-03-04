-- CreateTable
CREATE TABLE "event_mocks" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "mockType" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "request" JSONB,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_mocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replay_history" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "duration" INTEGER NOT NULL,
    "differences" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "replay_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snapshots" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "database" TEXT NOT NULL,
    "tables" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_mocks_eventId_idx" ON "event_mocks"("eventId");

-- CreateIndex
CREATE INDEX "event_mocks_projectId_mockType_idx" ON "event_mocks"("projectId", "mockType");

-- CreateIndex
CREATE INDEX "replay_history_eventId_idx" ON "replay_history"("eventId");

-- CreateIndex
CREATE INDEX "replay_history_projectId_createdAt_idx" ON "replay_history"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "replay_history_userId_idx" ON "replay_history"("userId");

-- CreateIndex
CREATE INDEX "snapshots_eventId_idx" ON "snapshots"("eventId");

-- CreateIndex
CREATE INDEX "snapshots_projectId_createdAt_idx" ON "snapshots"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "replay_history" ADD CONSTRAINT "replay_history_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replay_history" ADD CONSTRAINT "replay_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "googleCalendarClientId" TEXT,
    "googleCalendarClientSecret" TEXT,
    "googleCalendarRedirectUri" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

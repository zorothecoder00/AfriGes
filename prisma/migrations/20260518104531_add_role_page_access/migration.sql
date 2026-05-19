-- CreateTable
CREATE TABLE "RolePageAccess" (
    "id" SERIAL NOT NULL,
    "role" "RoleGestionnaire" NOT NULL,
    "pageKey" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePageAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RolePageAccess_role_idx" ON "RolePageAccess"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RolePageAccess_role_pageKey_key" ON "RolePageAccess"("role", "pageKey");

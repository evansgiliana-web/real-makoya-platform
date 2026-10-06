-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'FIELD_AGENT', 'CLIENT');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('REGISTERED', 'PENDING', 'UNREGISTERED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('FORMAL_WHOLESALER', 'INFORMAL_BULK_BUYER', 'UNVERIFIED_SUPPLIER', 'MIXED');

-- CreateEnum
CREATE TYPE "CounterfeitRisk" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CONFIRMED_COUNTERFEIT');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "InternetConnectivity" AS ENUM ('NONE', 'MOBILE_DATA', 'WIFI', 'FIBER', 'UNKNOWN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orgRole" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "allBrandsAccess" BOOLEAN NOT NULL DEFAULT true,
    "brandIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tradingAs" TEXT,
    "address" TEXT NOT NULL,
    "town" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "ownerName" TEXT NOT NULL,
    "ownerContactNumber" TEXT,
    "ownerIdOrCompanyRegNumber" TEXT,
    "municipalRegistrationStatus" "RegistrationStatus" NOT NULL DEFAULT 'UNKNOWN',
    "municipalRegistrationNumber" TEXT,
    "registrationNotes" TEXT,
    "storeTelephoneNumber" TEXT,
    "storePhotoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ownerConsentGiven" BOOLEAN NOT NULL DEFAULT false,
    "ownerConsentAt" TIMESTAMP(3),
    "ownerConsentById" TEXT,
    "piiRedacted" BOOLEAN NOT NULL DEFAULT false,
    "piiRedactedAt" TIMESTAMP(3),
    "piiRedactedById" TEXT,
    "nextVisitDue" TIMESTAMP(3),
    "visitCadenceDays" INTEGER NOT NULL DEFAULT 90,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedBy" TEXT NOT NULL,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNotes" TEXT,
    "sourceType" "SourceType" NOT NULL,
    "supplierName" TEXT,
    "supplierLocation" TEXT,
    "distributionNotes" TEXT,
    "hasValidCoA" BOOLEAN NOT NULL DEFAULT false,
    "coaNotes" TEXT,
    "hasHealthPermit" BOOLEAN NOT NULL DEFAULT false,
    "healthPermitNumber" TEXT,
    "healthPermitExpiry" TIMESTAMP(3),
    "brandAuthenticityVerified" BOOLEAN NOT NULL DEFAULT false,
    "complianceNotes" TEXT,
    "counterfeitRisk" "CounterfeitRisk" NOT NULL DEFAULT 'NONE',
    "packagingIssueFlag" BOOLEAN NOT NULL DEFAULT false,
    "batchCodeIssueFlag" BOOLEAN NOT NULL DEFAULT false,
    "pricingAnomalyFlag" BOOLEAN NOT NULL DEFAULT false,
    "counterfeitNotes" TEXT,
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "totalSkuCount" INTEGER,
    "estimatedMonthlyTurnoverZar" DOUBLE PRECISION,
    "packingShelvesCount" INTEGER,
    "posInstalled" BOOLEAN NOT NULL DEFAULT false,
    "posBrand" TEXT,
    "posModel" TEXT,
    "posPhotoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "internetConnectivity" "InternetConnectivity" NOT NULL DEFAULT 'UNKNOWN',
    "scannerInstalled" BOOLEAN NOT NULL DEFAULT false,
    "scannerDetails" TEXT,
    "equipmentPhotoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductLine" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "rank" INTEGER,
    "estimatedMonthlyUnits" INTEGER,
    "estimatedUnitPriceZar" DOUBLE PRECISION,
    "notes" TEXT,
    "brandId" TEXT,

    CONSTRAINT "ProductLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "metaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_organizationId_name_key" ON "Brand"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMembership_userId_organizationId_key" ON "OrgMembership"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductLine" ADD CONSTRAINT "ProductLine_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductLine" ADD CONSTRAINT "ProductLine_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

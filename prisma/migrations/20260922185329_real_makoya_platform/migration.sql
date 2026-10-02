-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'FIELD_AGENT', 'CLIENT');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('REGISTERED', 'PENDING', 'UNREGISTERED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('FORMAL_WHOLESALER', 'INFORMAL_BULK_BUYER', 'UNVERIFIED_SUPPLIER', 'MIXED');

-- CreateEnum
CREATE TYPE "CounterfeitRisk" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CONFIRMED_COUNTERFEIT');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED', 'FLAGGED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "companyName" TEXT,
    "allBrandsAccess" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "invitedById" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,

    CONSTRAINT "BrandAccess_pkey" PRIMARY KEY ("id")
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
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'SUBMITTED',
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
    "notes" TEXT,

    CONSTRAINT "ProductLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BrandAccess_userId_brandName_key" ON "BrandAccess"("userId", "brandName");

-- AddForeignKey
ALTER TABLE "BrandAccess" ADD CONSTRAINT "BrandAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductLine" ADD CONSTRAINT "ProductLine_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "InternetConnectivity" AS ENUM ('NONE', 'MOBILE_DATA', 'WIFI', 'FIBER', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "equipmentPhotoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "estimatedMonthlyTurnoverZar" DOUBLE PRECISION,
ADD COLUMN     "internetConnectivity" "InternetConnectivity" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "packingShelvesCount" INTEGER,
ADD COLUMN     "posBrand" TEXT,
ADD COLUMN     "posInstalled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "posModel" TEXT,
ADD COLUMN     "posPhotoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "scannerDetails" TEXT,
ADD COLUMN     "scannerInstalled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totalSkuCount" INTEGER;

-- AlterTable
ALTER TABLE "ProductLine" ADD COLUMN     "estimatedUnitPriceZar" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "storePhotoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "storeTelephoneNumber" TEXT;

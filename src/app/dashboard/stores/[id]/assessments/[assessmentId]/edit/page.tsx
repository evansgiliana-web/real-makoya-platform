import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import AssessmentForm from "@/components/AssessmentForm";

export default async function EditAssessmentPage({
  params,
}: {
  params: { id: string; assessmentId: string };
}) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: params.assessmentId },
    include: { productLines: true, store: true },
  });
  if (!assessment || assessment.storeId !== params.id) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-900 mb-1">
        Edit Assessment — {assessment.store.name}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Visit date: {assessment.visitDate.toISOString().slice(0, 10)} · Status:{" "}
        {assessment.status}
      </p>
      <AssessmentForm
        storeId={assessment.storeId}
        initial={{
          id: assessment.id,
          storeId: assessment.storeId,
          productLines: assessment.productLines,
          sourceType: assessment.sourceType,
          supplierName: assessment.supplierName,
          supplierLocation: assessment.supplierLocation,
          distributionNotes: assessment.distributionNotes,
          hasValidCoA: assessment.hasValidCoA,
          coaNotes: assessment.coaNotes,
          hasHealthPermit: assessment.hasHealthPermit,
          healthPermitNumber: assessment.healthPermitNumber,
          healthPermitExpiry: assessment.healthPermitExpiry?.toISOString().slice(0, 10) ?? null,
          brandAuthenticityVerified: assessment.brandAuthenticityVerified,
          complianceNotes: assessment.complianceNotes,
          counterfeitRisk: assessment.counterfeitRisk,
          packagingIssueFlag: assessment.packagingIssueFlag,
          batchCodeIssueFlag: assessment.batchCodeIssueFlag,
          pricingAnomalyFlag: assessment.pricingAnomalyFlag,
          counterfeitNotes: assessment.counterfeitNotes,
          packingShelvesCount: assessment.packingShelvesCount,
          posInstalled: assessment.posInstalled,
          posBrand: assessment.posBrand,
          posModel: assessment.posModel,
          posPhotoUrls: assessment.posPhotoUrls,
          internetConnectivity: assessment.internetConnectivity,
          scannerInstalled: assessment.scannerInstalled,
          scannerDetails: assessment.scannerDetails,
          equipmentPhotoUrls: assessment.equipmentPhotoUrls,
          totalSkuCount: assessment.totalSkuCount,
          estimatedMonthlyTurnoverZar: assessment.estimatedMonthlyTurnoverZar,
          internalNotes: assessment.internalNotes,
          photoUrls: assessment.photoUrls,
        }}
      />
    </div>
  );
}

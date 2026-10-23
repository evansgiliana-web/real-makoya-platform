import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import StoreForm from "@/components/StoreForm";
import { requireAgency } from "@/lib/guards";

export default async function EditStorePage({ params }: { params: { id: string } }) {
  await requireAgency();
  const store = await prisma.store.findUnique({
    where: { id: params.id },
    include: { images: true },
  });
  if (!store) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-900 mb-1">Edit Store</h1>
      <p className="text-sm text-gray-500 mb-6">
        {store.name} — {store.town}, {store.province}
      </p>
      <StoreForm
        initial={{
          id: store.id,
          name: store.name,
          tradingAs: store.tradingAs,
          address: store.address,
          town: store.town,
          province: store.province,
          latitude: store.latitude,
          longitude: store.longitude,
          ownerName: store.ownerName,
          ownerContactNumber: store.ownerContactNumber,
          ownerIdOrCompanyRegNumber: store.ownerIdOrCompanyRegNumber,
          municipalRegistrationStatus: store.municipalRegistrationStatus,
          municipalRegistrationNumber: store.municipalRegistrationNumber,
          registrationNotes: store.registrationNotes,
          storeTelephoneNumber: store.storeTelephoneNumber,
          storePhotoUrls: store.storePhotoUrls,
          images: store.images.map((img) => ({
            category: img.category,
            url: img.url,
          })),
          ownerConsentGiven: store.ownerConsentGiven,
          ownerConsentDocumentUrl: store.ownerConsentDocumentUrl,
          municipalRegistrationDocumentUrl: store.municipalRegistrationDocumentUrl,
          ownershipDocumentUrl: store.ownershipDocumentUrl,
          businessLicenseDocumentUrl: store.businessLicenseDocumentUrl,
          visitCadenceDays: store.visitCadenceDays,
          nextVisitDue: store.nextVisitDue?.toISOString() ?? null,
          piiRedacted: store.piiRedacted,
        }}
      />
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import StoreForm from "@/components/StoreForm";

export default async function EditStorePage({ params }: { params: { id: string } }) {
  const store = await prisma.store.findUnique({ where: { id: params.id } });
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
          ownerConsentGiven: store.ownerConsentGiven,
          visitCadenceDays: store.visitCadenceDays,
          nextVisitDue: store.nextVisitDue?.toISOString() ?? null,
          piiRedacted: store.piiRedacted,
        }}
      />
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import AssessmentForm from "@/components/AssessmentForm";

export default async function AssessPage({ params }: { params: { id: string } }) {
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-900 mb-1">New Assessment — {store.name}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {store.address}, {store.town}, {store.province}
      </p>
      <AssessmentForm storeId={store.id} />
    </div>
  );
}

import StoreForm from "@/components/StoreForm";

export default function NewStorePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-900 mb-1">Capture New Store</h1>
      <p className="text-sm text-gray-500 mb-6">
        Step 1 of 2 — ownership & registration. You'll capture product lines,
        distribution, compliance and counterfeit screening next.
      </p>
      <StoreForm />
    </div>
  );
}

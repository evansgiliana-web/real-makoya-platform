import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import StoreMapClient from "@/components/StoreMapClient";
import ReviewButton from "@/components/ReviewButton";
import RedactPiiButton from "@/components/RedactPiiButton";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";

const regStyles: Record<string, string> = {
  REGISTERED: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  UNREGISTERED: "bg-red-100 text-red-700",
  UNKNOWN: "bg-gray-100 text-gray-700",
};

const riskStyles: Record<string, string> = {
  NONE: "bg-green-100 text-green-700",
  LOW: "bg-yellow-100 text-yellow-700",
  MEDIUM: "bg-orange-100 text-orange-700",
  HIGH: "bg-red-100 text-red-700",
  CONFIRMED_COUNTERFEIT: "bg-red-600 text-white",
};

const statusStyles: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SUBMITTED: "bg-blue-100 text-blue-700",
  REVIEWED: "bg-green-100 text-green-700",
  FLAGGED: "bg-red-100 text-red-700",
};

export default async function StoreDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const store = await prisma.store.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true } },
      assessments: {
        orderBy: { visitDate: "desc" },
        include: { productLines: true, agent: { select: { name: true } } },
      },
    },
  });

  if (!store) notFound();

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: "Store", entityId: store.id },
        {
          entityType: "Assessment",
          entityId: { in: store.assessments.map((a) => a.id) },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const canReview = session && can(session.user.role, "assessment:review");
  const canRedact = session && can(session.user.role, "store:redact-pii");
  const canEdit = session && can(session.user.role, "store:edit");

  const overdue =
    store.nextVisitDue && new Date(store.nextVisitDue) < new Date()
      ? true
      : false;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">{store.name}</h1>
          <p className="text-sm text-gray-500">
            {store.address}, {store.town}, {store.province}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Link
              href={`/dashboard/stores/${store.id}/edit`}
              className="btn-secondary text-sm"
            >
              Edit store
            </Link>
          )}
          <Link href={`/dashboard/stores/${store.id}/assess`} className="btn-primary text-sm">
            + New Assessment
          </Link>
        </div>
      </div>

      {/* Cadence banner */}
      <div
        className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
          overdue
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-gray-200 bg-gray-50 text-gray-700"
        }`}
      >
        <span className="font-medium">Next visit due: </span>
        {store.nextVisitDue
          ? new Date(store.nextVisitDue).toLocaleDateString("en-ZA")
          : "Not set"}
        {overdue && " — OVERDUE"}
        <span className="text-gray-500 ml-2">
          (cadence: every {store.visitCadenceDays || 90} days)
        </span>
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-brand-900">Ownership & Registration</h2>
          {canRedact && (
            <RedactPiiButton storeId={store.id} alreadyRedacted={store.piiRedacted} />
          )}
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Owner</dt>
            <dd className="font-medium">{store.ownerName}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Owner Contact</dt>
            <dd className="font-medium">
              {store.piiRedacted ? (
                <span className="text-gray-400 italic">Redacted</span>
              ) : (
                store.ownerContactNumber || "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Owner ID / Reg No.</dt>
            <dd className="font-medium">
              {store.piiRedacted ? (
                <span className="text-gray-400 italic">Redacted</span>
              ) : (
                store.ownerIdOrCompanyRegNumber || "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Store Telephone</dt>
            <dd className="font-medium">
              {store.piiRedacted ? (
                <span className="text-gray-400 italic">Redacted</span>
              ) : (
                store.storeTelephoneNumber || "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">GPS Location</dt>
            <dd className="font-medium">
              {store.latitude && store.longitude
                ? `${store.latitude.toFixed(5)}, ${store.longitude.toFixed(5)}`
                : "Not captured"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Municipal Registration</dt>
            <dd>
              <span className={`badge ${regStyles[store.municipalRegistrationStatus]}`}>
                {store.municipalRegistrationStatus}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Registration No.</dt>
            <dd className="font-medium">{store.municipalRegistrationNumber || "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">POPIA Consent</dt>
            <dd className="font-medium">
              {store.ownerConsentGiven ? (
                <span className="text-green-700">
                  Given
                  {store.ownerConsentAt
                    ? ` · ${new Date(store.ownerConsentAt).toLocaleDateString("en-ZA")}`
                    : ""}
                </span>
              ) : (
                <span className="text-red-600">Not recorded</span>
              )}
            </dd>
          </div>
          {store.registrationNotes && (
            <div className="col-span-2">
              <dt className="text-gray-500">Notes</dt>
              <dd>{store.registrationNotes}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-brand-900 mb-3">Location</h2>
        <StoreMapClient
          stores={[
            {
              id: store.id,
              name: store.name,
              town: store.town,
              province: store.province,
              latitude: store.latitude,
              longitude: store.longitude,
            },
          ]}
        />
      </div>

      {store.storePhotoUrls?.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-brand-900 mb-3">Store Photos</h2>
          <div className="grid grid-cols-4 gap-2">
            {store.storePhotoUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt=""
                className="h-24 w-full object-cover rounded-lg border border-gray-200"
              />
            ))}
          </div>
        </div>
      )}

      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-brand-900 mb-3">
          Assessments ({store.assessments.length})
        </h2>
        {store.assessments.length === 0 ? (
          <p className="text-sm text-gray-500">No assessments yet.</p>
        ) : (
          <div className="space-y-4">
            {store.assessments.map((a) => (
              <div
                key={a.id}
                className="rounded-lg border border-gray-100 p-4 text-sm space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {new Date(a.visitDate).toLocaleDateString("en-ZA")}
                    </span>
                    <span className={`badge ${statusStyles[a.status]}`}>{a.status}</span>
                    <span className={`badge ${riskStyles[a.counterfeitRisk]}`}>
                      {a.counterfeitRisk}
                    </span>
                    <span className="text-gray-500">by {a.agent.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canEdit && (
                      <Link
                        href={`/dashboard/stores/${store.id}/assessments/${a.id}/edit`}
                        className="btn-secondary text-xs"
                      >
                        Edit
                      </Link>
                    )}
                    {canReview && a.status !== "REVIEWED" && (
                      <ReviewButton assessmentId={a.id} currentStatus={a.status} />
                    )}
                    {a.status === "REVIEWED" && (
                      <span className="badge bg-green-100 text-green-700 text-xs">
                        Reviewed ✓
                      </span>
                    )}
                  </div>
                </div>
                {a.productLines.length > 0 && (
                  <p className="text-gray-600">
                    Brands:{" "}
                    {a.productLines
                      .map((p) => p.brand)
                      .slice(0, 6)
                      .join(", ")}
                    {a.productLines.length > 6 ? "…" : ""}
                  </p>
                )}
                {a.counterfeitNotes && (
                  <p className="text-gray-600">Notes: {a.counterfeitNotes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit trail */}
      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-brand-900 mb-3">Audit trail</h2>
        {auditLogs.length === 0 ? (
          <p className="text-sm text-gray-500">No audit events yet for this store.</p>
        ) : (
          <ul className="text-xs space-y-2 max-h-64 overflow-y-auto">
            {auditLogs.map((log) => (
              <li key={log.id} className="flex gap-3 border-b border-gray-50 pb-2">
                <span className="text-gray-400 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString("en-ZA")}
                </span>
                <span className="font-medium text-gray-700">{log.action}</span>
                <span className="text-gray-500">
                  {log.actorEmail || log.actorId || "system"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Created by {store.createdBy.name} ·{" "}
        {new Date(store.createdAt).toLocaleDateString("en-ZA")}
      </p>
    </div>
  );
}

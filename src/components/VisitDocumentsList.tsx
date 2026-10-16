/**
 * Lists downloadable visit documents (CoA, health permit, evidence photos).
 * Safe for client reports when only non-PII URLs are passed.
 */
type Doc = { label: string; url: string };

type Props = {
  title?: string;
  docs: Doc[];
  emptyMessage?: string;
};

export default function VisitDocumentsList({
  title = "Visit documents",
  docs,
  emptyMessage = "No documents uploaded for this visit.",
}: Props) {
  if (docs.length === 0) {
    return (
      <div>
        {title && <h3 className="font-semibold text-brand-900 mb-2">{title}</h3>}
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      {title && <h3 className="font-semibold text-brand-900 mb-2">{title}</h3>}
      <ul className="space-y-2 text-sm">
        {docs.map((d) => {
          const isPdf =
            d.url.toLowerCase().includes(".pdf") || d.url.includes("application/pdf");
          return (
            <li
              key={d.url + d.label}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2"
            >
              <span className="text-gray-700 font-medium min-w-[10rem]">{d.label}</span>
              <a
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="text-brand-700 hover:underline"
              >
                {isPdf ? "Open / download PDF" : "View / download"}
              </a>
              {!isPdf && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={d.url}
                  alt=""
                  className="h-12 w-16 object-cover rounded border border-gray-200 ml-auto"
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Build client-safe compliance docs only (no owner PII). */
export function complianceDocsFromAssessment(a: {
  coaDocumentUrl?: string | null;
  healthPermitDocumentUrl?: string | null;
}): Doc[] {
  const docs: Doc[] = [];
  if (a.coaDocumentUrl) docs.push({ label: "Certificate of Analysis (CoA)", url: a.coaDocumentUrl });
  if (a.healthPermitDocumentUrl)
    docs.push({ label: "Health permit", url: a.healthPermitDocumentUrl });
  return docs;
}

/** Full visit evidence pack for agency store detail. */
export function allVisitDocsFromAssessment(a: {
  coaDocumentUrl?: string | null;
  healthPermitDocumentUrl?: string | null;
  photoUrls?: string[];
  posPhotoUrls?: string[];
  equipmentPhotoUrls?: string[];
}): Doc[] {
  const docs = complianceDocsFromAssessment(a);
  (a.photoUrls || []).forEach((url, i) =>
    docs.push({ label: `Counterfeit evidence ${i + 1}`, url })
  );
  (a.posPhotoUrls || []).forEach((url, i) =>
    docs.push({ label: `POS photo ${i + 1}`, url })
  );
  (a.equipmentPhotoUrls || []).forEach((url, i) =>
    docs.push({ label: `Equipment photo ${i + 1}`, url })
  );
  return docs;
}

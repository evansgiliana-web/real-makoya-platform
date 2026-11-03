import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import TopNav from "@/components/TopNav";

const contactHref =
  "mailto:admin@realmakoya.com?subject=Real%20Makoya%20enquiry";

const pillars = [
  {
    title: "Verify",
    description:
      "Build a clearer picture of township retailers through structured field visits and store records.",
  },
  {
    title: "Partner",
    description:
      "Help FMCG brands and retailers find new opportunities to work together.",
  },
  {
    title: "Educate",
    description:
      "Support informed retail through practical product, sourcing and compliance education.",
  },
];

const features = [
  "Store profiles and registration details",
  "Products, brands and estimated sales volumes",
  "Supplier routes and distribution observations",
  "Compliance checks and counterfeit-risk indicators",
  "Agency-reviewed reports for authorized partners",
];

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-brand-900">
      {session ? (
        <TopNav
          role={session.user.role}
          name={session.user.name || ""}
          email={session.user.email || ""}
        />
      ) : (
        <header className="border-b border-brand-100 bg-white/80">
          <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-8">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              aria-label="Real Makoya overview"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500 text-sm font-extrabold text-brand-900">
                RM
              </span>
              <span>
                <span className="block text-base font-bold tracking-tight">REAL MAKOYA</span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
                  Retail intelligence
                </span>
              </span>
            </Link>
            <nav aria-label="Main navigation" className="flex items-center gap-3 sm:gap-6">
              <a
                href="#platform"
                className="hidden text-sm font-medium text-gray-600 hover:text-brand-900 sm:inline"
              >
                Platform
              </a>
              <a
                href={contactHref}
                className="hidden text-sm font-medium text-gray-600 hover:text-brand-900 sm:inline"
              >
                Contact
              </a>
              <Link href="/login" className="btn-primary">
                Sign in
              </Link>
            </nav>
          </div>
        </header>
      )}

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_35%,rgba(201,138,44,0.13),transparent_38%),linear-gradient(115deg,#f7f8f5_0%,#f7f8f5_55%,#edf2ed_100%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:py-24">
          <div className="max-w-2xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] text-brand-700">
              Township retail. Real insight.
            </p>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
              Restoring trust in township retail.
              <span className="mt-2 block text-brand-600">Verify. Partner. Educate.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-gray-600 sm:text-lg">
              We connect FMCG brands, township retailers, and strategic
              partners through trusted on-the-ground intelligence, compliance
              insights, and growth opportunities, transforming field
              observations into actionable business decisions.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a href={contactHref} className="btn-primary px-5 py-3">
                Talk to our team
              </a>
              <a href="#platform" className="btn-secondary px-5 py-3">
                See what the platform does
              </a>
            </div>
            <p className="mt-4 text-xs leading-5 text-gray-500">
              Platform access is managed by Real Makoya. Contact us to discuss
              partnership opportunities.
            </p>
          </div>

          <div className="mx-auto w-full max-w-[500px] rounded-[26px] border border-white bg-white p-3 shadow-[0_28px_90px_-40px_rgba(7,35,27,0.38)]">
            <div className="rounded-[19px] bg-brand-900 p-6 text-white sm:p-8">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-100">
                THE REAL MAKOYA AGENCY
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                Better visibility. Stronger connections.
              </h2>
              <div className="mt-6 space-y-3">
                {pillars.map((pillar, index) => (
                  <div
                    key={pillar.title}
                    className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/[0.06] p-4"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-500 font-bold text-brand-900">
                      0{index + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold">{pillar.title}</h3>
                      <p className="mt-1 text-sm leading-5 text-brand-100">
                        {pillar.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="scroll-mt-8 border-y border-brand-100 bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-[0.8fr_1.2fr] md:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.17em] text-brand-600">
              THE PLATFORM
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Field insight, made useful.
            </h2>
            <p className="mt-4 leading-7 text-gray-600">
              One place to capture store visits, review observations and share
              clear reports with authorized partners.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-3 rounded-xl border border-brand-100 bg-[#fbfcfa] p-4 text-sm leading-6 text-gray-700"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <p className="mx-auto mt-6 max-w-7xl px-5 text-xs leading-5 text-gray-500 md:px-8">
          Field assessments record observations made during a visit; they are
          not legal or regulatory determinations or a guarantee of product
          authenticity.
        </p>
      </section>

      <section className="bg-brand-900 py-14 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 md:flex-row md:items-center md:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.17em] text-accent-500">
              LET&apos;S BUILD TRUST TOGETHER
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Ready to explore what we can do together?
            </h2>
            <p className="mt-2 text-sm leading-6 text-brand-100">
              Talk to us about retail intelligence, FMCG partnerships or
              retailer opportunities.
            </p>
          </div>
          <a
            href={contactHref}
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-accent-500 px-5 py-3 text-sm font-semibold text-brand-900 transition hover:bg-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-900"
          >
            Contact Real Makoya
          </a>
        </div>
      </section>

      <footer className="bg-brand-900 pb-7 text-brand-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 border-t border-white/10 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500 text-xs font-extrabold text-brand-900">
              RM
            </span>
            <span className="font-semibold text-white">Real Makoya</span>
          </Link>
          <a className="text-sm hover:text-white" href="mailto:admin@realmakoya.com">
            admin@realmakoya.com
          </a>
        </div>
        <p className="mx-auto mt-5 max-w-7xl px-5 text-xs text-brand-100/60 md:px-8">
          © {new Date().getFullYear()} Real Makoya. Field assessments reflect
          visit observations and are not legal or regulatory determinations.
        </p>
      </footer>
    </main>
  );
}

import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";


const prisma = new PrismaClient();

async function main() {
  // ── Super Admin (from .env, so you control the real login credentials) ──
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@realmakoya.co.za";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
  const adminName = process.env.SEED_ADMIN_NAME || "Real Makoya Super Admin";

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  const superAdmin =
    existingAdmin ||
    (await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: "SUPER_ADMIN",
      },
    }));

  // ── A sample Field Agent, so you can log in and try the capture flow ──
  const agent =
    (await prisma.user.findUnique({ where: { email: "agent@realmakoya.co.za" } })) ||
    (await prisma.user.create({
      data: {
        name: "Thabo Mokoena",
        email: "agent@realmakoya.co.za",
        passwordHash: await bcrypt.hash("AgentDemo123!", 12),
        role: "FIELD_AGENT",
        invitedById: superAdmin.id,
      },
    }));

  // ── A demo FMCG Organization with two brands and one Owner login ──
  let org = await prisma.organization.findFirst({
    where: { name: "Demo FMCG Co." },
    include: { brands: true },
  });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Demo FMCG Co.",
        brands: {
          create: [
            { name: "Omo", category: "Laundry" },
            { name: "Sunlight", category: "Household Cleaning" },
          ],
        },
      },
      include: { brands: true },
    });
  }

  const existingOwner = await prisma.user.findUnique({
    where: { email: "client@tigerbrands-demo.co.za" },
  });
  if (!existingOwner) {
    await prisma.OrganizationMembership.create({
      data: {
        organizationId: org.id,
        orgRole: "OWNER",
        allBrandsAccess: true,
        user: {
          create: {
            name: "Demo FMCG Contact",
            email: "client@tigerbrands-demo.co.za",
            passwordHash: await bcrypt.hash("ClientDemo123!", 12),
            role: "CLIENT",
            invitedById: superAdmin.id,
          },
        },
      },
    });
  }

  // ── A sample store with a full assessment, so reports have something to show ──
  const existingStore = await prisma.store.findFirst({ where: { name: "Thabo's Spaza Shop" } });

  const store =
    existingStore ||
    (await prisma.store.create({
      data: {
        name: "Thabo's Spaza Shop",
        tradingAs: "Thabo Tuckshop",
        address: "12 Vilakazi Street",
        town: "Soweto",
        province: "Gauteng",
        latitude: -26.2485,
        longitude: 27.9031,
        ownerName: "Thabo Nkosi",
        ownerContactNumber: "082 123 4567",
        ownerIdOrCompanyRegNumber: "8001015009087",
        municipalRegistrationStatus: "REGISTERED",
        municipalRegistrationNumber: "JHB-SPZ-004521",
        registrationNotes: "Registered with City of Johannesburg informal trading unit.",
        storeTelephoneNumber: "011 987 6543",
        ownerConsentGiven: true,
        ownerConsentAt: new Date(),
        ownerConsentById: superAdmin.id,
        visitCadenceDays: 90,
        nextVisitDue: new Date(Date.now() + 90 * 86400000),
        createdById: superAdmin.id,
      },
    }));

  const existingAssessment = await prisma.assessment.findFirst({ where: { storeId: store.id } });

  if (!existingAssessment) {
    const brands = org.brands;
    const omoId = brands.find((b: { id: string; name: string }) => b.name === "Omo")?.id ?? null;
    const sunlightId = brands.find((b: { id: string; name: string }) => b.name === "Sunlight")?.id ?? null;

    await prisma.assessment.create({
      data: {
        storeId: store.id,
        agentId: agent.id,
        status: "REVIEWED",
        reviewedById: superAdmin.id,
        reviewedAt: new Date(),

        productLines: {
          create: [
            {
              category: "Laundry",
              brand: "Omo",
              brandId: omoId,
              rank: 1,
              estimatedMonthlyUnits: 1000,
              estimatedUnitPriceZar: 25.5,
              notes: "Top seller, restocked weekly.",
            },
            {
              category: "Household Cleaning",
              brand: "Sunlight",
              brandId: sunlightId,
              rank: 2,
              estimatedMonthlyUnits: 66,
              estimatedUnitPriceZar: 18.0,
            },
          ],
        },

        sourceType: "FORMAL_WHOLESALER",
        supplierName: "Jumbo Cash & Carry",
        supplierLocation: "Booysens, Johannesburg",
        distributionNotes: "Owner collects stock weekly by bakkie.",

        hasValidCoA: true,
        hasHealthPermit: true,
        healthPermitNumber: "HP-2026-00812",
        brandAuthenticityVerified: true,

        counterfeitRisk: "LOW",
        packagingIssueFlag: false,
        batchCodeIssueFlag: false,
        pricingAnomalyFlag: false,
        counterfeitNotes: "Minor packaging wear on one Omo unit, likely just shelf handling.",

        totalSkuCount: 180,
        estimatedMonthlyTurnoverZar: 45000,

        packingShelvesCount: 6,
        posInstalled: true,
        posBrand: "Yoco",
        posModel: "Yoco Go",
        internetConnectivity: "MOBILE_DATA",
        scannerInstalled: false,

        internalNotes: "Friendly owner, open to a follow-up visit next quarter.",
      },
    });
  }

  console.log("──────────────────────────────────────────");
  console.log("Seed complete. Demo logins:");
  console.log(`  Super Admin → ${adminEmail} / ${adminPassword}`);
  console.log("  Field Agent → agent@realmakoya.co.za / AgentDemo123!");
  console.log("  FMCG Client → client@tigerbrands-demo.co.za / ClientDemo123!");
  console.log("Change these passwords after your first login.");
  console.log("──────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

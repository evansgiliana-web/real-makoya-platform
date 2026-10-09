import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("[seed] Starting…");

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@realmakoya.co.za")
    .toLowerCase()
    .trim();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
  const adminName = process.env.SEED_ADMIN_NAME || "Real Makoya Super Admin";

  let superAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!superAdmin) {
    superAdmin = await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: "SUPER_ADMIN",
        active: true,
      },
    });
    console.log("[seed] Created super admin:", adminEmail);
  } else {
    console.log("[seed] Super admin OK:", adminEmail);
  }

  let agent = await prisma.user.findUnique({
    where: { email: "agent@realmakoya.co.za" },
  });
  if (!agent) {
    agent = await prisma.user.create({
      data: {
        name: "Thabo Mokoena",
        email: "agent@realmakoya.co.za",
        passwordHash: await bcrypt.hash("AgentDemo123!", 12),
        role: "FIELD_AGENT",
        active: true,
        invitedById: superAdmin.id,
      },
    });
    console.log("[seed] Created field agent");
  } else {
    console.log("[seed] Field agent OK");
  }

  // Organization + brands
  let org = await prisma.organization.findFirst({
    where: { name: "Tiger Brands (Demo)" },
    include: { brands: true },
  });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Tiger Brands (Demo)",
        brands: {
          create: [
            { name: "Omo", category: "Laundry" },
            { name: "Sunlight", category: "Household Cleaning" },
            { name: "Koo", category: "Food" },
            { name: "Albany", category: "Bakery" },
          ],
        },
      },
      include: { brands: true },
    });
    console.log("[seed] Created organization Tiger Brands (Demo)");
  } else {
    // Ensure core brands exist
    for (const [name, category] of [
      ["Omo", "Laundry"],
      ["Sunlight", "Household Cleaning"],
      ["Koo", "Food"],
      ["Albany", "Bakery"],
    ] as const) {
      const exists = await prisma.brand.findFirst({
        where: { organizationId: org.id, name },
      });
      if (!exists) {
        await prisma.brand.create({
          data: { organizationId: org.id, name, category },
        });
      }
    }
    org = await prisma.organization.findUniqueOrThrow({
      where: { id: org.id },
      include: { brands: true },
    });
    console.log("[seed] Organization exists:", org.name);
  }

  const clientHash = await bcrypt.hash("ClientDemo123!", 12);
  const omoId = org.brands.find((b) => b.name === "Omo")?.id;
  const sunlightId = org.brands.find((b) => b.name === "Sunlight")?.id;
  const analystBrandIds = [omoId, sunlightId].filter(Boolean) as string[];

  async function ensureClient(
    email: string,
    name: string
  ): Promise<{ id: string; email: string }> {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      const u = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: clientHash,
          role: "CLIENT",
          active: true,
          invitedById: superAdmin!.id,
        },
      });
      console.log("[seed] Created CLIENT:", email);
      return u;
    }
    const u = await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: clientHash,
        role: "CLIENT",
        active: true,
      },
    });
    console.log("[seed] Reset CLIENT password:", email);
    return u;
  }

  const owner = await ensureClient("admin@tigerbrands-demo.co.za", "Tiger Org Admin");
  const member = await ensureClient(
    "client@tigerbrands-demo.co.za",
    "Demo Brand Analyst"
  );

  // OWNER membership — all brands
  const ownerMem = await prisma.orgMembership.findFirst({
    where: { userId: owner.id, organizationId: org.id },
  });
  if (!ownerMem) {
    await prisma.orgMembership.create({
      data: {
        userId: owner.id,
        organizationId: org.id,
        orgRole: "OWNER",
        allBrandsAccess: true,
        brandIds: [],
      },
    });
    console.log("[seed] Linked OWNER membership");
  } else {
    await prisma.orgMembership.update({
      where: { id: ownerMem.id },
      data: { orgRole: "OWNER", allBrandsAccess: true },
    });
  }

  // MEMBER membership — Omo + Sunlight only
  const memberMem = await prisma.orgMembership.findFirst({
    where: { userId: member.id, organizationId: org.id },
  });
  if (!memberMem) {
    await prisma.orgMembership.create({
      data: {
        userId: member.id,
        organizationId: org.id,
        orgRole: "MEMBER",
        allBrandsAccess: false,
        brandIds: analystBrandIds,
      },
    });
    console.log("[seed] Linked MEMBER membership (Omo, Sunlight)");
  } else {
    await prisma.orgMembership.update({
      where: { id: memberMem.id },
      data: {
        orgRole: "MEMBER",
        allBrandsAccess: false,
        brandIds: analystBrandIds,
      },
    });
  }

  // Sample store
  let store = await prisma.store.findFirst({
    where: { name: "Thabo's Spaza Shop" },
  });
  if (!store) {
    store = await prisma.store.create({
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
        storeTelephoneNumber: "011 987 6543",
        ownerConsentGiven: true,
        ownerConsentAt: new Date(),
        ownerConsentById: superAdmin.id,
        visitCadenceDays: 90,
        nextVisitDue: new Date(Date.now() + 90 * 86400000),
        createdById: superAdmin.id,
      },
    });
    console.log("[seed] Created sample store");
  }

  const existingAssessment = await prisma.assessment.findFirst({
    where: { storeId: store.id },
  });
  if (!existingAssessment) {
    await prisma.assessment.create({
      data: {
        storeId: store.id,
        agentId: agent.id,
        status: "REVIEWED",
        reviewedAt: new Date(),
        reviewedById: superAdmin.id,
        sourceType: "FORMAL_WHOLESALER",
        supplierName: "Jumbo Cash & Carry",
        supplierLocation: "Booysens, Johannesburg",
        hasValidCoA: true,
        hasHealthPermit: true,
        healthPermitNumber: "HP-2026-00812",
        brandAuthenticityVerified: true,
        counterfeitRisk: "LOW",
        totalSkuCount: 180,
        estimatedMonthlyTurnoverZar: 45000,
        packingShelvesCount: 6,
        posInstalled: true,
        posBrand: "Yoco",
        posModel: "Yoco Go",
        internetConnectivity: "MOBILE_DATA",
        productLines: {
          create: [
            {
              category: "Laundry",
              brand: "Omo",
              brandId: omoId ?? null,
              rank: 1,
              estimatedMonthlyUnits: 1000,
              estimatedUnitPriceZar: 25.5,
              notes: "Top seller, restocked weekly.",
            },
            {
              category: "Household Cleaning",
              brand: "Sunlight",
              brandId: sunlightId ?? null,
              rank: 2,
              estimatedMonthlyUnits: 66,
              estimatedUnitPriceZar: 18.0,
            },
          ],
        },
      },
    });
    console.log("[seed] Created REVIEWED assessment");
  }

  console.log("──────────────────────────────────────────");
  console.log("Seed complete. Demo logins:");
  console.log(`  Super Admin  → ${adminEmail} / ${adminPassword}`);
  console.log("  Field Agent  → agent@realmakoya.co.za / AgentDemo123!");
  console.log("  Org OWNER    → admin@tigerbrands-demo.co.za / ClientDemo123!");
  console.log("  Brand MEMBER → client@tigerbrands-demo.co.za / ClientDemo123!");
  console.log("──────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error("[seed] FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

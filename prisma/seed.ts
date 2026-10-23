import { PrismaClient, Role, OrgRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("[seed] Starting…");

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@realmakoya.co.za";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
  const adminName = process.env.SEED_ADMIN_NAME || "Real Makoya Super Admin";

  const adminHash: string = await hash(adminPassword, 12);

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  const superAdmin =
    existingAdmin ||
    (await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash: adminHash,
        role: Role.SUPER_ADMIN,
      },
    }));
  console.log("[seed] Super admin OK:", superAdmin.email);

  const agentHash: string = await hash("AgentDemo123!", 12);
  const agent =
    (await prisma.user.findUnique({ where: { email: "agent@realmakoya.co.za" } })) ||
    (await prisma.user.create({
      data: {
        name: "Thabo Mokoena",
        email: "agent@realmakoya.co.za",
        passwordHash: agentHash,
        role: Role.FIELD_AGENT,
        invitedById: superAdmin.id,
      },
    }));
  console.log("[seed] Agent OK:", agent.email);

  // Demo FMCG org + brands + CLIENT users (adjust if your model names differ)
  let org = await prisma.organization.findFirst({
    where: { name: "Tiger Brands (Demo)" },
    include: { brands: true },
  });

  if (!org) {
    const clientHash: string = await hash("ClientDemo123!", 12);

    org = await prisma.organization.create({
      data: {
        name: "Tiger Brands (Demo)",
        brands: {
          create: [
            { name: "Koo", category: "Food" },
            { name: "Albany", category: "Bakery" },
            { name: "Omo", category: "Household Cleaning" },
          ],
        },
        memberships: {
          create: [
            {
              orgRole: OrgRole.OWNER,
              allBrandsAccess: true,
              brandIds: [],
              user: {
                create: {
                  name: "Tiger Org Admin",
                  email: "admin@tigerbrands-demo.co.za",
                  passwordHash: clientHash,
                  role: Role.CLIENT,
                  invitedById: superAdmin.id,
                },
              },
            },
            {
              orgRole: OrgRole.MEMBER,
              allBrandsAccess: true,
              brandIds: [],
              user: {
                create: {
                  name: "Tiger Brand Analyst",
                  email: "client@tigerbrands-demo.co.za",
                  passwordHash: clientHash,
                  role: Role.CLIENT,
                  invitedById: superAdmin.id,
                },
              },
            },
          ],
        },
      },
      include: { brands: true },
    });
    console.log("[seed] Org created:", org.name);
  } else {
    console.log("[seed] Org already exists:", org.name);
  }

  console.log("──────────────────────────────────────────");
  console.log("Seed complete. Demo logins:");
  console.log(`  Super Admin     → ${adminEmail} / ${adminPassword}`);
  console.log("  Field Agent     → agent@realmakoya.co.za / AgentDemo123!");
  console.log("  Tiger Org Admin → admin@tigerbrands-demo.co.za / ClientDemo123!");
  console.log("  Brand Analyst   → client@tigerbrands-demo.co.za / ClientDemo123!");
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
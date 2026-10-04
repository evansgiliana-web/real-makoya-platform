import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const emailAdmin = process.env.SEED_ADMIN_EMAIL || "admin@realmakoya.com";
  const passwordAdmin = process.env.SEED_ADMIN_PASSWORD || "Outlook@001";
  const nameAdmin = process.env.SEED_ADMIN_NAME || "Real Makoya Admin";

  const emailSuper = process.env.SEED_SUPER_EMAIL || "superadmin@realmakoya.com";
  const passwordSuper = process.env.SEED_SUPER_PASSWORD || "Outlook@001";
  const nameSuper = process.env.SEED_SUPER_NAME || "Real Makoya Super Admin";

  // Hash separately
  const passwordHashAdmin = await bcrypt.hash(passwordAdmin, 12);
  const passwordHashSuper = await bcrypt.hash(passwordSuper, 12);

  // Seed ADMIN if not exists
  const existingAdmin = await prisma.user.findUnique({ where: { email: emailAdmin } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        name: nameAdmin,
        email: emailAdmin,
        passwordHash: passwordHashAdmin,
        role: "ADMIN",
      },
    });
    console.log(`✅ Admin user seeded: ${emailAdmin}`);
  }

  // Seed SUPER_ADMIN if not exists
  const existingSuper = await prisma.user.findUnique({ where: { email: emailSuper } });
  if (!existingSuper) {
    await prisma.user.create({
      data: {
        name: nameSuper,
        email: emailSuper,
        passwordHash: passwordHashSuper,
        role: "SUPER_ADMIN",
      },
    });
    console.log(`✅ Super Admin user seeded: ${emailSuper}`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

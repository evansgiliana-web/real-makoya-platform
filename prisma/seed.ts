import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@realmakoya.co.za";
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
  const name = process.env.SEED_ADMIN_NAME || "Real Makoya Super Admin";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Seed skipped — user ${email} already exists.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });

  console.log("──────────────────────────────────────────");
  console.log("Super Admin account created:");
  console.log("  Email:   ", admin.email);
  console.log("  Password:", password, "(change this after first login)");
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

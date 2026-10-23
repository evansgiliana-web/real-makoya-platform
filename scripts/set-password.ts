/**
 * One-off admin tool: set a new password for an existing user.
 *
 * The app has no "change password" screen yet, and the seed script never
 * updates an account that already exists, so use this to replace a password
 * that has been exposed or is still a temporary one.
 *
 * PowerShell:
 *   $env:TARGET_EMAIL="admin@realmakoya.com"
 *   $env:NEW_PASSWORD="a-long-unique-passphrase-7"
 *   npx tsx scripts/set-password.ts
 *   Remove-Item Env:NEW_PASSWORD
 *
 * Uses DATABASE_URL from your .env, so check which database that points at first.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { passwordProblem } from "../src/lib/policies";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.TARGET_EMAIL?.toLowerCase().trim();
  const password = process.env.NEW_PASSWORD;
  if (!email || !password) {
    throw new Error("Set both TARGET_EMAIL and NEW_PASSWORD environment variables first.");
  }
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No user with email ${email}.`);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 12) },
  });
  await prisma.auditLog.create({
    data: {
      actorEmail: "script:set-password",
      action: "user.password_reset",
      entityType: "User",
      entityId: user.id,
      metaJson: JSON.stringify({ targetEmail: email }),
    },
  });
  console.log(`Password updated for ${email}. Existing logins for this user will expire within 12 hours.`);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

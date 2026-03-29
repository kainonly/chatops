import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcryptjs from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const hash = await bcryptjs.hash(process.env.SEED_PASSWORD!, 12);
  await prisma.user.upsert({
    where: { email: process.env.SEED_EMAIL! },
    update: { password: hash },
    create: { email: process.env.SEED_EMAIL!, password: hash },
  });
  console.log("Seed complete: " + process.env.SEED_EMAIL);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@replayly.dev";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return;
  }

  const passwordHash = await hashPassword("demo123456");
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: "Demo User",
    },
  });

  const org = await prisma.organization.create({
    data: {
      name: "Demo Organization",
      slug: "demo-organization",
    },
  });

  await prisma.organizationMember.create({
    data: {
      userId: user.id,
      organizationId: org.id,
      role: Role.OWNER,
    },
  });

  await prisma.project.create({
    data: {
      name: "Demo Project",
      slug: "demo-project",
      organizationId: org.id,
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

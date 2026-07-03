import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const seedTickers = [
  { ticker: "AAPL", notes: "Core holding" },
  { ticker: "NVDA", notes: "AI exposure" },
  { ticker: "MSFT", notes: null },
];

async function main() {
  for (const t of seedTickers) {
    await prisma.watchlist.upsert({
      where: { ticker: t.ticker },
      update: {},
      create: t,
    });
  }
  console.log(`Seeded ${seedTickers.length} tickers.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

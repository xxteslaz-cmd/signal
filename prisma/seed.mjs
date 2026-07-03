import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// A starter set of widely-followed large caps across sectors, so the
// watchlist isn't empty on first load.
const seedTickers = [
  { ticker: "AAPL", notes: "Core holding" },
  { ticker: "MSFT", notes: null },
  { ticker: "NVDA", notes: "AI exposure" },
  { ticker: "GOOGL", notes: null },
  { ticker: "AMZN", notes: null },
  { ticker: "META", notes: null },
  { ticker: "TSLA", notes: null },
  { ticker: "AMD", notes: null },
  { ticker: "NFLX", notes: null },
  { ticker: "JPM", notes: null },
  { ticker: "V", notes: null },
  { ticker: "SPY", notes: "S&P 500 ETF" },
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

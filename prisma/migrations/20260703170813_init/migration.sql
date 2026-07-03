-- CreateTable
CREATE TABLE "watchlist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticker" TEXT NOT NULL,
    "notes" TEXT,
    "added_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticker" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "key_risks" TEXT NOT NULL,
    "price_at_rec" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "notification_log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "event_key" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sent_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "watchlist_ticker_key" ON "watchlist"("ticker");

-- CreateIndex
CREATE INDEX "recommendations_ticker_created_at_idx" ON "recommendations"("ticker", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_log_event_key_key" ON "notification_log"("event_key");

-- CreateIndex
CREATE INDEX "notification_log_ticker_idx" ON "notification_log"("ticker");

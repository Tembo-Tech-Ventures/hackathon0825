-- CreateTable
CREATE TABLE "search_queries" (
    "id" TEXT NOT NULL,
    "chatRoomId" TEXT NOT NULL,
    "initiatingMessageId" TEXT,
    "botMessageId" TEXT,
    "query" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_results" (
    "id" TEXT NOT NULL,
    "searchQueryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "snippet" TEXT,
    "score" DOUBLE PRECISION,
    "favicon" TEXT,

    CONSTRAINT "search_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_images" (
    "id" TEXT NOT NULL,
    "searchQueryId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sourceUrl" TEXT,

    CONSTRAINT "search_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_queries_chatRoomId_createdAt_idx" ON "search_queries"("chatRoomId", "createdAt");

-- CreateIndex
CREATE INDEX "search_results_searchQueryId_idx" ON "search_results"("searchQueryId");

-- CreateIndex
CREATE INDEX "search_images_searchQueryId_idx" ON "search_images"("searchQueryId");

-- AddForeignKey
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_chatRoomId_fkey" FOREIGN KEY ("chatRoomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_initiatingMessageId_fkey" FOREIGN KEY ("initiatingMessageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_botMessageId_fkey" FOREIGN KEY ("botMessageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_results" ADD CONSTRAINT "search_results_searchQueryId_fkey" FOREIGN KEY ("searchQueryId") REFERENCES "search_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_images" ADD CONSTRAINT "search_images_searchQueryId_fkey" FOREIGN KEY ("searchQueryId") REFERENCES "search_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

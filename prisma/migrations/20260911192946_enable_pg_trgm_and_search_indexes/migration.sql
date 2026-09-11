-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "charts_title_trgm_idx" ON "charts" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "charts_title_romaji_trgm_idx" ON "charts" USING GIN ("titleRomaji" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "charts_subtitle_trgm_idx" ON "charts" USING GIN ("subtitle" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "charts_subtitle_romaji_trgm_idx" ON "charts" USING GIN ("subtitleRomaji" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "charts_artist_trgm_idx" ON "charts" USING GIN ("artist" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "charts_artist_romaji_trgm_idx" ON "charts" USING GIN ("artistRomaji" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "submissions_stepartist_trgm_idx" ON "submissions" USING GIN ("stepartist" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "submissions_pack_trgm_idx" ON "submissions" USING GIN ("pack" gin_trgm_ops);

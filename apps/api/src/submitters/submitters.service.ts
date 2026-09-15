import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

type RawSubmitterRow = {
  submitter: string;
  lowers: bigint;
  uppers: bigint;
  doubles: bigint;
  ignored: bigint;
  errored: bigint;
};

export type SubmitterRow = {
  submitter: string;
  lowers: number;
  uppers: number;
  doubles: number;
  ignored: number;
  errored: number;
};

@Injectable()
export class SubmittersService {
  constructor(private readonly prisma: PrismaService) {}

  // Unlike ReviewsService.buildBaseWhereFragments, this LEFT (not INNER) JOINs charts and
  // doesn't exclude isIgnored submissions from the query - "# ignored"/"# errored" need to
  // count submissions that have neither a chart (parsing failed) nor pass the isIgnored
  // filter. Lowers/Uppers/Double, in turn, require NOT isIgnored AND no processingError on
  // top of the chart's own parsed playstyle/meter, not Submission.playstyle (submitter-
  // claimed) - same "parsed, not claimed" reasoning as Reviews. Chart is a nullable 1:1
  // (not 1:many) per submission, so the LEFT JOIN can't fan out and double-count a row.
  async listForEvent(eventId: string): Promise<SubmitterRow[]> {
    const rows = await this.prisma.$queryRaw<RawSubmitterRow[]>(
      Prisma.sql`
        SELECT
          s.submitter,
          COUNT(*) FILTER (
            WHERE NOT s."isIgnored" AND s."processingError" IS NULL
              AND c.playstyle = 'SINGLE' AND c.meter <= 9
          )                                            AS lowers,
          COUNT(*) FILTER (
            WHERE NOT s."isIgnored" AND s."processingError" IS NULL
              AND c.playstyle = 'SINGLE' AND c.meter >= 10
          )                                            AS uppers,
          COUNT(*) FILTER (
            WHERE NOT s."isIgnored" AND s."processingError" IS NULL AND c.playstyle = 'DOUBLE'
          )                                            AS doubles,
          COUNT(*) FILTER (WHERE s."isIgnored")         AS ignored,
          COUNT(*) FILTER (WHERE s."processingError" IS NOT NULL) AS errored
        FROM submissions s
        LEFT JOIN charts c ON c."submissionId" = s."fileId"
        WHERE s."eventId" = ${eventId}
        GROUP BY s.submitter
        ORDER BY s.submitter ASC
      `,
    );

    return rows.map((row) => ({
      submitter: row.submitter,
      lowers: Number(row.lowers),
      uppers: Number(row.uppers),
      doubles: Number(row.doubles),
      ignored: Number(row.ignored),
      errored: Number(row.errored),
    }));
  }
}

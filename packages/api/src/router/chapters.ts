import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { asc, eq } from "@bt/db";
import { Chapters, CreateChapterSchema } from "@bt/db/schema";

import { protectedProcedure } from "../trpc";

export const ChaptersRouter = {
  all: protectedProcedure
    .input(z.object({ channelId: z.string().min(1) }))
    .query(({ ctx, input }) => {
      return ctx.db.query.Chapters.findMany({
        orderBy: asc(Chapters.createdAt),
        limit: 10,
        where: eq(Chapters.channelId, input.channelId),
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.query.Chapters.findFirst({
        where: eq(Chapters.id, input.id),
      });
    }),

  create: protectedProcedure
    .input(CreateChapterSchema)
    .mutation(({ ctx, input }) => {
      return ctx.db.insert(Chapters).values(input);
    }),

  delete: protectedProcedure.input(z.string()).mutation(({ ctx, input }) => {
    return ctx.db.delete(Chapters).where(eq(Chapters.id, input));
  }),
} satisfies TRPCRouterRecord;

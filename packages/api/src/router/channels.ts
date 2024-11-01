import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { and, desc, eq, ilike, sql } from "@bt/db";
import {
  Channels,
  Chapters,
  CreateChannelSchema,
  UpdateChannelSchema,
} from "@bt/db/schema";

import { protectedProcedure } from "../trpc";

export const channelsRouter = {
  all: protectedProcedure
    .input(z.object({ query: z.string().nullable() }).optional())
    .query(({ ctx, input }) => {
      return ctx.db
        .select({
          id: Channels.id,
          title: Channels.title,
          createdAt: Channels.createdAt,
          chapterCount: sql`count(${Chapters.id})`
            .mapWith(Number)
            .as("chapterCount"),
        })
        .from(Channels)
        .leftJoin(Chapters, eq(Chapters.channelId, Channels.id)) // Adjust 'channelId' to the actual foreign key field
        .where(
          input?.query
            ? and(
                eq(Channels.createdByClerkUserId, ctx.session.userId),
                ilike(Channels.title, `%${input.query}%`),
              )
            : eq(Channels.createdByClerkUserId, ctx.session.userId),
        )
        .groupBy(Channels.id)
        .orderBy(desc(Channels.createdAt));
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.query.Channels.findFirst({
        where: and(
          eq(Channels.id, input.id),
          eq(Channels.createdByClerkUserId, ctx.session.userId),
        ),
      });
    }),

  create: protectedProcedure
    .input(CreateChannelSchema)
    .mutation(({ ctx, input }) => {
      return ctx.db
        .insert(Channels)
        .values({ ...input, createdByClerkUserId: ctx.session.userId });
    }),

  update: protectedProcedure
    .input(UpdateChannelSchema)
    .mutation(({ ctx, input }) => {
      const { id, ...values } = input;
      return ctx.db
        .update(Channels)
        .set(values)
        .where(eq(Channels.id, id!))
        .returning();
    }),

  delete: protectedProcedure.input(z.string()).mutation(({ ctx, input }) => {
    return ctx.db
      .delete(Channels)
      .where(
        and(
          eq(Channels.id, input),
          eq(Channels.createdByClerkUserId, ctx.session.userId ?? ""),
        ),
      );
  }),
} satisfies TRPCRouterRecord;

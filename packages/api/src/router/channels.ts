import type { TRPCRouterRecord } from "@trpc/server";
import { clerkClient } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { endOfDay } from "date-fns";
import { z } from "zod";

import { and, asc, count, desc, eq, gte, ilike, sql } from "@bt/db";
import {
  Channels,
  Chapters,
  CreateChannelSchema,
  Subscriptions,
  UpdateChannelSchema,
  UserChannelState,
  Videos,
} from "@bt/db/schema";

import { Context, protectedProcedure } from "../trpc";

export async function getChannelById({
  channelId,
  fetchByUser = false,
  ctx,
}: {
  channelId: string;
  fetchByUser?: boolean;
  ctx: Context;
}) {
  const item = await ctx.db.query.Channels.findFirst({
    where: and(
      eq(Channels.id, channelId),
      fetchByUser
        ? eq(Channels.createdByClerkUserId, ctx.session.userId ?? "")
        : undefined,
    ),
  });

  const agregate = await ctx.db
    .select({ totalChapters: count(Chapters.channelId) })
    .from(Chapters)
    .where(eq(Chapters.channelId, channelId))
    .groupBy(Chapters.channelId);

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(item?.createdByClerkUserId ?? "");

  const subscription = await ctx.db.query.Subscriptions.findFirst({
    where: and(
      eq(Subscriptions.channelId, channelId),
      eq(Subscriptions.clerkUserId, ctx.session.userId ?? ""),
    ),
  });

  const subscriptionsAgregate = await ctx.db
    .select({ subscriptionsCount: count(Subscriptions.channelId) })
    .from(Subscriptions)
    .where(eq(Subscriptions.channelId, channelId))
    .groupBy(Subscriptions.channelId);

  return {
    totalChapters: agregate.at(0)?.totalChapters,
    subscriptionsCount: subscriptionsAgregate.at(0)?.subscriptionsCount ?? 0,
    isSubscribed: !!subscription?.id,
    isSubscriptionPaused: subscription?.isPaused ?? false,
    isSubscriptionExpired:
      new Date(Date.now()) >= new Date(subscription?.endsOn ?? Date.now()),
    createdBy: user.fullName,
    createdByImageUrl: user.imageUrl,
    ...item,
  };
}

export const channelsRouter = {
  all: protectedProcedure
    .input(z.object({ query: z.string().nullable() }).optional())
    .query(async ({ ctx, input }) => {
      const channels = await ctx.db
        .select({
          id: Channels.id,
          title: Channels.title,
          createdAt: Channels.createdAt,
          thumbneilId: Channels.thumbneilId,
          chapterCount: sql`count(${Chapters.id})`
            .mapWith(Number)
            .as("chapterCount"),
          description: Channels.description,
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

      return channels;
    }),

  setActiveChapterForUser: protectedProcedure
    .input(
      z.object({
        channelId: z.string().min(1),
        activeChapterId: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.db
        .insert(UserChannelState)
        .values({
          channelId: input.channelId,
          activeChapterId: input.activeChapterId,
          clerkUserId: ctx.session.userId,
        })
        .onConflictDoUpdate({
          target: [UserChannelState.clerkUserId, UserChannelState.channelId],
          set: {
            activeChapterId: input.activeChapterId,
            channelId: input.channelId,
          },
        });
    }),

  infinite: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).nullish(),
        cursor: z.date().nullish(), // <-- "cursor" needs to exist, but can be any type
        direction: z.enum(["forward", "backward"]), // optional, useful for bi-directional query
      }),
    )
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 50;
      const { cursor } = input;

      const items = await ctx.db.query.Channels.findMany({
        orderBy: [asc(Channels.createdAt)],
        where: cursor ? gte(Channels.createdAt, cursor) : undefined,
        limit: limit + 1,
        with: {
          chapters: {
            limit: 4,
          },
        },
      });

      if (items.length === 0) {
        return { items: [], nextCursor: undefined };
      }

      const channelsWithTotalChapters = await Promise.all(
        items.map(async (channelItem) => {
          const item = await ctx.db
            .select({ totalChapters: count(Chapters.channelId) })
            .from(Chapters)
            .where(eq(Chapters.channelId, channelItem.id))
            .groupBy(Chapters.channelId);

          const chapters = await Promise.all(
            channelItem.chapters.map(async (chapter) => {
              const chapterItem = await ctx.db
                .select({ totalVideos: count(Videos.chapterId) })
                .from(Videos)
                .where(eq(Videos.chapterId, chapter.id))
                .groupBy(Videos.chapterId);

              return {
                ...chapter,
                totalVideos: chapterItem.at(0)?.totalVideos ?? 0,
              };
            }),
          );

          const clerk = await clerkClient();
          const user = await clerk.users.getUser(
            channelItem.createdByClerkUserId,
          );
          if (!user) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "User not found",
            });
          }

          const subscriptionsAgregate = await ctx.db
            .select({ subscriptionsCount: count(Subscriptions.channelId) })
            .from(Subscriptions)
            .where(eq(Subscriptions.channelId, channelItem.id))
            .groupBy(Subscriptions.channelId);

          return {
            ...channelItem,
            createdBy: user.fullName,
            createdByImageUrl: user.imageUrl,
            chapters,
            totalChapters: item?.at(0)?.totalChapters ?? 0,
            subscriptionCount:
              subscriptionsAgregate.at(0)?.subscriptionsCount ?? 0,
          };
        }),
      );

      let nextCursor: typeof cursor | undefined = undefined;
      if (channelsWithTotalChapters.length > limit) {
        const nextItem = channelsWithTotalChapters.pop();
        if (nextItem?.createdAt) {
          nextCursor = nextItem.createdAt;
          console.log("Next Cursor", nextCursor);
        }
      }

      return {
        items: channelsWithTotalChapters,
        nextCursor,
      };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) =>
      getChannelById({ channelId: input.id, ctx }),
    ),

  create: protectedProcedure
    .input(CreateChannelSchema)
    .mutation(async ({ ctx, input }) => {
      console.log(input);
      // const plan = await ctx.pg.plans.create({
      //   period: "monthly",
      //   item: {
      //     amount: Math.round(input.subscriptionPrice * 100),
      //     currency: "INR",
      //     name: input.title,
      //     description: input.description ?? undefined,
      //   },
      //   interval: 1,
      //   notes: {
      //     name: input.title,
      //     description: input.description ?? "",
      //   },
      // });

      return ctx.db.insert(Channels).values({
        ...input,
        createdByClerkUserId: ctx.session.userId,
        // razPlanId: plan.id,
      });
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

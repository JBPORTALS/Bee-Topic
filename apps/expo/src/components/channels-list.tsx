import {
  ActivityIndicator,
  Image,
  TouchableNativeFeedback,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Link } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { FlashList } from "@shopify/flash-list";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Text } from "~/components/ui/text";
import { H3, Lead, Muted } from "~/components/ui/typography";
import { Sprout } from "~/lib/icons/Sprout";
import { useColorScheme } from "~/lib/useColorScheme";
import { api } from "~/utils/api";

const AnimatedCard = Animated.createAnimatedComponent(Card);

export default function ChannelsList() {
  const { userId } = useAuth();
  const utils = api.useUtils();
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = api.channels.infinite.useInfiniteQuery(
    { limit: 5 },
    {
      initialCursor: undefined,
      getNextPageParam: (lastPage) => {
        console.log("lastPage", lastPage.nextCursor);
        return lastPage.nextCursor;
      },
      enabled: !!userId,
    },
  );
  const { isDarkColorScheme } = useColorScheme();

  const channels = data?.pages?.flatMap((page) => page.items) || [];

  if (isLoading)
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size={46} className="text-primary" />
      </View>
    );

  if (isError)
    return (
      <View className="flex-1 items-center justify-center gap-3">
        <Lead>Ooops! something went wrong</Lead>
        <Button onPress={() => refetch()} variant={"outline"}>
          <Text>Try again</Text>
        </Button>
      </View>
    );

  if (channels.length === 0)
    return (
      <View className="flex-1 items-center justify-center">
        <Lead>No channels yet</Lead>
      </View>
    );

  return (
    <View className="flex-1">
      {isLoading ? (
        <View className="mt-24 gap-4 p-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className={"h-56 w-full rounded-2xl"} />
          ))}
        </View>
      ) : (
        <FlashList
          data={channels}
          keyExtractor={(item) => item.id}
          estimatedItemSize={400}
          ListHeaderComponent={() => (
            <View className="mt-24 gap-1 pb-3">
              <H3 className="text-center capitalize leading-snug text-foreground">
                Something New Today
              </H3>
              <Muted className="text-center font-semibold">
                Latest channels from BeeTopic
              </Muted>
            </View>
          )}
          ListEmptyComponent={
            <View className="h-full w-full flex-1 items-center justify-center">
              <Lead>No Channels Created Yet</Lead>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12 }}
          renderItem={({ item: channel, index }) => {
            utils.channels.byId.prefetch({ id: channel.id });
            return (
              <AnimatedCard
                entering={FadeIn}
                key={channel.id}
                style={{ position: "relative" }}
                className="mt-3 min-h-52 overflow-hidden rounded-md border border-border/80"
              >
                <Link asChild href={`/channels/${channel.id}`}>
                  <TouchableNativeFeedback
                    background={TouchableNativeFeedback.Ripple(
                      isDarkColorScheme
                        ? "rgba(255,255,255,0.25)"
                        : "rgba(0,0,0,0.25)",
                      false,
                    )}
                    useForeground={true}
                    style={{ borderRadius: 40 }}
                  >
                    <View className="flex-1">
                      <CardContent className="flex-1 object-contain p-0">
                        {channel.thumbneilId ? (
                          <Image
                            source={{
                              uri: `https://utfs.io/f/${channel.thumbneilId}`,
                            }}
                            resizeMode="cover"
                            style={{
                              width: "auto",
                              flex: 1,
                              height: 205,
                            }}
                          />
                        ) : (
                          <View
                            style={{
                              width: "auto",
                              flex: 1,
                              height: 205,
                            }}
                            className="items-center justify-center border-b border-b-border"
                          >
                            <Sprout
                              size={64}
                              className="text-muted-foreground/70"
                            />
                          </View>
                        )}
                      </CardContent>
                      <CardHeader className="items-start gap-2 p-3">
                        <CardTitle className="text-xl leading-snug">
                          {channel.title}
                        </CardTitle>
                        <View className="flex-row items-center gap-1">
                          <Muted className="text-xs">Created by</Muted>
                          <View className="flex-row items-center justify-center gap-1">
                            <Avatar
                              className="size-6 border border-border"
                              alt="Channel Creator"
                            >
                              <AvatarImage
                                source={{
                                  uri: channel?.createdByImageUrl,
                                }}
                              />
                              <AvatarFallback className="items-center justify-center">
                                <Text>{channel?.createdBy?.charAt(0)}</Text>
                              </AvatarFallback>
                            </Avatar>
                            <Muted className="text-xs font-semibold">
                              {channel?.createdBy}
                            </Muted>
                          </View>
                        </View>
                      </CardHeader>
                      <CardFooter className="w-full flex-1 items-center justify-center gap-2 border-t border-border bg-muted/20 px-3 py-3">
                        <Muted className="text-xs font-medium">
                          {channel.totalChapters} Chapters •{" "}
                          {channel.subscriptionCount} Subscribers
                        </Muted>
                      </CardFooter>
                    </View>
                  </TouchableNativeFeedback>
                </Link>
              </AnimatedCard>
            );
          }}
          onEndReached={() => {
            console.log("Reached", hasNextPage);
            fetchNextPage();
          }}
          onEndReachedThreshold={0.8} // Adjust threshold for when to load more data
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator
                size="small"
                className="my-5"
                color={isDarkColorScheme ? "white" : "black"}
              />
            ) : (
              <View style={{ height: 32 }} />
            )
          }
        />
      )}
    </View>
  );
}

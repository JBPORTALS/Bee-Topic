import { Image, View } from "react-native";
import { Link, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useUser } from "@clerk/clerk-expo";
import { BlurView } from "@react-native-community/blur";

import ChannelsList from "~/components/channels-list";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { User } from "~/lib/icons/User";
import { useColorScheme } from "~/lib/useColorScheme";

export default function Index() {
  const { user } = useUser();

  const { isDarkColorScheme } = useColorScheme();

  return (
    <View className="flex-1">
      <StatusBar translucent />
      <Stack.Screen
        options={{
          headerTitle() {
            return (
              <Image
                source={
                  isDarkColorScheme
                    ? require("assets/VerticalLogoDark.png")
                    : require("assets/VerticalLogoLight.png")
                }
                style={{
                  height: 60,
                  width: 140,
                }}
              />
            );
          },
          headerRight(props) {
            return (
              <Link href={"/profile"}>
                <Avatar alt="Avatar" className="size-9">
                  <AvatarImage
                    src={user?.imageUrl}
                    source={{ uri: user?.imageUrl }}
                  />
                  <AvatarFallback>
                    <User
                      size={32}
                      strokeWidth={0.5}
                      className="fill-foreground/10 text-foreground"
                    />
                  </AvatarFallback>
                </Avatar>
              </Link>
            );
          },
          headerTransparent: true,
          headerBackground() {
            return (
              <BlurView
                blurAmount={64}
                blurType={isDarkColorScheme ? "dark" : "light"}
                style={{
                  flex: 1,
                  overflow: "hidden",
                  // opacity: 0,
                }}
              />
            );
          },
          headerTitleAlign: "left",
        }}
      />

      <ChannelsList />
    </View>
  );
}

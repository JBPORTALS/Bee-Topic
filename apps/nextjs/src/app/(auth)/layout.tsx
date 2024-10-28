import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (userId) redirect("/");
  return <>{children}</>;
}

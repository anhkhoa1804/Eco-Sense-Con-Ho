import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";

export default async function HomePage() {
  const { user } = await getSessionContext();
  redirect(user ? "/dashboard" : "/login");
}

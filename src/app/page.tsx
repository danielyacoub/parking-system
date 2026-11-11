import { redirect } from "next/navigation";

export default function HomePage() {
  // Send visitors through the admin gate. Signed-in admins land on the
  // overview; everyone else is redirected to the login page by proxy.ts.
  redirect("/admin");
}

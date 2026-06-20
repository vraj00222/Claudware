import { redirect } from "next/navigation";

// `/` is the landing page, served via a rewrite to /landing.html (see next.config.ts). This redirect
// is the fallback if the rewrite is ever bypassed. The studio itself lives at /app behind the auth gate.
export default function Page() {
  redirect("/landing.html");
}

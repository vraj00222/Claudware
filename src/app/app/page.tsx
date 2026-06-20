import { Scaler } from "@/design/Scaler";
import { Studio } from "@/components/Studio";
import { AuthGate } from "@/components/AuthGate";

// The studio behind the Google auth gate. The landing (/landing.html) deep-links its CTAs here.
export default function AppPage() {
  return (
    <Scaler>
      <AuthGate>
        <Studio />
      </AuthGate>
    </Scaler>
  );
}

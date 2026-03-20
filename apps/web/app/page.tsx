import { Suspense } from "react";

import { AppClient } from "./app-client";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <AppClient />
    </Suspense>
  );
}

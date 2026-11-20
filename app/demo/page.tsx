import type { Metadata } from "next";
import { DemoStage } from "./_components/demo-stage";

export const metadata: Metadata = {
  title: "centrix Fix · live demo",
};

export default function DemoPage() {
  return <DemoStage />;
}

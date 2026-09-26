import { Circle, type LucideProps } from "lucide-react";
import { ICONS } from "@/components/iconRegistry";

type Props = LucideProps & { name: string };

export function Icon({ name, ...rest }: Props) {
  const Cmp = ICONS[name];
  if (!Cmp && process.env.NODE_ENV !== "production") {
    console.warn(`[Icon] « ${name} » absente de iconRegistry.ts : repli sur Circle.`);
  }
  const Resolved = Cmp ?? Circle;
  return <Resolved {...rest} />;
}

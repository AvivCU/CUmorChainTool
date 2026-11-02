import { Workflow } from "lucide-react";

export default function BrandMark({ size = "md" }: { size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-12 w-12 rounded-xl" : "h-8 w-8 rounded-lg";
  const icon = size === "lg" ? "h-6 w-6" : "h-4 w-4";
  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-brand-700 text-white shadow-sm dark:bg-brand-500 ${box}`}
    >
      <Workflow className={icon} aria-hidden="true" />
    </span>
  );
}

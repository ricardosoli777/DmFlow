import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      ativo: "bg-success/15 text-success",
      pausado: "bg-warning/15 text-warning",
      erro: "bg-danger/15 text-danger",
      rascunho: "bg-muted text-muted-foreground",
    },
  },
  defaultVariants: { variant: "rascunho" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

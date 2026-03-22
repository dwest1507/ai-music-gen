import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <div className="relative">
                <select
                    className={cn(
                        "cyber-input flex h-10 w-full appearance-none px-3 py-2 text-sm pr-8 cursor-pointer",
                        className
                    )}
                    ref={ref}
                    {...props}
                >
                    {children}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} />
                </div>
            </div>
        );
    }
);
Select.displayName = "Select";

export { Select };

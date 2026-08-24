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
                        "field-input flex h-10 w-full cursor-pointer appearance-none px-3 py-2 pr-8 text-[13px]",
                        className
                    )}
                    ref={ref}
                    {...props}
                >
                    {children}
                </select>
                <div className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
                    <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} />
                </div>
            </div>
        );
    }
);
Select.displayName = "Select";

export { Select };

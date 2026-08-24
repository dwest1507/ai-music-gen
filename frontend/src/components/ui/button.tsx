"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "outline" | "ghost" | "link" | "secondary" | "destructive";
    size?: "default" | "sm" | "lg" | "icon";
    isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "default", isLoading, children, ...props }, ref) => {
        return (
            <button
                data-variant={variant}
                className={cn(
                    "btn inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 select-none focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40",
                    "active:scale-[0.98]",
                    {
                        "h-10 px-5": size === "default",
                        "h-8 rounded-md px-4 text-xs": size === "sm",
                        "h-12 px-6": size === "lg",
                        "h-10 w-10 p-0": size === "icon",
                    },
                    className
                )}
                ref={ref}
                disabled={isLoading || props.disabled}
                {...props}
            >
                {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {children}
            </button>
        );
    }
);
Button.displayName = "Button";

export { Button };

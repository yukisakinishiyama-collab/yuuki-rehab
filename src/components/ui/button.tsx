import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
        {
          "bg-teal-600 text-white hover:bg-teal-700 focus:ring-teal-500": variant === "primary",
          "bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-400": variant === "secondary",
          "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-400": variant === "outline",
          "text-gray-600 hover:bg-gray-100 focus:ring-gray-400": variant === "ghost",
          "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500": variant === "danger",
        },
        {
          "px-3 py-1.5 text-sm gap-1.5": size === "sm",
          "px-4 py-2 text-sm gap-2": size === "md",
          "px-6 py-3 text-base gap-2": size === "lg",
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

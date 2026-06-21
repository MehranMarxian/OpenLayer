import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "default" | "primary";
};

export function Button({ children, className = "", variant = "default", ...props }: ButtonProps) {
  const variantClass = variant === "primary" ? "button-primary" : "";

  return (
    <button className={`button ${variantClass} ${className}`.trim()} type="button" {...props}>
      {children}
    </button>
  );
}

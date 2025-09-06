import { ImSpinner2 } from "react-icons/im";

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
}

export function LoadingSpinner({ size = 20, className }: LoadingSpinnerProps) {
  return (
    <ImSpinner2
      size={size}
      className={`animate-spin text-white ${className}`}
    />
  );
}

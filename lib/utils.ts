import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-display-large",
        "text-display-medium",
        "text-display-small",
        "text-headline-large",
        "text-headline-medium",
        "text-headline-small",
        "text-title-large",
        "text-title-medium",
        "text-title-small",
        "text-body-large",
        "text-body-medium",
        "text-body-small",
        "text-label-large",
        "text-label-medium",
        "text-label-small",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

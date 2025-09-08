import { format } from "date-fns";

export function formatDate(timestemp: number | Date): string {
  // const date = new Date(timestemp);
  if (!timestemp) return "N/A";

  return format(timestemp, "dd/MM/yyyy HH:mm:ss");
}

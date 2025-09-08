import { format } from "date-fns";

export function formatDate(timestemp: number): string {
  const date = new Date(timestemp);
  if (!timestemp) return "N/A";
  // if (isNaN(date.getTime())) {
  //   return timestemp;
  // }
  return format(timestemp, "dd/MM/yyyy HH:mm:ss");
}

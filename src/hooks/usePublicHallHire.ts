import { useEffect, useState } from "react";
import { watchHallHire } from "../services/hallHireSettings";
export function usePublicHallHire() {
  const [enabled, setEnabled] = useState(false), [error, setError] = useState("");
  useEffect(() => watchHallHire(setEnabled, () => {setEnabled(false); setError("Unable to verify Hall Hire availability.");}), []);
  return {enabled, error};
}

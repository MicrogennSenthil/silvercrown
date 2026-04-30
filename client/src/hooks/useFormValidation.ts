import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function useFormValidation() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  function validate(rules: Array<{ key: string; value: any; label: string }>): boolean {
    const errors: Record<string, boolean> = {};
    const missing: string[] = [];

    for (const rule of rules) {
      const v = rule.value;
      const isEmpty =
        v === "" || v === null || v === undefined ||
        (typeof v === "string" && !v.trim());
      if (isEmpty) {
        errors[rule.key] = true;
        missing.push(rule.label);
      }
    }

    setFieldErrors(errors);

    if (missing.length > 0) {
      toast({
        title: "Required fields missing",
        description: `Please fill in: ${missing.join(", ")}`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  }

  function clearError(key: string) {
    setFieldErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function hasError(key: string): boolean {
    return !!fieldErrors[key];
  }

  function clearAll() {
    setFieldErrors({});
  }

  function showApiError(message: string) {
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
    });
  }

  return { validate, clearError, hasError, clearAll, fieldErrors, showApiError };
}

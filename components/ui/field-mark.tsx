/**
 * Trailing marker for a form field's label — a red asterisk for required
 * fields, "(Optional)" for optional ones. Purely cosmetic (no validation
 * logic here); each field's required/optional status is decided by its own
 * form based on what's actually enforced (client `required` attr / submit
 * check, or the backing Zod schema).
 */
export function Required() {
  return <span className="text-red-600"> *</span>;
}

export function Optional() {
  return <span className="text-muted-foreground font-normal"> (Optional)</span>;
}

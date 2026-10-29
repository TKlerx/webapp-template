export function safeLocalRedirectPath(value?: string | null) {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n\t]/.test(value)
  ) {
    return null;
  }
  return value;
}

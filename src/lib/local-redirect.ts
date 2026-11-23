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

export function passwordChangeReturnPath(value?: string | null) {
  const path = safeLocalRedirectPath(value);
  return path?.startsWith("/cli-login?") ? path : null;
}

export function requiredPasswordChangePath(returnTo?: string | null) {
  const path = passwordChangeReturnPath(returnTo);
  return path
    ? `/change-password?${new URLSearchParams({ returnTo: path })}`
    : "/change-password";
}

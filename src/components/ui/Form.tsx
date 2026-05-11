import type { FormHTMLAttributes, PropsWithChildren } from "react";

export function Form(
  props: PropsWithChildren<FormHTMLAttributes<HTMLFormElement>>,
) {
  return <form className="space-y-4" {...props} />;
}

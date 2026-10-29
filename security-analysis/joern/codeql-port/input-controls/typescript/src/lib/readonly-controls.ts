export function consume(value: string) { return value.length; }
export function fixedPath() { return "/done"; }
export function identity(value: string) { return value; }
export function mutate(holder: { destination: string }, value: string) { holder.destination = value; }

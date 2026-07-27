import type { AnyFieldConfig } from "./types";

export type ServerErrorResult<K extends string = string> = {
  fieldErrors?: Partial<Record<K, string>>;
  formError?: string;
};

export type AppliedServerErrors = {
  applied: string[];
  formError?: string;
};

type SetServerError = (name: string, error: { type: string; message: string }) => void;

export function applyServerErrors(
  setError: SetServerError,
  result: ServerErrorResult,
  fields: AnyFieldConfig[],
): AppliedServerErrors {
  const indexByRoot = new Map(fields.map((field, index) => [field.name, index]));
  const applied: [number, string][] = [];
  const unknown: string[] = [];

  for (const [name, message] of Object.entries(result.fieldErrors ?? {}) as [string, string][]) {
    const root = name.split(".")[0];
    const index = indexByRoot.get(root);
    if (index === undefined || (name !== root && fields[index].type !== "group")) {
      unknown.push(message);
      continue;
    }
    setError(name, { type: "server", message });
    applied.push([index, name]);
  }

  applied.sort(([a], [b]) => a - b);
  const formErrorParts = [result.formError, ...unknown].filter(
    (part): part is string => part !== undefined && part !== "",
  );
  return {
    applied: applied.map(([, name]) => name),
    formError: formErrorParts.length > 0 ? formErrorParts.join("; ") : undefined,
  };
}

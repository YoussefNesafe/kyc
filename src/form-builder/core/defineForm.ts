import type { FormConfig } from "./types";

export const defineForm = <const C extends FormConfig>(config: C): C => config;

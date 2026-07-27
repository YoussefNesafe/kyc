"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { OtpRuntime } from "../components/FieldRuntime";
import type { OtpVerifiedChecker } from "../core/validation";
import type { FormValues } from "../core/types";

export type OtpFieldHandlers = {
  send?: (values: FormValues) => Promise<void>;
  verify?: (code: string) => Promise<boolean>;
};

export type UseOtpControllerOptions = {
  fields?: Record<string, OtpFieldHandlers>;
  fallback?: {
    send?: (fieldName: string, values: FormValues) => Promise<void>;
    verify?: (fieldName: string, code: string) => Promise<boolean>;
  };
};

export type OtpController = {
  otp?: OtpRuntime;
  otpVerified: OtpVerifiedChecker;
  hasVerify: boolean;
  verifiedFields: ReadonlySet<string>;
};

export function useOtpController(options: UseOtpControllerOptions): OtpController {
  const { fields, fallback } = options;
  const verifiedCodes = useRef(new Map<string, { code: string; dep: unknown }>());
  const [verifiedFields, setVerifiedFields] = useState<ReadonlySet<string>>(new Set());

  const otpVerified = useCallback<OtpVerifiedChecker>(
    (fieldName, code) => verifiedCodes.current.get(fieldName)?.code === code,
    [],
  );

  const hasSend = !!fallback?.send || Object.values(fields ?? {}).some((entry) => entry.send);
  const hasVerify = !!fallback?.verify || Object.values(fields ?? {}).some((entry) => entry.verify);

  const otp = useMemo<OtpRuntime | undefined>(() => {
    if (!hasSend && !hasVerify) return undefined;

    const resolveSend = (fieldName: string) => {
      const mapped = fields?.[fieldName]?.send;
      if (mapped) return (values: FormValues) => mapped(values);
      if (fallback?.send) return (values: FormValues) => fallback.send!(fieldName, values);
      return undefined;
    };
    const resolveVerify = (fieldName: string) => {
      const mapped = fields?.[fieldName]?.verify;
      if (mapped) return (code: string) => mapped(code);
      if (fallback?.verify) return (code: string) => fallback.verify!(fieldName, code);
      return undefined;
    };

    return {
      send: hasSend
        ? async (fieldName, values) => {
            const send = resolveSend(fieldName);
            if (!send) {
              console.error(`useOtpController: no send handler for otp field "${fieldName}"`);
              throw new Error(`useOtpController: no send handler for otp field "${fieldName}"`);
            }
            await send(values);
          }
        : undefined,
      verify: hasVerify
        ? async (fieldName, code, depValue) => {
            const verify = resolveVerify(fieldName);
            if (!verify) {
              console.error(`useOtpController: no verify handler for otp field "${fieldName}"`);
              throw new Error(`useOtpController: no verify handler for otp field "${fieldName}"`);
            }
            const ok = await verify(code);
            if (ok) {
              verifiedCodes.current.set(fieldName, { code, dep: depValue });
              setVerifiedFields((prev) => new Set(prev).add(fieldName));
            }
            return ok;
          }
        : undefined,
      isVerifiedFor: (fieldName, depValue) => {
        const entry = verifiedCodes.current.get(fieldName);
        return !entry || Object.is(entry.dep, depValue);
      },
      invalidate: (fieldName) => {
        verifiedCodes.current.delete(fieldName);
        setVerifiedFields((prev) => {
          if (!prev.has(fieldName)) return prev;
          const next = new Set(prev);
          next.delete(fieldName);
          return next;
        });
      },
    };
  }, [fields, fallback, hasSend, hasVerify]);

  return { otp, otpVerified, hasVerify, verifiedFields };
}

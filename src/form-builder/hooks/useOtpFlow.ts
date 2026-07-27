"use client";

import { useEffect, useReducer, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { assertNever } from "../core/assertNever";
import { useFieldRuntime } from "../components/FieldRuntime";

export type OtpFlowStatus = "idle" | "sending" | "sent" | "verifying" | "verified";

type FlowState = {
  status: OtpFlowStatus;
  seconds: number;
  error: string | null;
  resend: boolean;
};

type FlowEvent =
  | { type: "SEND"; resend: boolean }
  | { type: "SENT"; seconds: number }
  | { type: "SEND_FAILED"; message: string }
  | { type: "VERIFY" }
  | { type: "VERIFIED" }
  | { type: "VERIFY_FAILED"; message: string }
  | { type: "TICK" }
  | { type: "CLEAR_ERROR" }
  | { type: "RESET" };

const initialState: FlowState = { status: "idle", seconds: 0, error: null, resend: false };

const TICK_INTERVAL_MS = 1000;
const DEFAULT_RESEND_DELAY_SECONDS = 30;

function reducer(state: FlowState, event: FlowEvent): FlowState {
  switch (event.type) {
    case "SEND":
      return { ...state, status: "sending", error: null, resend: event.resend };
    case "SENT":
      return { ...state, status: "sent", seconds: event.seconds };
    case "SEND_FAILED":
      return { ...state, status: state.resend ? "sent" : "idle", error: event.message };
    case "VERIFY":
      return { ...state, status: "verifying", error: null };
    case "VERIFIED":
      return { ...state, status: "verified", error: null, seconds: 0 };
    case "VERIFY_FAILED":
      return { ...state, status: "sent", error: event.message };
    case "TICK":
      return state.seconds > 0 ? { ...state, seconds: state.seconds - 1 } : state;
    case "CLEAR_ERROR":
      return state.error ? { ...state, error: null } : state;
    case "RESET":
      return initialState;
    default:
      return assertNever(event);
  }
}

export type OtpFlowConfig = {
  name: string;
  length: number;
  dependsOn?: string;
  resendDelaySeconds?: number;
};

export function useOtpFlow(config: OtpFlowConfig) {
  const { messages, otp, isFieldValid, verifiedFields } = useFieldRuntime();
  const { control, resetField, trigger, getValues } = useFormContext();
  const [state, dispatch] = useReducer(reducer, initialState, (initial) =>
    verifiedFields?.has(config.name) ? { ...initial, status: "verified" as const } : initial,
  );

  const generation = useRef(0);
  const attempted = useRef<string | null>(null);
  const resetPending = useRef(false);

  const code = (useWatch({ control, name: config.name }) as string) ?? "";
  const depValue = useWatch({
    control,
    name: config.dependsOn ?? "",
    disabled: !config.dependsOn,
  });
  const canSend =
    !config.dependsOn || (isFieldValid ? isFieldValid(config.dependsOn, depValue) : true);

  const reconciled = useRef(false);
  useEffect(() => {
    if (reconciled.current) return;
    reconciled.current = true;
    if (state.status !== "verified") return;
    if (otp?.isVerifiedFor && !otp.isVerifiedFor(config.name, depValue)) {
      generation.current += 1;
      attempted.current = null;
      otp.invalidate?.(config.name);
      resetField(config.name, { defaultValue: "" });
      dispatch({ type: "RESET" });
    }
  }, [state.status, otp, config.name, depValue, resetField]);

  const prevDep = useRef(depValue);
  useEffect(() => {
    if (Object.is(prevDep.current, depValue)) return;
    prevDep.current = depValue;
    if (state.status === "idle") return;
    generation.current += 1;
    attempted.current = null;
    resetPending.current = true;
    otp?.invalidate?.(config.name);
    resetField(config.name, { defaultValue: "" });
    dispatch({ type: "RESET" });
  }, [depValue, state.status, otp, resetField, config.name]);

  const counting = state.seconds > 0;
  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => dispatch({ type: "TICK" }), TICK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [counting]);

  useEffect(() => {
    if (resetPending.current) {
      resetPending.current = false;
      return;
    }
    const eligible = state.status === "sent" || (!otp?.send && state.status === "idle");
    if (!otp?.verify || !eligible) return;
    if (code.length !== config.length || attempted.current === code) return;
    attempted.current = code;
    const stamp = generation.current;
    dispatch({ type: "VERIFY" });
    otp
      .verify(config.name, code, depValue)
      .then((ok) => {
        if (stamp !== generation.current) return;
        if (ok) {
          dispatch({ type: "VERIFIED" });
          void trigger(config.name);
        } else {
          dispatch({ type: "VERIFY_FAILED", message: messages.otpVerifyFailed });
        }
      })
      .catch(() => {
        if (stamp !== generation.current) return;
        dispatch({ type: "VERIFY_FAILED", message: messages.otpVerifyFailed });
      });
  }, [otp, state.status, code, depValue, config.length, config.name, messages.otpVerifyFailed, trigger]);

  const send = async () => {
    if (!otp?.send || !canSend || state.status === "sending" || state.status === "verified") return;
    const resend = state.status !== "idle";
    attempted.current = null;
    if (resend) resetField(config.name, { defaultValue: "" });
    const stamp = ++generation.current;
    dispatch({ type: "SEND", resend });
    try {
      await otp.send(config.name, getValues());
      if (stamp !== generation.current) return;
      dispatch({ type: "SENT", seconds: config.resendDelaySeconds ?? DEFAULT_RESEND_DELAY_SECONDS });
    } catch {
      if (stamp !== generation.current) return;
      dispatch({ type: "SEND_FAILED", message: messages.otpSendFailed });
    }
  };

  const gated = !!otp?.send;
  return {
    status: state.status,
    seconds: state.seconds,
    error: state.error,
    canSend,
    inputsDisabled: gated ? state.status !== "sent" : state.status === "verified",
    showSend: gated,
    showResend: gated && (state.status === "sent" || state.status === "verifying"),
    send,
    clearError: () => dispatch({ type: "CLEAR_ERROR" }),
  };
}

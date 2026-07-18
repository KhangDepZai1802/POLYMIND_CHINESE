"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmationOptions = {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
};

type ConfirmationRequest = ConfirmationOptions & { id: number };
type ConfirmationContextValue = (
  options: ConfirmationOptions,
) => Promise<boolean>;

const ConfirmationContext = createContext<ConfirmationContextValue | null>(
  null,
);

export function ConfirmationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  const requestId = useRef(0);

  const settle = useCallback((confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setRequest(null);
  }, []);

  const confirm = useCallback<ConfirmationContextValue>((options) => {
    resolver.current?.(false);
    requestId.current += 1;
    setRequest({ ...options, id: requestId.current });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmationContext.Provider value={value}>
      {children}
      <AlertDialog
        open={request !== null}
        onOpenChange={(open) => {
          if (!open && request) settle(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {request?.title ?? "Xác nhận thao tác"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {request?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>
              {request?.cancelLabel ?? "Hủy"}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                request?.variant === "destructive" &&
                  buttonVariants({ variant: "destructive" }),
              )}
              onClick={() => settle(true)}
            >
              {request?.confirmLabel ?? "Xác nhận"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  const confirm = useContext(ConfirmationContext);
  if (!confirm) {
    throw new Error(
      "useConfirmation phải được dùng bên trong ConfirmationProvider.",
    );
  }
  return confirm;
}

export function useConfirmSubmit(options: ConfirmationOptions, enabled = true) {
  const confirm = useConfirmation();

  return async (event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    if (!enabled) return;
    if (form.dataset.confirmedSubmit === "true") {
      delete form.dataset.confirmedSubmit;
      return;
    }

    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    if (!(await confirm(options))) return;

    form.dataset.confirmedSubmit = "true";
    form.requestSubmit(submitter ?? undefined);
  };
}

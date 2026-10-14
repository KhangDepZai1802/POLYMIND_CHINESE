"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { useFormAction } from "@/lib/use-form-action";
import {
  saveMarketAction,
  saveOrderAction,
} from "@/features/xkld/server/order-actions";
import {
  ORDER_STATUSES,
  SALARY_PERIODS,
  type Market,
  type RecruitmentOrder,
} from "@/features/xkld/domain/orders";

type FieldProps = {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix: string;
  error?: string;
  type?: string;
  max?: number;
  min?: number;
  step?: number;
  options?: [string, string][];
  multiline?: boolean;
};
function Field({
  name,
  label,
  value,
  onChange,
  suffix,
  error,
  type = "text",
  max,
  min,
  step,
  options,
  multiline,
}: FieldProps) {
  const common = {
    id: `${name}-${suffix}`,
    name,
    value,
    required: true,
    "aria-invalid": !!error,
    "aria-describedby": error ? `${name}-error-${suffix}` : undefined,
  };
  return (
    <div className="space-y-1.5">
      <Label htmlFor={common.id}>{label} *</Label>
      {options ? (
        <select
          {...common}
          onChange={(event) => onChange(event.target.value)}
          className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
        >
          <option value="" disabled>
            Chọn {label.toLowerCase()}
          </option>
          {options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      ) : multiline ? (
        <Textarea
          {...common}
          maxLength={max}
          rows={4}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          {...common}
          type={type}
          maxLength={type === "number" ? undefined : max}
          max={type === "number" ? max : undefined}
          min={min}
          step={step}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {error && (
        <p id={`${name}-error-${suffix}`} className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

export function MarketDialog({ market }: { market?: Market }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const router = useRouter();
  const { state, formAction } = useFormAction(saveMarketAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  const suffix = market?.id ?? "new-market";
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setToken(crypto.randomUUID());
          setDraft({
            country_code: market?.country_code ?? "",
            country_name: market?.country_name ?? "",
            currency_code: market?.currency_code ?? "",
            is_active: String(market?.is_active ?? true),
          });
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        {market ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Sửa thị trường ${market.country_name}`}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button variant="outline">
            <Plus className="size-4" aria-hidden />
            Thêm thị trường
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {market ? "Sửa thị trường" : "Thêm thị trường"}
          </DialogTitle>
          <DialogDescription>
            Danh mục quốc gia và tiền tệ mặc định. Ngừng sử dụng vẫn giữ các đơn
            hàng đã có.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="id" value={market?.id ?? ""} />
            <input type="hidden" name="create_request_id" value={token} />
            <input
              type="hidden"
              name="updated_at"
              value={market?.updated_at ?? ""}
            />
            {[
              { name: "country_name", label: "Quốc gia", max: 100 },
              {
                name: "country_code",
                label: "Mã quốc gia (SG, JP, TW…)",
                max: 2,
              },
              {
                name: "currency_code",
                label: "Tiền tệ mặc định (SGD, JPY, TWD…)",
                max: 3,
              },
            ].map((field) => (
              <Field
                key={field.name}
                {...field}
                suffix={suffix}
                value={draft[field.name] ?? ""}
                onChange={(v) =>
                  setDraft((old) => ({ ...old, [field.name]: v }))
                }
                error={state.fieldErrors?.[field.name]}
              />
            ))}
            <Field
              name="is_active"
              label="Tình trạng thị trường"
              suffix={suffix}
              value={draft.is_active ?? "true"}
              onChange={(v) => setDraft((old) => ({ ...old, is_active: v }))}
              options={[
                ["true", "Đang sử dụng"],
                ["false", "Ngừng sử dụng"],
              ]}
              error={state.fieldErrors?.is_active}
            />
            {state.error && (
              <p role="alert" className="text-destructive text-sm">
                {state.error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Hủy
              </Button>
              <SubmitButton>Lưu thị trường</SubmitButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function OrderDialog({
  order,
  markets,
}: {
  order?: RecruitmentOrder;
  markets: Market[];
}) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const router = useRouter();
  const { state, formAction } = useFormAction(saveOrderAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  const suffix = order?.id ?? "new-order";
  const eligible = markets.filter(
    (m) => m.is_active || m.id === order?.market_id,
  );
  function change(name: string, value: string) {
    setDraft((old) => ({ ...old, [name]: value }));
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setToken(crypto.randomUUID());
          setDraft({
            market_id: order?.market_id ?? "",
            employer: order?.employer ?? "",
            industry: order?.industry ?? "",
            recruitment_quantity: order
              ? String(order.recruitment_quantity)
              : "",
            salary_amount: order ? String(order.salary_amount) : "",
            salary_currency: order?.salary_currency ?? "",
            salary_period: order?.salary_period ?? "month",
            conditions: order?.conditions ?? "",
            recruitment_deadline: order?.recruitment_deadline ?? "",
            partner: order?.partner ?? "",
            status: order?.status ?? "open",
          });
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        {order ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Sửa đơn hàng ${order.code}`}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button disabled={!markets.some((m) => m.is_active)}>
            <Plus className="size-4" aria-hidden />
            Thêm đơn hàng
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {order ? `Sửa đơn hàng ${order.code}` : "Thêm đơn hàng"}
          </DialogTitle>
          <DialogDescription>
            Mã đơn hàng được cấp tự động. Nhập rõ tiền tệ và kỳ lương; không quy
            đổi tiền tệ.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="id" value={order?.id ?? ""} />
            <input type="hidden" name="create_request_id" value={token} />
            <input
              type="hidden"
              name="updated_at"
              value={order?.updated_at ?? ""}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="market_id"
                label="Quốc gia / thị trường"
                suffix={suffix}
                value={draft.market_id ?? ""}
                options={eligible.map((m) => [
                  m.id,
                  `${m.country_name}${m.is_active ? "" : " (ngừng sử dụng)"}`,
                ])}
                error={state.fieldErrors?.market_id}
                onChange={(v) => {
                  const market = markets.find((m) => m.id === v);
                  setDraft((old) => ({
                    ...old,
                    market_id: v,
                    salary_currency:
                      market?.currency_code ?? old.salary_currency ?? String(),
                  }));
                }}
              />
              {[
                { name: "employer", label: "Chủ sử dụng", max: 300 },
                { name: "industry", label: "Ngành nghề", max: 200 },
                {
                  name: "recruitment_quantity",
                  label: "Số lượng tuyển",
                  type: "number",
                  min: 1,
                  max: 1000000,
                  step: 1,
                },
                {
                  name: "salary_amount",
                  label: "Mức lương",
                  type: "number",
                  min: 0.01,
                  max: 999999999999.99,
                  step: 0.01,
                },
                {
                  name: "salary_currency",
                  label: "Tiền tệ (SGD, JPY, TWD…)",
                  max: 3,
                },
              ].map((field) => (
                <Field
                  key={field.name}
                  {...field}
                  suffix={suffix}
                  value={draft[field.name] ?? ""}
                  onChange={(v) => change(field.name, v)}
                  error={state.fieldErrors?.[field.name]}
                />
              ))}
              <Field
                name="salary_period"
                label="Kỳ lương"
                suffix={suffix}
                value={draft.salary_period ?? "month"}
                options={Object.entries(SALARY_PERIODS)}
                onChange={(v) => change("salary_period", v)}
                error={state.fieldErrors?.salary_period}
              />
              <Field
                name="recruitment_deadline"
                label="Hạn tuyển"
                type="date"
                suffix={suffix}
                value={draft.recruitment_deadline ?? ""}
                onChange={(v) => change("recruitment_deadline", v)}
                error={state.fieldErrors?.recruitment_deadline}
              />
              <Field
                name="partner"
                label="Đối tác"
                max={300}
                suffix={suffix}
                value={draft.partner ?? ""}
                onChange={(v) => change("partner", v)}
                error={state.fieldErrors?.partner}
              />
              <Field
                name="status"
                label="Trạng thái đơn hàng"
                suffix={suffix}
                value={draft.status ?? "open"}
                options={Object.entries(ORDER_STATUSES)}
                onChange={(v) => change("status", v)}
                error={state.fieldErrors?.status}
              />
            </div>
            <Field
              name="conditions"
              label="Điều kiện tuyển"
              max={5000}
              multiline
              suffix={suffix}
              value={draft.conditions ?? ""}
              onChange={(v) => change("conditions", v)}
              error={state.fieldErrors?.conditions}
            />
            {state.error && (
              <p role="alert" className="text-destructive text-sm">
                {state.error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Hủy
              </Button>
              <SubmitButton>Lưu đơn hàng</SubmitButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { createClient } from "@supabase/supabase-js";

process.loadEnvFile?.(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publishableKey || !serviceRoleKey) {
  throw new Error("Thiếu Supabase env trong .env.local.");
}

const service = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = `Concurrency-${crypto.randomUUID()}!`;
const adminEmail = `concurrency-admin-${suffix}@polymind.test`;
const studentEmail = `concurrency-student-${suffix}@polymind.test`;

let adminId;
let studentUserId;
let studentId;
let invoiceId;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function insert(table, values) {
  const { data, error } = await service.from(table).insert(values).select().single();
  if (error) throw error;
  return data;
}

try {
  const adminUser = await service.auth.admin.createUser({
    email: adminEmail,
    password,
    email_confirm: true,
  });
  if (adminUser.error) throw adminUser.error;
  adminId = adminUser.data.user.id;

  const studentUser = await service.auth.admin.createUser({
    email: studentEmail,
    password,
    email_confirm: true,
  });
  if (studentUser.error) throw studentUser.error;
  studentUserId = studentUser.data.user.id;

  const profiles = await service.from("profiles").insert([
    { id: adminId, role: "super_admin", full_name: "Admin concurrency", email: adminEmail },
    {
      id: studentUserId,
      role: "student",
      full_name: "Học viên concurrency",
      email: studentEmail,
    },
  ]);
  if (profiles.error) throw profiles.error;

  const student = await insert("students", {
    user_id: studentUserId,
    student_code: `HV-RACE-${suffix}`,
    full_name: "Học viên concurrency",
  });
  studentId = student.id;

  const invoice = await insert("tuition_invoices", {
    invoice_code: `HD-RACE-${suffix}`,
    student_id: studentId,
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
    subtotal: 1_000_000,
    discount: 0,
    total: 1_000_000,
    status: "issued",
    created_by: adminId,
  });
  invoiceId = invoice.id;

  const makeActor = async () => {
    const client = createClient(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signedIn = await client.auth.signInWithPassword({ email: adminEmail, password });
    if (signedIn.error) throw signedIn.error;
    return client;
  };
  const [actorA, actorB] = await Promise.all([makeActor(), makeActor()]);

  const attempts = await Promise.allSettled([
    actorA.rpc("record_tuition_payment", {
      p_invoice_id: invoiceId,
      p_amount: 1_000_000,
      p_method: "bank_transfer",
      p_reference: "RACE-A",
      p_note: "Request đồng thời A",
    }),
    actorB.rpc("record_tuition_payment", {
      p_invoice_id: invoiceId,
      p_amount: 1_000_000,
      p_method: "bank_transfer",
      p_reference: "RACE-B",
      p_note: "Request đồng thời B",
    }),
  ]);

  const rpcSuccesses = attempts.filter(
    (attempt) => attempt.status === "fulfilled" && !attempt.value.error,
  );
  const [payments, receipts, finalInvoice] = await Promise.all([
    service.from("tuition_payments").select("id").eq("invoice_id", invoiceId),
    service
      .from("tuition_receipts")
      .select("id, payment:tuition_payments!inner(invoice_id)")
      .eq("payment.invoice_id", invoiceId),
    service.from("tuition_invoices").select("status").eq("id", invoiceId).single(),
  ]);

  assert(rpcSuccesses.length === 1, `Muốn 1 RPC thành công, nhận ${rpcSuccesses.length}.`);
  assert(payments.data?.length === 1, `Muốn 1 payment, nhận ${payments.data?.length}.`);
  assert(receipts.data?.length === 1, `Muốn 1 receipt, nhận ${receipts.data?.length}.`);
  assert(finalInvoice.data?.status === "paid", "Invoice không kết thúc ở trạng thái paid.");

  console.log("PASS payment concurrency: 2 request, 1 payment, 1 receipt, invoice paid.");
} finally {
  if (invoiceId) {
    const payments = await service
      .from("tuition_payments")
      .select("id")
      .eq("invoice_id", invoiceId);
    const paymentIds = (payments.data ?? []).map((payment) => payment.id);
    if (paymentIds.length) {
      await service.from("tuition_receipts").delete().in("payment_id", paymentIds);
    }
    await service.from("tuition_payments").delete().eq("invoice_id", invoiceId);
    await service.from("audit_logs").delete().eq("resource_id", invoiceId);
    await service.from("tuition_invoices").delete().eq("id", invoiceId);
  }
  if (studentId) await service.from("students").delete().eq("id", studentId);
  if (adminId) await service.auth.admin.deleteUser(adminId);
  if (studentUserId) await service.auth.admin.deleteUser(studentUserId);
}

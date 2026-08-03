/**
 * CẤP TÀI KHOẢN ĐĂNG NHẬP HÀNG LOẠT CHO HỌC VIÊN (`STUDENT-ACCT-1`).
 *
 * `students.user_id` để nullable là cố ý (xem `createStudentAction`): trung tâm
 * nhập danh sách lớp trước, mời sau. Script này là bước "mời sau" cho cả 55 học
 * viên của `DATA-SEED-1` trong một lượt, thay vì bấm nút *Cấp tài khoản* ở
 * `/admin/students` 55 lần.
 *
 * ⚠️ **MẶC ĐỊNH CHẠY KHÔ.** Không có `--apply` thì không tạo gì — chỉ in bảng
 * tên đăng nhập theo từng lớp để soi trước. Đây là thao tác **dữ liệu**, không
 * phải migration; không file SQL nào được thêm.
 *
 * 🔴 CÙNG MỘT ĐƯỜNG GHI VỚI GIAO DIỆN, KHÔNG PHẢI ĐƯỜNG THỨ HAI (bài học
 * `BUG_M10_01`). Ba bước dưới đây là bản sao đúng thứ tự của
 * `provisionPasswordAccount` + `provisionStudentAccountAction`:
 *   1. `auth.admin.createUser` với `<username>@login.polymind.local`
 *      — 🔴 KHÔNG chèn tay vào `auth.users`; `seed.dev.sql` đã ghi cái bẫy các
 *        cột token phải là `''` chứ không được `NULL`, sai là GoTrue crash lúc
 *        đăng nhập.
 *   2. `profiles` upsert (role `student`, `is_active`)
 *   3. `students.user_id` trỏ về tài khoản vừa tạo
 * Hỏng ở bước 2 hoặc 3 thì **cuốn ngược** bước trước đó ngay trong lượt, để
 * không để lại tài khoản đăng nhập được mà không gắn với học viên nào.
 *
 * 🔴 ATTRIBUTION (bài học `BUG_M06_01`): service role cho `auth.uid()` = null nên
 * `log_audit` từ chối ("Phải đăng nhập mới ghi được audit"). Script ghi thẳng
 * `audit_logs` với `actor_id` là **super_admin có thật, được dò tường minh** —
 * không bao giờ là "user đầu tiên trong DB". Có nhiều hơn một super_admin thì
 * script DỪNG và bắt truyền `--actor-id`.
 *
 * ⛔ Học viên ĐÃ CÓ `user_id` mặc định bị BỎ QUA — đổi mật khẩu người đang dùng
 * là việc khác hẳn với cấp tài khoản mới. Muốn thế thì `--reset-existing`.
 *
 * Cách dùng (PowerShell):
 *   $env:NEXT_PUBLIC_SUPABASE_URL="<url cloud>"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="<service role key>"
 *   npm run students:accounts                     # chạy khô, in bảng
 *   npm run students:accounts -- --apply          # cấp thật
 *   npm run students:accounts -- --csv=danh-sach.csv
 *
 * Tuỳ chọn:
 *   --apply              cấp thật (mặc định chạy khô)
 *   --password=<chuỗi>   mặc định `12345678` (Supabase bắt tối thiểu 8 ký tự)
 *   --actor-id=<uuid>    super_admin ghi vào audit khi DB có nhiều hơn một
 *   --reset-existing     đặt lại tên đăng nhập + mật khẩu cho cả người đã có
 *   --csv=<đường dẫn>    xuất thêm file CSV danh sách tài khoản
 *
 * 🔴 Chạy với project NÀO thì tạo tài khoản trên project ĐÓ. `.env.local` của
 * máy dev trỏ về Supabase local — muốn lên cloud thì đặt biến ở dòng lệnh.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import {
  buildStudentUsername,
  usernameToLoginEmail,
} from "./lib/student-username.mjs";

/** Giống `OPEN_ENROLLMENT_STATUSES` của `src/lib/domain/enrollment.ts`. */
const OPEN_ENROLLMENT_STATUSES = ["pending", "active", "paused"];

/** Giống `adminPasswordSchema` + `[auth].minimum_password_length` = 8. */
const MIN_PASSWORD_LENGTH = 8;

// =====================================================================
// Tham số + kết nối
// =====================================================================

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function option(name) {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const apply = flag("apply");
const resetExisting = flag("reset-existing");
const password = option("password") ?? "12345678";
const actorIdArg = option("actor-id");
const csvPath = option("csv");

function loadEnvLocal() {
  const path = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
    ".env.local",
  );
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, value] = match;
    if (process.env[key]) continue;
    process.env[key] = value.trim().replace(/^["']|["']$/g, "");
  }
}

loadEnvLocal();

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Chạy lên cloud thì đặt thẳng ở dòng lệnh để không dính .env.local của máy dev.",
  );
  process.exit(1);
}

function newClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const supabase = newClient();

function die(message) {
  console.error(`\n⛔ DỪNG — ${message}`);
  process.exit(1);
}

// =====================================================================
// Đọc dữ liệu
// =====================================================================

const { data: students, error: studentError } = await supabase
  .from("students")
  .select(
    `id, student_code, full_name, phone, email, user_id, status,
     enrollments (status, class:classes (code, name))`,
  )
  .order("student_code");

if (studentError)
  die(`không đọc được danh sách học viên: ${studentError.message}`);
if (!students || students.length === 0) die("không có học viên nào trong DB.");

const { data: profiles, error: profileError } = await supabase
  .from("profiles")
  .select("id, username, role, full_name, is_active");

if (profileError) die(`không đọc được profiles: ${profileError.message}`);

/** Lớp hiển thị = lớp có ghi danh ĐANG MỞ. Học viên đã rút không tính. */
function classOf(student) {
  const open = (student.enrollments ?? []).find((e) =>
    OPEN_ENROLLMENT_STATUSES.includes(e.status),
  );
  return {
    code: open?.class?.code ?? "(chưa ghi danh)",
    name: open?.class?.name ?? "",
  };
}

// =====================================================================
// Cổng fail-closed — chạy HẾT trước khi ghi bất cứ thứ gì
// =====================================================================

const problems = [];

// G1 — mật khẩu đủ dài. Ngắn hơn thì GoTrue từ chối ở người đầu tiên và ta có
// một lô cấp dở dang, chứ không phải một thông báo lỗi gọn.
if (password.length < MIN_PASSWORD_LENGTH) {
  problems.push(
    `Mật khẩu "${password}" chỉ ${password.length} ký tự — Supabase Auth bắt tối thiểu ${MIN_PASSWORD_LENGTH}.`,
  );
}

// G2 — mọi học viên dựng được tên đăng nhập hợp lệ.
const rows = [];
for (const student of students) {
  const built = buildStudentUsername(student.full_name);
  if (!built.ok) {
    problems.push(`${student.student_code}: ${built.reason}`);
    continue;
  }
  rows.push({
    ...student,
    username: built.username,
    loginEmail: usernameToLoginEmail(built.username),
    class: classOf(student),
  });
}

// G3 — không hai học viên nào ra cùng một tên đăng nhập.
const byUsername = new Map();
for (const row of rows) {
  const twin = byUsername.get(row.username);
  if (twin) {
    problems.push(
      `Trùng tên đăng nhập "${row.username}": ${twin.student_code} ${twin.full_name} ↔ ${row.student_code} ${row.full_name}. ` +
        `Sửa họ tên cho khác nhau, hoặc quyết một tên riêng rồi cấp tay người đó ở /admin/students.`,
    );
  }
  byUsername.set(row.username, row);
}

// G4 — không giẫm lên tài khoản của người khác (giáo viên, admin, học viên cũ).
const profileById = new Map(profiles.map((p) => [p.id, p]));
for (const row of rows) {
  const owner = profiles.find((p) => p.username === row.username);
  if (owner && owner.id !== row.user_id) {
    problems.push(
      `Tên đăng nhập "${row.username}" của ${row.student_code} ${row.full_name} ĐÃ THUỘC VỀ ` +
        `${owner.full_name} (${owner.role}). Không ghi đè.`,
    );
  }
}

// G5 — actor cho audit phải là super_admin CÓ THẬT, dò tường minh.
const superAdmins = profiles.filter(
  (p) => p.role === "super_admin" && p.is_active,
);
let actorId = actorIdArg;
if (actorId) {
  const actor = profileById.get(actorId);
  if (!actor || actor.role !== "super_admin") {
    problems.push(
      `--actor-id=${actorId} không phải super_admin đang hoạt động.`,
    );
  }
} else if (superAdmins.length === 1) {
  actorId = superAdmins[0].id;
} else {
  problems.push(
    `DB có ${superAdmins.length} super_admin đang hoạt động — không tự đoán được actor cho audit. ` +
      `Truyền --actor-id=<uuid>.`,
  );
}

// =====================================================================
// In bảng
// =====================================================================

const groups = new Map();
for (const row of rows) {
  const key = row.class.code;
  if (!groups.has(key)) groups.set(key, { name: row.class.name, rows: [] });
  groups.get(key).rows.push(row);
}

const willCreate = rows.filter((r) => !r.user_id);
const willReset = rows.filter((r) => r.user_id && resetExisting);
const willSkip = rows.filter((r) => r.user_id && !resetExisting);

console.log(
  `\n${apply ? "🔴 CẤP THẬT" : "🧪 CHẠY KHÔ (chưa ghi gì)"} — ${supabaseUrl}`,
);
console.log(
  `Học viên: ${students.length} · cấp mới: ${willCreate.length} · ` +
    `đặt lại: ${willReset.length} · bỏ qua (đã có tài khoản): ${willSkip.length}`,
);
console.log(`Mật khẩu dùng chung: ${password}\n`);

for (const [code, group] of [...groups].sort()) {
  console.log(
    `── ${code}${group.name ? ` — ${group.name}` : ""} (${group.rows.length} học viên)`,
  );
  for (const row of group.rows) {
    const state = !row.user_id ? "mới " : resetExisting ? "đặt lại" : "bỏ qua";
    console.log(
      `   ${row.student_code}  ${row.full_name.padEnd(26)} ${row.username.padEnd(24)} ${state}`,
    );
  }
  console.log("");
}

if (problems.length > 0) {
  console.error("⛔ CỔNG FAIL-CLOSED CHẶN — không ghi gì:\n");
  for (const p of problems) console.error(`   • ${p}`);
  process.exit(1);
}

if (csvPath) {
  const csv = [
    "lop,ma_hoc_vien,ho_ten,ten_dang_nhap,email_dang_nhap,mat_khau",
    ...rows.map((r) =>
      [
        r.class.code,
        r.student_code,
        `"${r.full_name}"`,
        r.username,
        r.loginEmail,
        password,
      ].join(","),
    ),
  ].join("\n");
  writeFileSync(csvPath, `﻿${csv}`, "utf8");
  console.log(`📄 Đã ghi ${csvPath} (${rows.length} dòng).\n`);
}

if (!apply) {
  console.log(
    "Chạy khô xong, không ghi gì. Ưng thì chạy lại kèm `-- --apply`.\n",
  );
  process.exit(0);
}

// =====================================================================
// Cấp thật
// =====================================================================

const targets = resetExisting ? rows : willCreate;
const done = [];
const failed = [];

for (const row of targets) {
  let userId = row.user_id ?? null;
  let createdUser = false;

  // --- (1) tài khoản đăng nhập ---------------------------------------------
  if (userId) {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      email: row.loginEmail,
      password,
      email_confirm: true,
    });
    if (error) {
      failed.push([row, `updateUser: ${error.message}`]);
      continue;
    }
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: row.loginEmail,
      password,
      email_confirm: true,
    });
    if (error || !data?.user) {
      failed.push([row, `createUser: ${error?.message ?? "không rõ"}`]);
      continue;
    }
    userId = data.user.id;
    createdUser = true;
  }

  // --- (2) hồ sơ ------------------------------------------------------------
  const { error: upsertError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      username: row.username,
      role: "student",
      full_name: row.full_name,
      phone: row.phone ?? null,
      email: row.email ?? null,
      is_active: true,
    },
    { onConflict: "id" },
  );

  if (upsertError) {
    if (createdUser) await supabase.auth.admin.deleteUser(userId);
    failed.push([row, `profiles: ${upsertError.message}`]);
    continue;
  }

  // --- (3) nối hồ sơ học viên với tài khoản ---------------------------------
  const { error: linkError } = await supabase
    .from("students")
    .update({ user_id: userId })
    .eq("id", row.id);

  if (linkError) {
    // Cuốn ngược: tài khoản đăng nhập được mà không gắn học viên nào là rác
    // nguy hiểm hơn là không có tài khoản.
    if (createdUser) await supabase.auth.admin.deleteUser(userId);
    failed.push([row, `students.user_id: ${linkError.message}`]);
    continue;
  }

  // --- (4) audit ------------------------------------------------------------
  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: actorId,
    actor_role: "super_admin",
    action: createdUser ? "student.account_create" : "student.password_reset",
    resource_type: "student",
    resource_id: row.id,
    after: {
      username: row.username,
      via: "scripts/provision-student-accounts",
    },
  });
  // Audit hỏng KHÔNG được làm hỏng nghiệp vụ (cùng luật với `lib/audit.ts`).
  if (auditError) {
    console.warn(`   ⚠️ audit ${row.student_code}: ${auditError.message}`);
  }

  done.push(row);
  console.log(`   ✅ ${row.student_code}  ${row.username}`);
}

// =====================================================================
// Đo lại bằng KẾT NỐI MỚI — không tin số vừa đếm trong bộ nhớ
// =====================================================================

const verifier = newClient();

const { count: linked } = await verifier
  .from("students")
  .select("id", { count: "exact", head: true })
  .not("user_id", "is", null);

const { count: studentProfiles } = await verifier
  .from("profiles")
  .select("id", { count: "exact", head: true })
  .eq("role", "student");

console.log(
  `\nXong: cấp/đặt lại ${done.length} · lỗi ${failed.length}\n` +
    `Đo bằng kết nối mới: students có user_id = ${linked} · profiles role=student = ${studentProfiles}`,
);

if (failed.length > 0) {
  console.error(
    "\n⛔ Các ca hỏng (chạy lại script là an toàn, nó bỏ qua người đã có tài khoản):",
  );
  for (const [row, reason] of failed) {
    console.error(`   • ${row.student_code} ${row.full_name}: ${reason}`);
  }
  process.exit(1);
}

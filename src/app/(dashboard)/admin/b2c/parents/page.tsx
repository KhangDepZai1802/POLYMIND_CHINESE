import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ParentDialog } from "@/features/b2c/components/parent-dialog";
import { PARENT_RELATIONSHIP_LABELS, type ParentRow } from "@/features/b2c/domain/parents";
import { requireManager } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = {title:"Phụ huynh"};
export default async function ParentsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  await requireManager();
  const params=await searchParams;
  const query=typeof params.q === "string" ? params.q.trim().slice(0,200) : "";
  const n=typeof params.page === "string" ? Number(params.page) : 0;
  const page=Number.isSafeInteger(n) && n>=0 && n<=1000000 ? n : 0;
  const {data,error}=await (await createClient()).rpc("get_b2c_parents_page",{p_query:query,p_page:page});
  if(error) throw new Error("Không tải được danh sách phụ huynh.");
  const result=data as unknown as {parents:ParentRow[];total:number};
  const href=(next:number)=>`/admin/b2c/parents?${new URLSearchParams({q:query,page:String(next)})}`;
  return <><PageHeader title="Phụ huynh" description="Thông tin phụ huynh và các con đang học tại trung tâm." />
    <div className="mb-4 flex flex-wrap items-center gap-3"><form method="get" className="flex gap-2"><Input name="q" defaultValue={query} maxLength={200} aria-label="Tìm phụ huynh" placeholder="Tên phụ huynh, SĐT, tên/mã con…" /><Button type="submit" variant="outline">Tìm kiếm</Button></form><span className="text-muted-foreground text-sm">{result.total} hồ sơ</span><div className="ml-auto"><ParentDialog /></div></div>
    <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[750px] text-left text-sm"><thead className="bg-muted"><tr>{["Phụ huynh","SĐT phụ huynh","Zalo","Các con / Quan hệ","Thao tác"].map((heading)=><th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead><tbody>{result.parents.length ? result.parents.map((parent)=><tr key={parent.id} className="border-t align-top"><td className="px-4 py-3 font-medium">{parent.full_name}</td><td className="px-4 py-3">{parent.phone ?? "Chưa có"}</td><td className="px-4 py-3">{parent.zalo ?? "Chưa có"}</td><td className="px-4 py-3">{parent.children.length ? parent.children.map((child)=><div key={child.code} className="mb-1">{child.full_name} <span className="text-muted-foreground">({child.code}) · {PARENT_RELATIONSHIP_LABELS[child.relationship]}</span></div>) : "Chưa liên kết học viên"}</td><td className="px-4 py-3"><ParentDialog parent={parent} /></td></tr>) : <tr><td colSpan={5} className="text-muted-foreground py-10 text-center">Chưa có phụ huynh phù hợp.</td></tr>}</tbody></table></div>
    <div className="mt-3 flex items-center justify-between text-sm">{page>0 ? <Link href={href(page-1)}>← Trước</Link> : <span />}<span>Trang {page+1}/{Math.max(1,Math.ceil(result.total/50))}</span>{(page+1)*50<result.total ? <Link href={href(page+1)}>Sau →</Link> : <span />}</div>
  </>;
}

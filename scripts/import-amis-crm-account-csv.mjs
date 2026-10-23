import fs from "node:fs";
import process from "node:process";
import {createClient} from "@supabase/supabase-js";
process.loadEnvFile(".env.local");
const file=process.argv[2];if(!file)throw new Error("Provide CRM account CSV path");
function csv(text){const out=[];let row=[],cell="",quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(ch==='"')quoted=false;else cell+=ch;}else if(ch==='"')quoted=true;else if(ch===','){row.push(cell);cell="";}else if(ch==='\n'){row.push(cell.replace(/\r$/,"") );out.push(row);row=[];cell="";}else cell+=ch;}if(cell||row.length){row.push(cell);out.push(row);}return out;}
const table=csv(fs.readFileSync(file,"utf8"));const headers=table.shift().map(h=>h.replace(/^\uFEFF/,"").trim());const at=(r,n)=>r[headers.indexOf(n)]??"";const digits=v=>String(v).replace(/\D/g,"");const phone=v=>{const d=digits(v);return /^0[35789]\d{8}$/.test(d)?d:""};
const rows=table.filter(r=>r.some(Boolean)).map(r=>({crm_code:at(r,"Mã khách hàng").trim(),full_name:at(r,"Tên khách hàng").trim(),phone:phone(at(r,"Điện thoại")),order_sales:Number(digits(at(r,"Doanh số đơn hàng"))||0),last_purchase_date:at(r,"Ngày mua hàng gần nhất").slice(0,10),days_since_purchase:digits(at(r,"Số ngày chưa mua hàng"))||null}));
if(rows.length!==78||new Set(rows.map(r=>r.crm_code)).size!==78)throw new Error("CSV safety check failed");
const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const{data,error}=await sb.rpc("sync_amis_crm_account_snapshot",{p_rows:rows});if(error)throw new Error(`CRM snapshot import failed: ${error.code} ${error.message}`);const{data:students,error:studentError}=await sb.rpc("promote_amis_crm_buyers_to_students");if(studentError)throw new Error(`CRM student promotion failed: ${studentError.code} ${studentError.message}`);console.log(JSON.stringify({snapshot:data,students}));

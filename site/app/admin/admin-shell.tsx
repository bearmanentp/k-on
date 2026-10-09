"use client";

import dynamic from "next/dynamic";

const AdminApp=dynamic(()=>import("./admin-app"),{ssr:false,loading:()=> <div className="admin-loading">관리 시스템을 불러오는 중입니다…</div>});

export default function AdminShell(){return <AdminApp/>;}

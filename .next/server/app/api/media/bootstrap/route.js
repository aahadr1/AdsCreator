"use strict";(()=>{var e={};e.id=635,e.ids=[635],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},13685:e=>{e.exports=require("http")},95687:e=>{e.exports=require("https")},85477:e=>{e.exports=require("punycode")},12781:e=>{e.exports=require("stream")},57310:e=>{e.exports=require("url")},59796:e=>{e.exports=require("zlib")},95046:(e,i,t)=>{t.r(i),t.d(i,{originalPathname:()=>b,patchFetch:()=>f,requestAsyncStorage:()=>c,routeModule:()=>u,serverHooks:()=>_,staticGenerationAsyncStorage:()=>m});var a={};t.r(a),t.d(a,{POST:()=>p,dynamic:()=>d,runtime:()=>o});var s=t(49303),r=t(88716),n=t(60670),l=t(69498);let o="nodejs",d="force-dynamic";async function p(e){try{let e=process.env.SUPABASE_URL||"https://ueunqeqrvtuofpdoozye.supabase.co",i=process.env.SUPABASE_SERVICE_ROLE_KEY||"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVldW5xZXFydnR1b2ZwZG9venllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxOTM4NjMsImV4cCI6MjA3MTc2OTg2M30.JY5i-uB5vZJ6enhWVgf9Bwg9bK2BFjmuXuOfjbQEQUw";if(!e||!i)return new Response("Server misconfigured: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY",{status:500});let t=(0,l.eI)(e,i,{auth:{persistSession:!1}}),a=`
      -- Create tables if they don't exist
      create table if not exists public.media_descriptions (
        asset_id uuid not null,
        description text,
        source text default 'replicate',
        created_at timestamp with time zone default now()
      );

      create table if not exists public.media_analysis (
        asset_id uuid not null,
        analysis jsonb,
        created_at timestamp with time zone default now()
      );

      create table if not exists public.media_labels (
        asset_id uuid not null,
        label text not null,
        source text default 'replicate',
        created_at timestamp with time zone default now()
      );

      create table if not exists public.media_index (
        asset_id uuid not null,
        embedding double precision[] not null,
        index_version integer default 1,
        created_at timestamp with time zone default now()
      );

      -- Enable RLS
      alter table public.media_descriptions enable row level security;
      alter table public.media_analysis enable row level security;
      alter table public.media_labels enable row level security;
      alter table public.media_index enable row level security;

      -- Create read policies if missing
      do $$
      begin
        if not exists (
          select 1 from pg_policies
          where schemaname = 'public' and tablename = 'media_descriptions' and policyname = 'allow_read_media_descriptions'
        ) then
          create policy allow_read_media_descriptions on public.media_descriptions for select using (true);
        end if;

        if not exists (
          select 1 from pg_policies
          where schemaname = 'public' and tablename = 'media_analysis' and policyname = 'allow_read_media_analysis'
        ) then
          create policy allow_read_media_analysis on public.media_analysis for select using (true);
        end if;

        if not exists (
          select 1 from pg_policies
          where schemaname = 'public' and tablename = 'media_labels' and policyname = 'allow_read_media_labels'
        ) then
          create policy allow_read_media_labels on public.media_labels for select using (true);
        end if;

        if not exists (
          select 1 from pg_policies
          where schemaname = 'public' and tablename = 'media_index' and policyname = 'allow_read_media_index'
        ) then
          create policy allow_read_media_index on public.media_index for select using (true);
        end if;
      end$$;
    `,s=[];for(let e of["media_descriptions","media_analysis","media_labels","media_index"])try{await t.from(e).select("*").limit(1),s.push({table:e,exists:!0})}catch(i){s.push({table:e,exists:!1,error:i instanceof Error?i.message:"Unknown error"})}return Response.json({ok:!0,note:"If tables missing, run the provided SQL in Supabase SQL editor.",sql:a,probes:s})}catch(i){let e=i instanceof Error?i.message:"Internal error";return new Response(`Error: ${e}`,{status:500})}}let u=new s.AppRouteRouteModule({definition:{kind:r.x.APP_ROUTE,page:"/api/media/bootstrap/route",pathname:"/api/media/bootstrap",filename:"route",bundlePath:"app/api/media/bootstrap/route"},resolvedPagePath:"/Users/Aaron/Downloads/next-lipsync-app/app/api/media/bootstrap/route.ts",nextConfigOutput:"",userland:a}),{requestAsyncStorage:c,staticGenerationAsyncStorage:m,serverHooks:_}=u,b="/api/media/bootstrap/route";function f(){return(0,n.patchFetch)({serverHooks:_,staticGenerationAsyncStorage:m})}}};var i=require("../../../../webpack-runtime.js");i.C(e);var t=e=>i(i.s=e),a=i.X(0,[8948,2659,9498],()=>t(95046));module.exports=a})();
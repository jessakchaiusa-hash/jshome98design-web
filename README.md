# JS Home Website

เว็บไซต์ค้นหาทรัพย์ NPA ธอส. — ใช้ HTML/CSS/JS ธรรมดา (ไม่ต้อง build) เชื่อมต่อ Supabase โดยตรง

## ก่อนใช้งาน

1. เปิดไฟล์ `assets/config.js`
2. แทนที่ค่า:
   ```js
   const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
   const SUPABASE_ANON_KEY = "YOUR_ANON_PUBLIC_KEY";
   ```
   ด้วยค่าจริงจาก Supabase Dashboard → Settings → API
   ⚠️ ใช้ **anon public** key เท่านั้น ห้ามใส่ service_role key ในไฟล์นี้เด็ดขาด (ไฟล์นี้ทุกคนมองเห็นได้ผ่านเว็บ)

## โครงสร้างไฟล์

```
├── index.html          หน้า Landing
├── properties.html     หน้าค้นหา/แสดงรายการทรัพย์
├── assets/
│   ├── style.css        ดีไซน์ทั้งหมด
│   ├── config.js         ค่าเชื่อมต่อ Supabase (แก้ตรงนี้)
│   └── supabase-client.js  ฟังก์ชันดึงข้อมูลจาก Supabase
└── README.md
```

## ทดสอบก่อน deploy

เปิด `index.html` ในเบราว์เซอร์โดยตรงได้เลย (ไม่ต้องมี server ก็ทำงานได้ เพราะเรียก Supabase ผ่าน HTTPS)
ถ้าอยากรันผ่าน local server: `python3 -m http.server 8000` แล้วเปิด `http://localhost:8000`

## Deploy ผ่าน Cloudflare Pages

1. Push โค้ดทั้งหมดนี้ขึ้น GitHub repo
2. เข้า dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git
3. เลือก repo นี้
4. **Build settings**: ไม่ต้องตั้งค่า build command ใดๆ (Framework preset: None, Build output directory: `/`)
5. Deploy

## ผูกโดเมน www.jshome98design.com

1. ใน Cloudflare Pages project → Custom domains → Add
2. ใส่ `www.jshome98design.com` (ต้องมีโดเมนนี้อยู่ใน Cloudflare account เดียวกันแล้ว)
3. รอ DNS + SSL provision (มักไม่กี่นาที)

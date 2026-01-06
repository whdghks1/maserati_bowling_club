// src/db.js
import { neon } from "@netlify/neon";

// 자동으로 NETLIFY_DATABASE_URL 사용
export const sql = neon();

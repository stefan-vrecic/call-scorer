/**
 * Server-only Supabase client, authenticated with the service_role key -
 * bypasses RLS by design (see db/schema.sql: RLS is on with zero policies,
 * so this key is the only way in). NEVER import this from a client
 * component or anything that ships to the browser - the service_role key
 * has full read/write access with no restrictions at all.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY - check .env.local.");
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

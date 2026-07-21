import { createClient } from "@supabase/supabase-js";

// As chaves vêm das variáveis de ambiente configuradas na Vercel
// (e no arquivo .env.local para desenvolvimento). NUNCA coloque a
// service_role key aqui — apenas a "anon public".
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.warn(
    "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(url || "", anon || "");
export const supabaseConfigurado = Boolean(url && anon);

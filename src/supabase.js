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

// Se as chaves não estiverem definidas, usamos valores de reserva apenas para
// o app não quebrar com tela branca — a interface avisa que falta configurar.
export const supabase = createClient(
  url || "https://indefinido.supabase.co",
  anon || "indefinido"
);
export const supabaseConfigurado = Boolean(url && anon);

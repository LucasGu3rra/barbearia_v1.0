import { createClient } from '@supabase/supabase-js';

// Puxa as variáveis de ambiente que ficam no arquivo .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Essa é a linha que estava faltando! Ela exporta a conexão para o resto do site usar
export const supabase = createClient(supabaseUrl, supabaseKey);
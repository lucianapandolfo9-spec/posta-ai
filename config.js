// Posta Aí — configuração compartilhada
const POSTA_AI_SUPABASE_URL = "https://tscnqvuzlfagotirgjbz.supabase.co";
const POSTA_AI_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzY25xdnV6bGZhZ290aXJnamJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4Mzc2NjgsImV4cCI6MjA5ODQxMzY2OH0.9PmwjxNPVIVOy3eenYAqlLSKmhyYeQUSQXz_PvixSB0";
const POSTA_AI_ADMIN_EMAIL = "lucianapandolfo9@gmail.com";
const POSTA_AI_STORAGE_BUCKET = "posta-ai-media";

const postaAiClient = supabase.createClient(POSTA_AI_SUPABASE_URL, POSTA_AI_SUPABASE_ANON_KEY);

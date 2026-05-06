/** @type {import('next').NextConfig} */
const nextConfig = {
  // No proxy needed — dashboard talks directly to Supabase
  env: {
    NEXT_PUBLIC_SUPABASE_URL:  'https://zpqdhodxyrkfcgameekn.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwcWRob2R4eXJrZmNnYW1lZWtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzU3MTcsImV4cCI6MjA5MzU1MTcxN30.sjYPAoi0Xc5tzRtjaFw-2odNAno4axh8R4TTOAAtY40',
  }
};
module.exports = nextConfig;

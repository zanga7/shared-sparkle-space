import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  global: boolean;
  counties?: string[] | null;
  types: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { region_code, year } = await req.json();
    
    if (!region_code || !year) {
      return new Response(
        JSON.stringify({ error: 'region_code and year are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Syncing holidays for ${region_code} in ${year}`);

    // Parse region code (e.g., "AU" or "AU-NSW")
    const [countryCode, subdivisionCode] = region_code.split('-');

    // Fetch from Nager.at API (free, no API key needed)
    const nagerUrl = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`;
    console.log(`Fetching from: ${nagerUrl}`);

    const response = await fetch(nagerUrl);
    
    if (!response.ok) {
      throw new Error(`Nager API error: ${response.status} ${response.statusText}`);
    }

    const holidays: NagerHoliday[] = await response.json();
    console.log(`Fetched ${holidays.length} holidays`);

    // Filter by subdivision if specified (e.g., NSW for AU-NSW)
    const filteredHolidays = holidays.filter(holiday => {
      if (!subdivisionCode) return holiday.global || !holiday.counties;
      // If subdivision specified, include only holidays for that subdivision
      return holiday.counties && holiday.counties.includes(subdivisionCode);
    });

    console.log(`Filtered to ${filteredHolidays.length} holidays for ${region_code}`);

    // Insert or update holidays in cache
    const holidaysToInsert = filteredHolidays.map(holiday => ({
      region_code: region_code,
      holiday_date: holiday.date,
      holiday_name: holiday.name,
      is_public: holiday.global || holiday.types.includes('Public'),
      holiday_type: holiday.types.join(', '),
      year: year,
    }));

    if (holidaysToInsert.length > 0) {
      const { error: upsertError } = await supabaseClient
        .from('public_holidays_cache')
        .upsert(holidaysToInsert, {
          onConflict: 'region_code,holiday_date',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error('Error upserting holidays:', upsertError);
        throw upsertError;
      }
    }

    console.log(`Successfully synced ${holidaysToInsert.length} holidays`);

    return new Response(
      JSON.stringify({
        success: true,
        synced_count: holidaysToInsert.length,
        region_code,
        year,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error syncing public holidays:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

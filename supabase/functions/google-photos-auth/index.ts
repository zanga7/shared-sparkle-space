import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action, code, family_id } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Get Google credentials from environment
    const clientId = Deno.env.get('GOOGLE_PHOTOS_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_PHOTOS_CLIENT_SECRET')
    
    if (!clientId || !clientSecret) {
      throw new Error('Google Photos credentials not configured')
    }

    if (action === 'get_auth_url') {
      // Generate authorization URL
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-photos-auth`
      const scope = 'https://www.googleapis.com/auth/photoslibrary.readonly'
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `response_type=code&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `state=${family_id}`

      return new Response(JSON.stringify({ auth_url: authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'exchange_code') {
      // Exchange authorization code for tokens
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-photos-auth`
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      })

      const tokens = await tokenResponse.json()
      
      if (tokens.error) {
        throw new Error(tokens.error_description || tokens.error)
      }

      // Get user profile from current session
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        throw new Error('Authentication required')
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      )

      if (userError || !user) {
        throw new Error('Invalid user session')
      }

      // Get user's profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, family_id')
        .eq('user_id', user.id)
        .single()

      if (profileError || !profile) {
        throw new Error('User profile not found')
      }

      // Store the integration
      const expiresAt = tokens.expires_in 
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null

      const { error: integrationError } = await supabase
        .from('google_photos_integrations')
        .insert({
          family_id: profile.family_id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
          created_by: profile.id,
          is_active: true,
        })

      if (integrationError) {
        throw new Error('Failed to save integration: ' + integrationError.message)
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Google Photos connected successfully' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'get_albums') {
      // Get albums from Google Photos
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        throw new Error('Authentication required')
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      )

      if (userError || !user) {
        throw new Error('Invalid user session')
      }

      // Get user's Google Photos integration
      const { data: integration, error: integrationError } = await supabase
        .from('google_photos_integrations')
        .select('access_token, refresh_token, expires_at')
        .eq('family_id', family_id)
        .eq('is_active', true)
        .single()

      if (integrationError || !integration) {
        throw new Error('Google Photos integration not found')
      }

      // Check if token needs refresh
      let accessToken = integration.access_token
      if (integration.expires_at && new Date(integration.expires_at) <= new Date()) {
        // Token expired, refresh it
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: integration.refresh_token,
            grant_type: 'refresh_token',
          }),
        })

        const refreshTokens = await refreshResponse.json()
        if (refreshTokens.error) {
          throw new Error('Failed to refresh token: ' + refreshTokens.error_description)
        }

        accessToken = refreshTokens.access_token
        
        // Update stored tokens
        await supabase
          .from('google_photos_integrations')
          .update({
            access_token: accessToken,
            expires_at: new Date(Date.now() + refreshTokens.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('family_id', family_id)
      }

      // Fetch albums from Google Photos
      const albumsResponse = await fetch('https://photoslibrary.googleapis.com/v1/albums', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      const albumsData = await albumsResponse.json()
      if (albumsData.error) {
        throw new Error('Failed to fetch albums: ' + albumsData.error.message)
      }

      return new Response(JSON.stringify({ 
        albums: albumsData.albums || [] 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    throw new Error('Invalid action')

  } catch (error) {
    console.error('Error in google-photos-auth:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
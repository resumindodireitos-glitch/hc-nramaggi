import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface GoogleFormsPayload {
  form_id: string;
  form_title?: string;
  response_id: string;
  responses: Record<string, string | string[]>;
  respondent_email?: string;
  timestamp: string;
  mapping?: {
    form_uuid?: string;
    nome_field?: string;
    setor_field?: string;
    cargo_field?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json() as GoogleFormsPayload;
    
    console.log("Google Forms webhook received for form_id:", payload.form_id);

    // Validate required fields
    if (!payload.form_id || !payload.responses) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: form_id or responses" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check webhook configuration and validate secret
    const { data: webhookConfig } = await supabase
      .from("webhook_configurations")
      .select("secret_key, is_active, internal_form_id, field_mapping")
      .eq("external_form_id", payload.form_id)
      .eq("provider", "google")
      .maybeSingle();

    // Validate webhook secret if configured
    if (webhookConfig?.secret_key) {
      const providedSecret = req.headers.get("X-Webhook-Secret");
      if (!providedSecret || providedSecret !== webhookConfig.secret_key) {
        console.warn("Webhook authentication failed for form_id:", payload.form_id);
        return new Response(
          JSON.stringify({ error: "Unauthorized: Invalid or missing webhook secret" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check if webhook is active
    if (webhookConfig && !webhookConfig.is_active) {
      return new Response(
        JSON.stringify({ error: "Webhook is disabled" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to find the form mapping in system_settings (legacy support)
    const { data: mappingData } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", `GOOGLE_FORM_MAPPING_${payload.form_id}`)
      .maybeSingle();

    let formUuid: string | null = webhookConfig?.internal_form_id || null;
    let fieldMapping: Record<string, string> = webhookConfig?.field_mapping as Record<string, string> || {};

    if (!formUuid && mappingData?.value) {
      try {
        const mapping = JSON.parse(mappingData.value);
        formUuid = mapping.form_uuid;
        fieldMapping = mapping.field_mapping || {};
      } catch (e) {
        console.error("Error parsing form mapping:", e);
      }
    }

    // If no mapping, try to use payload mapping or default ERGOS form
    if (!formUuid && payload.mapping?.form_uuid) {
      formUuid = payload.mapping.form_uuid;
    }

    // If still no form UUID, find default active ERGOS form
    if (!formUuid) {
      const { data: defaultForm } = await supabase
        .from("forms")
        .select("id")
        .eq("type", "ergos")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      
      formUuid = defaultForm?.id;
    }

    if (!formUuid) {
      return new Response(
        JSON.stringify({ error: "No form mapping found and no default form available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract respondent data from responses using field mapping
    const respondentData: Record<string, string> = {
      empresa: "Amaggi",
      data_avaliacao: new Date().toISOString().split("T")[0],
    };

    // Apply field mapping to extract respondent data
    const respondentFields = ["nome", "setor", "cargo", "genero", "tempo_empresa"] as const;
    const mappingFieldNames: Record<string, keyof NonNullable<GoogleFormsPayload["mapping"]> | undefined> = {
      nome: "nome_field",
      setor: "setor_field", 
      cargo: "cargo_field",
    };
    
    for (const field of respondentFields) {
      const mappingKey = mappingFieldNames[field];
      const mappedKey = fieldMapping[field] || (mappingKey ? payload.mapping?.[mappingKey] : undefined);
      if (mappedKey && payload.responses[mappedKey]) {
        const value = payload.responses[mappedKey];
        respondentData[field] = Array.isArray(value) ? value.join(", ") : value;
      }
    }

    // Add email if available
    if (payload.respondent_email) {
      respondentData.email = payload.respondent_email;
    }

    // Convert remaining responses to answers (excluding respondent fields)
    const answers: Record<string, string | string[]> = {};
    const mappedFieldKeys = Object.values(fieldMapping);
    
    for (const [key, value] of Object.entries(payload.responses)) {
      if (!mappedFieldKeys.includes(key)) {
        answers[key] = value;
      }
    }

    // Create submission
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .insert({
        form_id: formUuid,
        answers: answers,
        respondent_data: {
          ...respondentData,
          source: "google_forms",
          external_form_id: payload.form_id,
          external_response_id: payload.response_id,
        },
        status: "pending_ai",
      })
      .select()
      .single();

    if (submissionError) {
      console.error("Error creating submission:", submissionError);
      return new Response(
        JSON.stringify({ error: "Failed to create submission", details: submissionError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Submission created:", submission.id);

    // Update webhook stats
    if (webhookConfig) {
      await supabase
        .from("webhook_configurations")
        .update({
          last_received_at: new Date().toISOString(),
          total_submissions: (webhookConfig as any).total_submissions ? (webhookConfig as any).total_submissions + 1 : 1,
        })
        .eq("external_form_id", payload.form_id)
        .eq("provider", "google");
    }

    // Log the webhook event
    await supabase.from("audit_log").insert({
      action: "webhook_google_forms",
      table_name: "submissions",
      record_id: submission.id,
      new_data: {
        external_form_id: payload.form_id,
        external_response_id: payload.response_id,
        timestamp: payload.timestamp,
        authenticated: !!webhookConfig?.secret_key,
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        submission_id: submission.id,
        message: "Submission created from Google Forms webhook"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

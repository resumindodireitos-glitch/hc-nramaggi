import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface MicrosoftFormsPayload {
  formId: string;
  formTitle?: string;
  responseId: string;
  answers: Record<string, string | string[]>;
  respondentEmail?: string;
  submittedAt: string;
  resourceData?: {
    formId?: string;
    responseId?: string;
  };
  mapping?: {
    formUuid?: string;
    nomeField?: string;
    setorField?: string;
    cargoField?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json() as MicrosoftFormsPayload;
    
    // Support Power Automate format
    const formId = payload.formId || payload.resourceData?.formId;
    const responseId = payload.responseId || payload.resourceData?.responseId;
    const answers = payload.answers || {};

    console.log("Microsoft Forms webhook received for form_id:", formId);

    if (!formId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: formId" }),
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
      .eq("external_form_id", formId)
      .eq("provider", "microsoft")
      .maybeSingle();

    // Validate webhook secret if configured
    if (webhookConfig?.secret_key) {
      const providedSecret = req.headers.get("X-Webhook-Secret");
      if (!providedSecret || providedSecret !== webhookConfig.secret_key) {
        console.warn("Webhook authentication failed for form_id:", formId);
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
      .eq("key", `MS_FORM_MAPPING_${formId}`)
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

    // If no mapping, try to use payload mapping or default HSE-IT form
    if (!formUuid && payload.mapping?.formUuid) {
      formUuid = payload.mapping.formUuid;
    }

    // If still no form UUID, find default active HSE-IT form
    if (!formUuid) {
      const { data: defaultForm } = await supabase
        .from("forms")
        .select("id")
        .eq("type", "hse_it")
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

    // Extract respondent data from answers using field mapping
    const respondentData: Record<string, string> = {
      empresa: "Amaggi",
      data_avaliacao: new Date().toISOString().split("T")[0],
    };

    // Apply field mapping to extract respondent data
    const respondentFields = ["nome", "setor", "cargo", "genero", "tempo_empresa"];
    const mappingFields: Record<string, string | undefined> = {
      nome: payload.mapping?.nomeField,
      setor: payload.mapping?.setorField,
      cargo: payload.mapping?.cargoField,
    };

    for (const field of respondentFields) {
      const mappedKey = fieldMapping[field] || mappingFields[field];
      if (mappedKey && answers[mappedKey]) {
        const value = answers[mappedKey];
        respondentData[field] = Array.isArray(value) ? value.join(", ") : value;
      }
    }

    // Add email if available
    if (payload.respondentEmail) {
      respondentData.email = payload.respondentEmail;
    }

    // Convert remaining answers (excluding respondent fields)
    const formAnswers: Record<string, string | string[]> = {};
    const mappedFieldKeys = Object.values(fieldMapping).filter(Boolean);
    
    for (const [key, value] of Object.entries(answers)) {
      if (!mappedFieldKeys.includes(key)) {
        formAnswers[key] = value;
      }
    }

    // Create submission
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .insert({
        form_id: formUuid,
        answers: formAnswers,
        respondent_data: {
          ...respondentData,
          source: "microsoft_forms",
          external_form_id: formId,
          external_response_id: responseId,
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
        .eq("external_form_id", formId)
        .eq("provider", "microsoft");
    }

    // Log the webhook event
    await supabase.from("audit_log").insert({
      action: "webhook_microsoft_forms",
      table_name: "submissions",
      record_id: submission.id,
      new_data: {
        external_form_id: formId,
        external_response_id: responseId,
        submitted_at: payload.submittedAt,
        authenticated: !!webhookConfig?.secret_key,
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        submission_id: submission.id,
        message: "Submission created from Microsoft Forms webhook"
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

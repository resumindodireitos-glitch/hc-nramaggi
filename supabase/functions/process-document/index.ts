import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Split text into chunks
function splitIntoChunks(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);
    
    // Try to break at sentence boundaries
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);
      
      if (breakPoint > chunkSize * 0.5) {
        chunk = chunk.slice(0, breakPoint + 1);
      }
    }
    
    chunks.push(chunk.trim());
    start = start + chunk.length - overlap;
    
    if (start >= text.length) break;
  }
  
  return chunks.filter(c => c.length > 50);
}

// Generate embeddings using Lovable AI
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Embedding error:", error);
    throw new Error(`Embedding failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// Extract text from different file types
async function extractText(fileBuffer: ArrayBuffer, fileType: string): Promise<string> {
  const uint8Array = new Uint8Array(fileBuffer);
  
  // For text files, decode directly
  if (fileType === 'text/plain' || fileType === 'text/csv') {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(uint8Array);
  }
  
  // For PDF files, use a simple text extraction
  if (fileType === 'application/pdf') {
    // Basic PDF text extraction - looks for text streams
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const pdfText = decoder.decode(uint8Array);
    
    // Extract text between stream markers (simplified)
    const textParts: string[] = [];
    const streamRegex = /stream\s*\n([\s\S]*?)\nendstream/g;
    let match;
    
    while ((match = streamRegex.exec(pdfText)) !== null) {
      const content = match[1];
      // Look for text showing operators
      const tjRegex = /\[(.*?)\]\s*TJ/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(content)) !== null) {
        const text = tjMatch[1]
          .replace(/\(([^)]*)\)/g, '$1')
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (text) textParts.push(text);
      }
    }
    
    // Fallback: extract readable text from the raw file
    if (textParts.length === 0) {
      const cleanText = pdfText
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Find readable sentences
      const sentences = cleanText.match(/[A-Za-z][^.!?]*[.!?]/g) || [];
      return sentences.join(' ').slice(0, 50000);
    }
    
    return textParts.join(' ').slice(0, 50000);
  }
  
  // For Office documents, return a message to use external parsing
  if (fileType.includes('officedocument') || fileType.includes('msword') || fileType.includes('ms-excel')) {
    // Basic extraction for Office files - get text content where possible
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const rawText = decoder.decode(uint8Array);
    
    // Extract text between XML tags for docx/xlsx
    const textContent = rawText
      .replace(/<[^>]+>/g, ' ')
      .replace(/[^\x20-\x7E\n\r\táàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return textContent.slice(0, 50000);
  }
  
  throw new Error(`Unsupported file type: ${fileType}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId } = await req.json();

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: "documentId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Authorization check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin access
    const { data: userRole } = await userClient.from("user_roles").select("role").eq("user_id", user.id).single();
    if (!userRole || (userRole.role !== "admin_hc" && userRole.role !== "super_admin")) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get document info
    const { data: document, error: docError } = await supabase
      .from("knowledge_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing document:", document.name);

    // Update status to processing
    await supabase
      .from("knowledge_documents")
      .update({ status: "processing" })
      .eq("id", documentId);

    // Download file from storage
    console.log("Attempting to download file from path:", document.file_path);
    
    let downloadedFile: Blob | null = null;
    
    const { data: fileData, error: fileError } = await supabase.storage
      .from("knowledge-base")
      .download(document.file_path);

    if (fileError || !fileData) {
      console.error("File download error:", fileError);
      
      // Try alternative path if original fails
      const altPath = document.file_path.replace('knowledge-docs/', 'documents/');
      console.log("Trying alternative path:", altPath);
      
      const { data: altData, error: altError } = await supabase.storage
        .from("knowledge-base")
        .download(altPath);
        
      if (altError || !altData) {
        console.error("Alternative path also failed:", altError);
        
        await supabase
          .from("knowledge_documents")
          .update({ 
            status: "error", 
            metadata: { 
              error: "File not found in storage. Please re-upload the document.",
              original_path: document.file_path
            } 
          })
          .eq("id", documentId);
        
        return new Response(
          JSON.stringify({ error: "File not found in storage. Please re-upload the document." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Update the path in database if alternative worked
      await supabase
        .from("knowledge_documents")
        .update({ file_path: altPath })
        .eq("id", documentId);
        
      downloadedFile = altData;
      console.log("Successfully downloaded from alternative path");
    } else {
      downloadedFile = fileData;
    }

    // Extract text from file
    let extractedText: string;
    try {
      const buffer = await downloadedFile.arrayBuffer();
      extractedText = await extractText(buffer, document.file_type);
      console.log(`Extracted ${extractedText.length} characters from ${document.name}`);
    } catch (extractError) {
      console.error("Text extraction error:", extractError);
      const errMsg = extractError instanceof Error ? extractError.message : "Unknown error";
      await supabase
        .from("knowledge_documents")
        .update({ 
          status: "error", 
          metadata: { error: `Text extraction failed: ${errMsg}` } 
        })
        .eq("id", documentId);
      
      return new Response(
        JSON.stringify({ error: "Text extraction failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!extractedText || extractedText.length < 100) {
      await supabase
        .from("knowledge_documents")
        .update({ status: "error", metadata: { error: "No text content extracted" } })
        .eq("id", documentId);
      
      return new Response(
        JSON.stringify({ error: "No text content could be extracted from the document" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Split into chunks
    const chunks = splitIntoChunks(extractedText);
    console.log(`Split into ${chunks.length} chunks`);

    // Delete existing chunks for this document
    await supabase
      .from("document_chunks")
      .delete()
      .eq("document_id", documentId);

    // Process chunks and generate embeddings
    let processedCount = 0;
    const batchSize = 5;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      const chunkPromises = batch.map(async (content, batchIndex) => {
        const chunkIndex = i + batchIndex;
        
        try {
          const embedding = await generateEmbedding(content, lovableApiKey);
          
          return {
            document_id: documentId,
            content,
            chunk_index: chunkIndex,
            embedding: `[${embedding.join(",")}]`,
            metadata: { 
              length: content.length,
              source: document.name 
            }
          };
        } catch (embError) {
          console.error(`Embedding error for chunk ${chunkIndex}:`, embError);
          return null;
        }
      });

      const results = await Promise.all(chunkPromises);
      const validChunks = results.filter(r => r !== null);

      if (validChunks.length > 0) {
        const { error: insertError } = await supabase
          .from("document_chunks")
          .insert(validChunks);

        if (insertError) {
          console.error("Chunk insert error:", insertError);
        } else {
          processedCount += validChunks.length;
        }
      }

      // Small delay to avoid rate limits
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Update document status
    await supabase
      .from("knowledge_documents")
      .update({
        status: "completed",
        chunks_count: processedCount,
        metadata: {
          original_length: extractedText.length,
          processed_at: new Date().toISOString()
        }
      })
      .eq("id", documentId);

    console.log(`Document processing completed: ${processedCount} chunks created`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        chunks_created: processedCount,
        text_length: extractedText.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Process document error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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
  if (fileType === 'text/plain' || fileType === 'text/csv' || fileType.includes('text')) {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(uint8Array);
  }
  
  // For PDF files, use a simple text extraction
  if (fileType === 'application/pdf' || fileType.includes('pdf')) {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const pdfText = decoder.decode(uint8Array);
    
    const textParts: string[] = [];
    const streamRegex = /stream\s*\n([\s\S]*?)\nendstream/g;
    let match;
    
    while ((match = streamRegex.exec(pdfText)) !== null) {
      const content = match[1];
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
    
    if (textParts.length === 0) {
      const cleanText = pdfText
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      const sentences = cleanText.match(/[A-Za-z][^.!?]*[.!?]/g) || [];
      return sentences.join(' ').slice(0, 50000);
    }
    
    return textParts.join(' ').slice(0, 50000);
  }
  
  // For Office documents
  if (fileType.includes('officedocument') || fileType.includes('msword') || 
      fileType.includes('ms-excel') || fileType.includes('docx') || 
      fileType.includes('xlsx') || fileType.includes('spreadsheet')) {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const rawText = decoder.decode(uint8Array);
    
    const textContent = rawText
      .replace(/<[^>]+>/g, ' ')
      .replace(/[^\x20-\x7E\n\r\táàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return textContent.slice(0, 50000);
  }
  
  throw new Error(`Unsupported file type: ${fileType}`);
}

// Try multiple storage paths
async function downloadFromStorage(
  supabase: any, 
  bucketName: string, 
  filePath: string
): Promise<{ data: Blob | null; error: any; usedPath: string }> {
  // Generate all possible path variations
  const pathVariations = [
    filePath,
    filePath.replace('knowledge-docs/', ''),
    `documents/${filePath.split('/').pop()}`,
    filePath.split('/').pop() || filePath,
  ];
  
  console.log("Trying path variations:", pathVariations);
  
  for (const path of pathVariations) {
    console.log(`Attempting download from: ${bucketName}/${path}`);
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(path);
    
    if (data && !error) {
      console.log(`Successfully downloaded from: ${path}`);
      return { data, error: null, usedPath: path };
    }
    
    console.log(`Failed to download from ${path}:`, error?.message || 'Unknown error');
  }
  
  return { 
    data: null, 
    error: new Error(`File not found in any path variation: ${pathVariations.join(', ')}`),
    usedPath: filePath 
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, textContent } = await req.json();

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
        JSON.stringify({ error: "Document not found in database" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing document:", document.name, "| Path:", document.file_path, "| Type:", document.file_type);

    // Update status to processing
    await supabase
      .from("knowledge_documents")
      .update({ status: "processing" })
      .eq("id", documentId);

    let extractedText: string;

    // Check if text content was provided directly (for manual processing)
    if (textContent && typeof textContent === 'string' && textContent.length > 100) {
      console.log("Using provided text content directly");
      extractedText = textContent;
    } else {
      // Download file from storage
      const { data: fileData, error: fileError, usedPath } = await downloadFromStorage(
        supabase,
        "knowledge-base",
        document.file_path
      );

      if (fileError || !fileData) {
        console.error("All download attempts failed:", fileError);
        
        await supabase
          .from("knowledge_documents")
          .update({ 
            status: "error", 
            metadata: { 
              error: "Arquivo não encontrado no storage. Por favor, faça upload novamente.",
              attempted_path: document.file_path
            } 
          })
          .eq("id", documentId);
        
        return new Response(
          JSON.stringify({ 
            error: "Arquivo não encontrado no storage. Por favor, faça upload novamente.",
            details: `Tentou: ${document.file_path}`
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update path if different was used
      if (usedPath !== document.file_path) {
        await supabase
          .from("knowledge_documents")
          .update({ file_path: usedPath })
          .eq("id", documentId);
      }

      // Extract text from file
      try {
        const buffer = await fileData.arrayBuffer();
        extractedText = await extractText(buffer, document.file_type);
        console.log(`Extracted ${extractedText.length} characters from ${document.name}`);
      } catch (extractError) {
        console.error("Text extraction error:", extractError);
        const errMsg = extractError instanceof Error ? extractError.message : "Unknown error";
        await supabase
          .from("knowledge_documents")
          .update({ 
            status: "error", 
            metadata: { error: `Extração de texto falhou: ${errMsg}` } 
          })
          .eq("id", documentId);
        
        return new Response(
          JSON.stringify({ error: "Falha na extração de texto", details: errMsg }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!extractedText || extractedText.length < 50) {
      await supabase
        .from("knowledge_documents")
        .update({ status: "error", metadata: { error: "Nenhum conteúdo de texto extraído" } })
        .eq("id", documentId);
      
      return new Response(
        JSON.stringify({ error: "Não foi possível extrair conteúdo de texto do documento" }),
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
    let errorCount = 0;
    const batchSize = 3;

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
          errorCount++;
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
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Update document status
    const finalStatus = processedCount > 0 ? "completed" : "error";
    await supabase
      .from("knowledge_documents")
      .update({
        status: finalStatus,
        chunks_count: processedCount,
        metadata: {
          original_length: extractedText.length,
          processed_at: new Date().toISOString(),
          errors: errorCount > 0 ? `${errorCount} chunks failed` : undefined
        }
      })
      .eq("id", documentId);

    console.log(`Document processing completed: ${processedCount} chunks created, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        chunks_created: processedCount,
        text_length: extractedText.length,
        errors: errorCount
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

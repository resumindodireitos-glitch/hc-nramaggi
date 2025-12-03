import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple ZIP file creator without external dependencies
function createZipFile(files: { name: string; data: string }[]): Uint8Array {
  const encoder = new TextEncoder();
  const centralDirectory: Uint8Array[] = [];
  const fileEntries: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const fileData = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
    const fileName = encoder.encode(file.name);
    
    // Local file header
    const localHeader = new Uint8Array(30 + fileName.length);
    const localView = new DataView(localHeader.buffer);
    
    localView.setUint32(0, 0x04034b50, true); // Local file header signature
    localView.setUint16(4, 20, true); // Version needed
    localView.setUint16(6, 0, true); // General purpose flag
    localView.setUint16(8, 0, true); // Compression method (store)
    localView.setUint16(10, 0, true); // File time
    localView.setUint16(12, 0, true); // File date
    localView.setUint32(14, 0, true); // CRC-32 (simplified)
    localView.setUint32(18, fileData.length, true); // Compressed size
    localView.setUint32(22, fileData.length, true); // Uncompressed size
    localView.setUint16(26, fileName.length, true); // File name length
    localView.setUint16(28, 0, true); // Extra field length
    localHeader.set(fileName, 30);

    fileEntries.push(localHeader);
    fileEntries.push(fileData);

    // Central directory header
    const centralHeader = new Uint8Array(46 + fileName.length);
    const centralView = new DataView(centralHeader.buffer);
    
    centralView.setUint32(0, 0x02014b50, true); // Central directory signature
    centralView.setUint16(4, 20, true); // Version made by
    centralView.setUint16(6, 20, true); // Version needed
    centralView.setUint16(8, 0, true); // General purpose flag
    centralView.setUint16(10, 0, true); // Compression method
    centralView.setUint16(12, 0, true); // File time
    centralView.setUint16(14, 0, true); // File date
    centralView.setUint32(16, 0, true); // CRC-32
    centralView.setUint32(20, fileData.length, true); // Compressed size
    centralView.setUint32(24, fileData.length, true); // Uncompressed size
    centralView.setUint16(28, fileName.length, true); // File name length
    centralView.setUint16(30, 0, true); // Extra field length
    centralView.setUint16(32, 0, true); // Comment length
    centralView.setUint16(34, 0, true); // Disk number start
    centralView.setUint16(36, 0, true); // Internal file attributes
    centralView.setUint32(38, 0, true); // External file attributes
    centralView.setUint32(42, offset, true); // Relative offset of local header
    centralHeader.set(fileName, 46);

    centralDirectory.push(centralHeader);
    offset += localHeader.length + fileData.length;
  }

  // End of central directory
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  const centralDirSize = centralDirectory.reduce((sum, arr) => sum + arr.length, 0);
  
  endView.setUint32(0, 0x06054b50, true); // End of central directory signature
  endView.setUint16(4, 0, true); // Disk number
  endView.setUint16(6, 0, true); // Disk with central directory
  endView.setUint16(8, files.length, true); // Entries on this disk
  endView.setUint16(10, files.length, true); // Total entries
  endView.setUint32(12, centralDirSize, true); // Central directory size
  endView.setUint32(16, offset, true); // Central directory offset
  endView.setUint16(20, 0, true); // Comment length

  // Combine all parts
  const totalSize = offset + centralDirSize + 22;
  const zipFile = new Uint8Array(totalSize);
  let pos = 0;

  for (const entry of fileEntries) {
    zipFile.set(entry, pos);
    pos += entry.length;
  }
  for (const entry of centralDirectory) {
    zipFile.set(entry, pos);
    pos += entry.length;
  }
  zipFile.set(endRecord, pos);

  return zipFile;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { files } = await req.json();

    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new Error("files array é obrigatório");
    }

    console.log(`Creating ZIP with ${files.length} files`);

    const zipData = createZipFile(files);
    const base64 = btoa(String.fromCharCode(...zipData));

    console.log(`ZIP created successfully, size: ${zipData.length} bytes`);

    return new Response(
      JSON.stringify({ zip: base64 }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error creating ZIP:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

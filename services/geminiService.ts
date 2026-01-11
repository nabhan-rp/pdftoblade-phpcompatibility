import { AnalysisResponse } from "../types";

/**
 * Sends a request to the local PHP proxy (api.php) which forwards it to Gemini.
 * This secures the API key on the server side.
 */
const callPhpProxy = async (action: 'analyze' | 'generate-image', payload: any) => {
    try {
        // PERBAIKAN: Gunakan './api.php' agar relatif terhadap lokasi index.html
        // Ini penting jika aplikasi ditaruh di sub-folder hosting (misal: domain.com/app/)
        const response = await fetch('./api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action,
                payload
            })
        });

        const responseText = await response.text();

        if (!response.ok) {
            throw new Error(`Server Error (${response.status}): ${responseText.substring(0, 200)}...`);
        }

        try {
            return JSON.parse(responseText);
        } catch (e) {
            console.error("Invalid JSON received:", responseText);
            throw new Error("Server returned invalid JSON. Check console for details.");
        }
    } catch (error) {
        console.error("Proxy Error:", error);
        throw error;
    }
};

/**
 * Analyzes a document using Gemini via PHP Proxy.
 */
export const analyzeDocumentImage = async (base64Data: string, mimeType: string = 'image/jpeg'): Promise<AnalysisResponse> => {
  
  const prompt = `
    Analyze this document image(s) which is likely a formal letter. 
    I need you to extract the content and structure to create a Laravel Blade template.
    
    1. Identify the Header/Kop Surat info.
    2. Extract the MAIN BODY content as HTML. 
       - CRITICAL: If there are TABLES, strictly use HTML <table>, <tr>, <td> tags with border styles.
       - Detect dynamic parts (names, dates, numbers, recipients) and replace them with {{ $variable }}.
    3. CHECK FOR ATTACHMENTS (Lampiran):
       - If the document has a second page or a section labeled "Lampiran", extract that content separately into 'attachmentContent'.
       - Maintain any tables found in the attachment exactly as HTML tables.
    4. Identify signature area information.

    Return the result strictly as JSON using this schema.
  `;

  // Construct standard Gemini REST API payload
  // We define the schema manually here since we aren't using the SDK's helpers
  const payload = {
      contents: [{
          parts: [
              { inlineData: { mimeType: mimeType, data: base64Data } },
              { text: prompt }
          ]
      }],
      generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
              type: "OBJECT",
              properties: {
                  institutionName: { type: "STRING" },
                  institutionAddress: { type: "STRING" },
                  htmlContent: { type: "STRING", description: "Main letter body HTML. Use <table> for tabular data." },
                  attachmentContent: { type: "STRING", description: "Content of attachments/lampiran if present. Use <table> for lists." },
                  detectedVariables: {
                      type: "ARRAY",
                      items: {
                          type: "OBJECT",
                          properties: {
                              key: { type: "STRING" },
                              label: { type: "STRING" },
                              defaultValue: { type: "STRING" }
                          }
                      }
                  },
                  signatureName: { type: "STRING" },
                  signatureTitle: { type: "STRING" },
              }
          }
      }
  };

  const data = await callPhpProxy('analyze', payload);

  // Parse logic similar to SDK
  const jsonString = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (jsonString) {
      return JSON.parse(jsonString) as AnalysisResponse;
  }
  throw new Error("No valid JSON response from AI");
};

/**
 * Generates a logo using Gemini via PHP Proxy.
 */
export const generateLogo = async (prompt: string, aspectRatio: string): Promise<string> => {
    // Construct payload for Image Generation (or Text-to-Image via standard model)
    // Note: Since we are using a general model via proxy for simplicity on shared hosting,
    // we frame this as a request to generate a base64 image code or svg if the model allows,
    // OR we rely on the specific image generation endpoint if configured in PHP.
    
    // For this specific shared hosting setup, we will use the text model to generate an SVG 
    // because handling binary image blobs via a simple PHP proxy and JSON can be tricky/limited by size.
    // SVG is safer for text-based transport.
    
    const svgPrompt = `
        Create a simple, professional SVG code for a logo for: "${prompt}". 
        Ratio: ${aspectRatio}. 
        Return ONLY the raw <svg>...</svg> code string. No markdown, no json.
    `;

    const payload = {
        contents: [{
            parts: [{ text: svgPrompt }]
        }]
    };

    const data = await callPhpProxy('generate-image', payload);
    const svgCode = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (svgCode) {
        // Clean up markdown code blocks if present
        const cleanSvg = svgCode.replace(/```xml|```svg|```/g, '').trim();
        // Convert SVG to Base64 for the img tag
        return `data:image/svg+xml;base64,${btoa(cleanSvg)}`;
    }
    
    throw new Error("Failed to generate logo");
}
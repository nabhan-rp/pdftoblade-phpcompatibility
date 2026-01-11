import { AnalysisResponse } from "../types";

/**
 * Sends a request to the local PHP proxy (api.php).
 * Uses explicit URL construction to handle subdirectories and query parameters correctly.
 */
const callPhpProxy = async (action: 'analyze' | 'generate-image', payload: any) => {
    try {
        // PERBAIKAN: Resolve URL api.php secara absolut berdasarkan lokasi saat ini.
        // Ini memastikan 'https://domain.com/folder/?i=1' tetap mengarah ke 'https://domain.com/folder/api.php'
        // dan bukan bingung dengan parameter query.
        const apiUrl = new URL('api.php', window.location.href).href;

        const response = await fetch(apiUrl, {
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
            // Coba ambil error message dari server jika ada
            let errorMessage = `Server Error (${response.status})`;
            try {
                const errorJson = JSON.parse(responseText);
                if (errorJson.error) errorMessage += `: ${errorJson.error}`;
            } catch (e) {
                // Jika bukan JSON, ambil potongan teks html errornya
                errorMessage += `: ${responseText.substring(0, 100)}...`;
            }
            throw new Error(errorMessage);
        }

        try {
            return JSON.parse(responseText);
        } catch (e) {
            console.error("Invalid JSON received. Raw response:", responseText);
            throw new Error(`Server returned invalid JSON. Is api.php uploaded correctly? (Raw: ${responseText.substring(0, 50)}...)`);
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
        const cleanSvg = svgCode.replace(/```xml|```svg|```/g, '').trim();
        return `data:image/svg+xml;base64,${btoa(cleanSvg)}`;
    }
    
    throw new Error("Failed to generate logo");
}
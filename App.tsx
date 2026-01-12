import React, { useState, useRef } from 'react';
import { analyzeDocumentImage } from './services/geminiService';
import { DocumentState, LetterSettings, TabView, Variable } from './types';
import EditorPanel from './components/EditorPanel';
import TemplatePreview from './components/TemplatePreview';

const DEFAULT_SETTINGS: LetterSettings = {
  // A4 defaults
  pageSize: 'A4',
  unit: 'cm',
  pageWidth: 21,
  pageHeight: 29.7,
  
  marginTop: 4, 
  marginRight: 3,
  marginBottom: 3,
  marginLeft: 4, 
  
  // Font Defaults
  globalFontFamily: '"Times New Roman", serif',
  headerFontFamily: '"Times New Roman", serif',
  contentFontFamily: '"Times New Roman", serif',
  attachmentFontFamily: '"Times New Roman", serif',
  fontSize: 12,

  showKop: true,
  headerContent: `
    <div style="text-align: center;">
      <p style="margin: 0;"><span style="font-size: 16pt;"><strong>UNIVERSITAS ISLAM NEGERI</strong></span></p>
      <p style="margin: 0;"><span style="font-size: 14pt;"><strong>SUNAN GUNUNG DJATI BANDUNG</strong></span></p>
      <p style="margin: 0; font-size: 10pt;">Jl. A.H. Nasution No. 105, Cibiru, Bandung 40614</p>
      <p style="margin: 0; font-size: 10pt;">Telp. (022) 7800525 Fax. (022) 7803936 Website: www.uinsgd.ac.id</p>
    </div>
  `,
  // Initial Header Lines: Standard Double Line effect
  headerLines: [
      { id: 'l1', width: 3, style: 'solid', color: '#000000', marginTop: 8, marginBottom: 2 },
      { id: 'l2', width: 1, style: 'solid', color: '#000000', marginTop: 0, marginBottom: 0 },
  ],
  
  // Left Logo
  logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Logo_UIN_Sunan_Gunung_Djati_Bandung.png", 
  logoAspectRatio: "1:1",
  logoWidth: 80, // Default width

  // Right Logo
  showRightLogo: false,
  rightLogoUrl: "",
  rightLogoWidth: 80,

  rawHtmlContent: "<p>Kepada Yth.<br><strong>{{ $nama_penerima }}</strong><br>di Tempat</p><p>Assalamu'alaikum Wr. Wb.</p><p>Dengan hormat, sehubungan dengan...</p>",
  
  hasAttachment: false,
  attachmentShowKop: false,
  attachmentContent: `
    <table style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid black;">
        <thead>
            <tr>
                <th style="border: 1px solid black; padding: 5px;">No</th>
                <th style="border: 1px solid black; padding: 5px;">Nama</th>
                <th style="border: 1px solid black; padding: 5px;">Keterangan</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="border: 1px solid black; padding: 5px;">1</td>
                <td style="border: 1px solid black; padding: 5px;">Data 1</td>
                <td style="border: 1px solid black; padding: 5px;">-</td>
            </tr>
        </tbody>
    </table>
  `,

  showFooter: false,
  footerContent: "<p>Dokumen ini dibuat secara otomatis.</p>",

  variables: [
    { id: 'v1', key: 'nama_penerima', label: 'Nama Penerima', defaultValue: 'Bapak/Ibu Dosen' },
    { id: 'v2', key: 'tanggal', label: 'Tanggal Surat', defaultValue: '12 Januari 2026' }
  ],
  showSignature: true,
  signatureCity: "Bandung",
  signatures: [
    { id: 's1', name: 'Prof. Dr. H. Rosihon Anwar, M.Ag', title: 'Rektor', type: 'wet', label: 'Mengetahui,', align: 'right' }
  ]
};

const App: React.FC = () => {
  const [docState, setDocState] = useState<DocumentState>({
    originalImage: null,
    isAnalyzing: false,
    isGeneratingLogo: false,
    analysisError: null,
  });

  const [settings, setSettings] = useState<LetterSettings>(DEFAULT_SETTINGS);
  const [view, setView] = useState<TabView>(TabView.UPLOAD);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bladeInputRef = useRef<HTMLInputElement>(null);

  const handleManualCreate = () => {
    setSettings(DEFAULT_SETTINGS);
    setView(TabView.EDITOR);
  };

  const handleOpenViewer = () => {
      const viewerUrl = new URL('bladeviewer/', window.location.href).href;
      window.open(viewerUrl, '_blank');
  };

  const handleBackToUpload = () => {
    if (confirm("Are you sure you want to go back? Unsaved changes will be lost.")) {
      setView(TabView.UPLOAD);
      setDocState(prev => ({ ...prev, originalImage: null, analysisError: null }));
    }
  };

  const resizeImage = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
              const img = new Image();
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  let width = img.width;
                  let height = img.height;
                  const MAX_SIZE = 1024;
                  if (width > height) {
                      if (width > MAX_SIZE) {
                          height *= MAX_SIZE / width;
                          width = MAX_SIZE;
                      }
                  } else {
                      if (height > MAX_SIZE) {
                          width *= MAX_SIZE / height;
                          height = MAX_SIZE;
                      }
                  }
                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  ctx?.drawImage(img, 0, 0, width, height);
                  resolve(canvas.toDataURL('image/jpeg', 0.7)); 
              };
              img.src = e.target?.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
      });
  };

  // --- PARSE BLADE FILE LOGIC (ROBUST DOM-BASED) ---
  const handleBladeUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
          const text = e.target?.result as string;
          try {
              parseBladeContent(text);
          } catch (err) {
              alert("Error parsing Blade file. Make sure it's a valid HTML/Blade file.");
              console.error(err);
          }
      };
      reader.readAsText(file);
  };

  const parseBladeContent = (text: string) => {
      const newSettings = { ...DEFAULT_SETTINGS };
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');

      // 1. Page Size & CSS
      const styleTag = doc.querySelector('style');
      if (styleTag) {
          const styleText = styleTag.textContent || '';
          const pageRegex = /@page\s*\{\s*size:\s*([\d.]+[a-z]+)\s+([\d.]+[a-z]+);\s*margin:\s*([\d.]+[a-z]+)\s+([\d.]+[a-z]+)\s+([\d.]+[a-z]+)\s+([\d.]+[a-z]+);/i;
          const pageMatch = styleText.match(pageRegex);
          if (pageMatch) {
              const widthStr = pageMatch[1];
              const unitMatch = widthStr.match(/[a-z]+/i);
              const unit = (unitMatch ? unitMatch[0] : 'cm') as any;

              newSettings.unit = unit;
              newSettings.pageWidth = parseFloat(pageMatch[1]);
              newSettings.pageHeight = parseFloat(pageMatch[2]);
              newSettings.marginTop = parseFloat(pageMatch[3]);
              newSettings.marginRight = parseFloat(pageMatch[4]);
              newSettings.marginBottom = parseFloat(pageMatch[5]);
              newSettings.marginLeft = parseFloat(pageMatch[6]);
              newSettings.pageSize = 'Custom';
          }
          const fontMatch = styleText.match(/body\s*\{\s*font-family:\s*([^;]+);/i);
          if (fontMatch) newSettings.globalFontFamily = fontMatch[1].trim();
      }

      // 2. Header / Kop Surat (Support Table and Div structures)
      const headerTable = doc.querySelector('table.header-table');
      const headerDiv = doc.querySelector('div.header-container');
      
      if (headerTable) {
          newSettings.showKop = true;
          // Find center text cell
          const centerCell = Array.from(headerTable.querySelectorAll('td')).find(td => 
              td.getAttribute('style')?.includes('text-align: center')
          );
          if (centerCell) newSettings.headerContent = centerCell.innerHTML.trim();

          const imgs = headerTable.querySelectorAll('img');
          if (imgs.length > 0) newSettings.logoUrl = imgs[0].getAttribute('src') || '';
          if (imgs.length > 1) {
              newSettings.showRightLogo = true;
              newSettings.rightLogoUrl = imgs[1].getAttribute('src') || '';
          }
      } else if (headerDiv) {
          newSettings.showKop = true;
          const contentDiv = headerDiv.querySelector('.header-content');
          if (contentDiv) newSettings.headerContent = contentDiv.innerHTML.trim();
          
          const logoDiv = headerDiv.querySelector('.header-logo');
          if (logoDiv) {
              const img = logoDiv.querySelector('img');
              if (img) newSettings.logoUrl = img.getAttribute('src') || '';
          }
          // Assuming div structure mostly used for single logo, but if complex we can expand.
      } else {
          newSettings.showKop = false;
      }

      // 3. Header Lines
      const linesDiv = doc.querySelector('div.header-lines');
      if (linesDiv) {
          const lines: any[] = [];
          Array.from(linesDiv.children).forEach((child, idx) => {
              const style = child.getAttribute('style') || '';
              // Simple extraction of border props
              const widthMatch = style.match(/border-bottom(?:-width)?:\s*(\d+)px/i);
              if (widthMatch) {
                   const styleMatch = style.match(/border-bottom(?:-style)?:\s*(\w+)/i);
                   const colorMatch = style.match(/border-bottom(?:-color)?:\s*(#[0-9a-fA-F]+|[a-z]+)/i);
                   const mtMatch = style.match(/margin-top:\s*(\d+)px/i);
                   const mbMatch = style.match(/margin-bottom:\s*(\d+)px/i);
                   
                   lines.push({
                        id: `line-load-${idx}`,
                        width: parseInt(widthMatch[1]),
                        style: (styleMatch ? styleMatch[1] : 'solid') as any,
                        color: colorMatch ? colorMatch[1] : '#000000',
                        marginTop: mtMatch ? parseInt(mtMatch[1]) : 0,
                        marginBottom: mbMatch ? parseInt(mbMatch[1]) : 0
                   });
              }
          });
          if (lines.length > 0) newSettings.headerLines = lines;
      }

      // 4. Content
      const contentDiv = doc.querySelector('div.content');
      if (contentDiv) {
          newSettings.rawHtmlContent = contentDiv.innerHTML.trim();
      }

      // 5. Footer
      const footerDiv = doc.querySelector('div.footer');
      if (footerDiv) {
          newSettings.showFooter = true;
          newSettings.footerContent = footerDiv.innerHTML.trim();
      }

      // 6. Attachments
      const attachmentDiv = doc.querySelector('div.attachment-section');
      if (attachmentDiv) {
          newSettings.hasAttachment = true;
          // Check for header repetition
          const headers = doc.querySelectorAll('.header-table, .header-container');
          if (headers.length > 1) newSettings.attachmentShowKop = true;

          let html = attachmentDiv.innerHTML;
          html = html.replace(/<h3>Lampiran<\/h3>/i, '');
          newSettings.attachmentContent = html.trim();
      }

      // 7. Variables (Regex still best for this)
      const varRegex = /\{\{\s*\$([a-zA-Z0-9_]+)\s*\}\}/g;
      const foundVars = new Set<string>();
      const varMatches = [...text.matchAll(varRegex)];
      const newVariables: Variable[] = [];
      varMatches.forEach((m, idx) => {
          const key = m[1];
          if (!foundVars.has(key) && key !== 'title') {
              foundVars.add(key);
              newVariables.push({
                  id: `var-load-${idx}`,
                  key: key,
                  label: key.replace(/_/g, ' '),
                  defaultValue: `[${key}]`
              });
          }
      });
      if (newVariables.length > 0) newSettings.variables = newVariables;
      
      // 8. Signatures
      const sigContainer = doc.querySelector('div.signature-container');
      if (sigContainer) {
           newSettings.showSignature = true;
           const sigBlocks = sigContainer.querySelectorAll('.sig-block');
           if (sigBlocks.length > 0) {
               // Try to infer city from last block
               const lastSig = sigBlocks[sigBlocks.length - 1];
               const cityP = Array.from(lastSig.querySelectorAll('p')).find(p => p.textContent?.includes('$tanggal'));
               if (cityP) {
                   const cityText = cityP.textContent || '';
                   const cityMatch = cityText.split(',')[0].trim();
                   newSettings.signatureCity = cityMatch;
               }
           }
      }

      setSettings(newSettings);
      setView(TabView.EDITOR);
  };
  // -------------------------

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.docx') || file.name.endsWith('.doc') || 
        file.type.includes('wordprocessingml') || file.type.includes('msword')) {
        alert("Microsoft Word (.docx) is NOT supported directly. Please Save As PDF first, then upload the PDF.");
        return;
    }

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';

    if (!isImage && !isPdf) {
        alert("Unsupported file type. Please upload PDF, JPG, or PNG.");
        return;
    }

    setDocState(prev => ({ ...prev, isAnalyzing: true, analysisError: null }));

    try {
        let base64Data = "";
        let finalMimeType = file.type;

        if (isImage) {
            const resizedDataUrl = await resizeImage(file);
            setDocState(prev => ({ ...prev, originalImage: resizedDataUrl }));
            base64Data = resizedDataUrl.split(',')[1];
            finalMimeType = 'image/jpeg';
        } else {
            const reader = new FileReader();
            base64Data = await new Promise((resolve, reject) => {
                reader.onload = (e) => {
                    setDocState(prev => ({ ...prev, originalImage: null }));
                    resolve((e.target?.result as string).split(',')[1]);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        const analysis = await analyzeDocumentImage(base64Data, finalMimeType);
        
        let detectedHeader = '';
        if (analysis.institutionName || analysis.institutionAddress) {
            detectedHeader = `
                <div style="text-align: center;">
                    <p style="margin: 0;"><span style="font-size: 14pt;"><strong>${analysis.institutionName.replace(/\n/g, '<br>')}</strong></span></p>
                    <p style="margin: 0; font-size: 10pt;">${analysis.institutionAddress.replace(/\n/g, '<br>')}</p>
                </div>
            `;
        }

        setSettings(prev => ({
          ...prev,
          headerContent: detectedHeader || prev.headerContent,
          rawHtmlContent: analysis.htmlContent,
          hasAttachment: !!analysis.attachmentContent,
          attachmentContent: analysis.attachmentContent || prev.attachmentContent,
          variables: analysis.detectedVariables.map((v, i) => ({ ...v, id: `var-${i}` })),
          signatures: analysis.signatureName ? [{
             id: 'sig-ai',
             name: analysis.signatureName,
             title: analysis.signatureTitle || 'Pejabat',
             type: 'wet',
             label: 'Hormat Kami,',
             align: 'right'
          }] : prev.signatures
        }));
        
        setView(TabView.EDITOR);

    } catch (err: any) {
        console.error(err);
        setDocState(prev => ({ 
            ...prev, 
            analysisError: `Analysis Failed: ${err.message || 'Unknown Error'}. Try manual creation or a smaller image.` 
        }));
    } finally {
        setDocState(prev => ({ ...prev, isAnalyzing: false }));
    }
  };

  const handleDownloadBlade = () => {
    const totalSigs = settings.signatures.length;
    let containerAlignStyle = "margin-top: 50px; width: 100%;";
    if (totalSigs === 1) {
        const align = settings.signatures[0].align || 'right';
        containerAlignStyle += ` text-align: ${align};`;
    } else {
        containerAlignStyle += " overflow: hidden;";
    }

    const signaturesHtml = settings.signatures.map((sig, idx) => {
        const isLast = idx === totalSigs - 1;
        const isOdd = totalSigs % 2 !== 0;
        let blockStyle = '';
        if (totalSigs === 1) {
            blockStyle = 'display: inline-block; text-align: center; min-width: 200px; vertical-align: top;';
        } else if (isOdd && isLast) {
            blockStyle = 'width: 100%; clear: both; float: none; display: block; text-align: center; margin-top: 20px;';
        } else {
            blockStyle = 'width: 50%; float: left; text-align: center; margin-bottom: 20px;';
        }

        return `
        <div class="sig-block" style="${blockStyle}">
            <p>${sig.label}</p>
            ${isLast ? `<p>${settings.signatureCity}, {{ $tanggal }}</p>` : ''}
            ${sig.type === 'wet' ? '<div style="height: 80px;"></div>' : `<div style="height: 80px; text-align:center;"><img src="{{ $qr_code_${idx} ?? '' }}" alt="QR" style="height:70px; width:70px; display:inline-block;"></div>`}
            <p style="font-weight: bold; text-decoration: underline;">${sig.name}</p>
            <p>${sig.title}</p>
        </div>
    `;
    }).join('');

    const headerLinesHtml = settings.headerLines.map(line => `
        <div style="
            border-bottom: ${line.width}px ${line.style} ${line.color}; 
            margin-top: ${line.marginTop}px; 
            margin-bottom: ${line.marginBottom}px;
            width: 100%;
            clear: both;
        "></div>
    `).join('');

    const rightLogoHtml = settings.showRightLogo && settings.rightLogoUrl 
        ? `<td style="width: ${settings.rightLogoWidth}px; vertical-align: middle; text-align: right; padding-left: 10px;">
             <img src="${settings.rightLogoUrl}" alt="Right Logo" style="width: 100%; height: auto;">
           </td>` 
        : (settings.logoUrl && settings.showRightLogo ? `<td style="width: 1px;"></td>` : '');

    const headerHtml = `
    <table class="header-table" style="width: 100%; border: none; margin-bottom: 5px; font-family: ${settings.headerFontFamily.replace(/"/g, "'")};">
        <tr>
            ${settings.logoUrl ? `
            <td style="width: ${settings.logoWidth}px; vertical-align: middle; text-align: left; padding-right: 10px;">
                <img src="${settings.logoUrl}" alt="Logo" style="width: 100%; height: auto;">
            </td>` : ''}
            
            <td style="vertical-align: middle; text-align: center;">
                ${settings.headerContent}
            </td>
            
            ${rightLogoHtml}
        </tr>
    </table>
    <div class="header-lines">
        ${headerLinesHtml}
    </div>
    `;

    const bladeContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $title ?? 'Document' }}</title>
    <style>
        @page {
            size: ${settings.pageWidth}${settings.unit} ${settings.pageHeight}${settings.unit};
            margin: ${settings.marginTop}${settings.unit} ${settings.marginRight}${settings.unit} ${settings.marginBottom}${settings.unit} ${settings.marginLeft}${settings.unit};
        }
        body {
            font-family: ${settings.globalFontFamily.replace(/"/g, "'")};
            font-size: ${settings.fontSize}pt;
            line-height: 1.5;
            color: #000;
        }
        table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
        th, td { border: 1px solid black; padding: 4px; text-align: left; }
        
        .header-lines { margin-bottom: 15px; }
        .content { font-family: ${settings.contentFontFamily.replace(/"/g, "'")}; }
        .footer { 
            position: fixed; 
            bottom: 0; left: 0; right: 0; 
            height: 30px; text-align: center; font-size: 0.8em; color: #666;
            border-top: 1px solid #eee; 
        }
        .page-break { page-break-before: always; clear: both; }
        .attachment-section { font-family: ${settings.attachmentFontFamily.replace(/"/g, "'")}; }
    </style>
</head>
<body>
    @if(${settings.showFooter ? 'true' : 'false'})
    <div class="footer">${settings.footerContent}</div>
    @endif

    @if(${settings.showKop ? 'true' : 'false'})
    ${headerHtml}
    @endif

    <div class="content">${settings.rawHtmlContent}</div>

    @if(${settings.showSignature ? 'true' : 'false'})
    <div class="signature-container" style="${containerAlignStyle}">${signaturesHtml}</div>
    @endif

    @if(${settings.hasAttachment ? 'true' : 'false'})
    <div class="page-break"></div>
    @if(${settings.attachmentShowKop ? 'true' : 'false'})
    ${headerHtml}
    <br>
    @endif
    <div class="attachment-section">
        <h3>Lampiran</h3>
        ${settings.attachmentContent}
    </div>
    @endif
</body>
</html>`;

    const blob = new Blob([bladeContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template.blade.php';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-screen w-screen bg-gray-100 overflow-hidden font-sans">
      {view !== TabView.UPLOAD && (
         <div className="lg:hidden absolute top-4 left-4 z-50 flex bg-white rounded-lg shadow-md p-1">
             <button onClick={() => setView(TabView.EDITOR)} className={`px-3 py-1 text-sm rounded ${view === TabView.EDITOR ? 'bg-indigo-100 text-indigo-700' : ''}`}>Edit</button>
             <button onClick={() => setView(TabView.PREVIEW)} className={`px-3 py-1 text-sm rounded ${view === TabView.PREVIEW ? 'bg-indigo-100 text-indigo-700' : ''}`}>Preview</button>
         </div>
      )}

      {(view === TabView.UPLOAD || view === TabView.EDITOR) && (
          <div className={`w-full lg:w-[420px] flex-shrink-0 h-full transition-all duration-300 ${view === TabView.UPLOAD ? 'lg:w-full items-center justify-center' : ''}`}>
             {view === TabView.UPLOAD ? (
                 <div className="max-w-xl w-full p-8 bg-white rounded-2xl shadow-xl text-center mx-4">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">BladeRunner</h1>
                    <p className="text-gray-500 mb-8">AI-Powered Laravel Blade Template Generator</p>
                    
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800 mb-6 text-left">
                        <strong>Supported Formats:</strong> PDF, JPG, PNG.<br/>
                        <strong>Note:</strong> Microsoft Word (.docx) and Google Docs are <u>not supported directly</u>. Please use "Save as PDF" first, then upload the PDF here.
                    </div>

                    {docState.analysisError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 mb-4 text-left">
                            <strong>Error:</strong> {docState.analysisError}
                        </div>
                    )}

                    <div className="flex flex-col gap-4">
                        <div className="relative group w-full">
                            <input type="file" accept="image/*,.pdf" ref={fileInputRef} onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={docState.isAnalyzing} />
                            <button className={`w-full py-4 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 text-indigo-700 font-medium ${docState.isAnalyzing ? 'animate-pulse' : ''}`}>
                                {docState.isAnalyzing ? 'Compressing & Analyzing (Please Wait)...' : 'Click to Upload PDF or Image'}
                            </button>
                        </div>
                        
                        <div className="relative flex py-1 items-center">
                            <div className="flex-grow border-t border-gray-200"></div>
                            <span className="flex-shrink-0 mx-2 text-xs text-gray-400">OR</span>
                            <div className="flex-grow border-t border-gray-200"></div>
                        </div>

                        <div className="text-left grid grid-cols-2 gap-2">
                            <button onClick={handleManualCreate} className="w-full py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 font-medium text-gray-700 shadow-sm col-span-2">
                                Manual Creation
                            </button>
                            <p className="col-span-2 text-xs text-indigo-600 font-medium text-center bg-indigo-50 py-2 rounded border border-indigo-100">
                                Start from scratch with a blank canvas. No AI analysis.
                            </p>

                            <div className="col-span-2 relative group">
                                <input type="file" accept=".php" ref={bladeInputRef} onChange={handleBladeUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                <button className="w-full py-3 rounded-xl border-2 border-indigo-100 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium shadow-sm transition-colors">
                                    📂 Upload .blade.php to Edit
                                </button>
                            </div>

                            <button onClick={handleOpenViewer} className="w-full py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs text-gray-600 col-span-2 mt-2">
                                ↗ Open Viewer
                            </button>
                        </div>
                    </div>
                 </div>
             ) : (
                 <EditorPanel 
                    settings={settings} 
                    setSettings={setSettings} 
                    onDownload={handleDownloadBlade} 
                    onBack={handleBackToUpload}
                 />
             )}
          </div>
      )}

      {view !== TabView.UPLOAD && (
        <div className={`flex-1 bg-gray-200 overflow-auto flex items-start justify-center p-8 lg:p-12 ${view === TabView.EDITOR ? 'hidden lg:flex' : ''}`}>
           <TemplatePreview settings={settings} />
        </div>
      )}
    </div>
  );
};

export default App;
import React, { useState, useRef } from 'react';
import { analyzeDocumentImage } from './services/geminiService';
import { DocumentState, LetterSettings, TabView } from './types';
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
  logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Logo_UIN_Sunan_Gunung_Djati_Bandung.png", 
  logoAspectRatio: "1:1",
  
  rawHtmlContent: "<p>Kepada Yth.<br><strong>{{ $nama_penerima }}</strong><br>di Tempat</p><p>Assalamu'alaikum Wr. Wb.</p><p>Dengan hormat, sehubungan dengan...</p>",
  
  hasAttachment: false,
  attachmentShowKop: false,
  attachmentContent: `
    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
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

  const handleManualCreate = () => {
    setSettings(DEFAULT_SETTINGS);
    setView(TabView.EDITOR);
  };

  const handleBackToUpload = () => {
    if (confirm("Are you sure you want to go back? Unsaved changes will be lost.")) {
      setView(TabView.UPLOAD);
      setDocState(prev => ({ ...prev, originalImage: null, analysisError: null }));
    }
  };

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

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Result = e.target?.result as string;
      setDocState(prev => ({ ...prev, originalImage: isImage ? base64Result : null, isAnalyzing: true, analysisError: null }));
      
      try {
        const base64Data = base64Result.split(',')[1];
        const analysis = await analyzeDocumentImage(base64Data, file.type);
        
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
      } catch (err) {
        setDocState(prev => ({ ...prev, analysisError: "AI Analysis failed. Please try 'Manual Creation' or a different file." }));
      } finally {
        setDocState(prev => ({ ...prev, isAnalyzing: false }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadBlade = () => {
    const totalSigs = settings.signatures.length;
    
    // Determine overall container alignment for single signature
    let containerAlignStyle = "margin-top: 50px; width: 100%;";
    if (totalSigs === 1) {
        const align = settings.signatures[0].align || 'right';
        containerAlignStyle += ` text-align: ${align};`;
    } else {
        containerAlignStyle += " overflow: hidden;"; // Clear floats
    }

    const signaturesHtml = settings.signatures.map((sig, idx) => {
        const isLast = idx === totalSigs - 1;
        const isOdd = totalSigs % 2 !== 0;
        
        // CSS Logic for Layout:
        // 1. Single Sig: Inline-block (handled by container text-align)
        // 2. Multiple Sigs: Float left 50%
        // 3. Odd Last Sig (>1): Clear both, 100% width, center.
        
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

    // Generate Dynamic Header Lines HTML
    const headerLinesHtml = settings.headerLines.map(line => `
        <div style="
            border-bottom: ${line.width}px ${line.style} ${line.color}; 
            margin-top: ${line.marginTop}px; 
            margin-bottom: ${line.marginBottom}px;
            width: 100%;
            clear: both;
        "></div>
    `).join('');

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
        
        .header-container { display: table; width: 100%; margin-bottom: 5px; font-family: ${settings.headerFontFamily.replace(/"/g, "'")}; }
        .header-logo { display: table-cell; vertical-align: middle; width: 80px; padding-right: 15px; }
        .header-logo img { width: 100%; height: auto; }
        .header-content { display: table-cell; vertical-align: middle; text-align: center; }
        
        /* Dynamic Header Lines Container */
        .header-lines { margin-bottom: 15px; }

        .content { font-family: ${settings.contentFontFamily.replace(/"/g, "'")}; }
        
        .footer { 
            position: fixed; 
            bottom: 0; 
            left: 0; 
            right: 0; 
            height: 30px; 
            text-align: center; 
            font-size: 0.8em; 
            color: #666;
            border-top: 1px solid #eee; 
        }

        .page-break { page-break-before: always; clear: both; }
        .attachment-section { font-family: ${settings.attachmentFontFamily.replace(/"/g, "'")}; }
    </style>
</head>
<body>
    @if(${settings.showFooter ? 'true' : 'false'})
    <div class="footer">
        ${settings.footerContent}
    </div>
    @endif

    @if(${settings.showKop ? 'true' : 'false'})
    <div class="header-container">
        <div class="header-logo"><img src="${settings.logoUrl}" alt="Logo"></div>
        <div class="header-content">${settings.headerContent}</div>
    </div>
    <div class="header-lines">
        ${headerLinesHtml}
    </div>
    @endif

    <div class="content">${settings.rawHtmlContent}</div>

    @if(${settings.showSignature ? 'true' : 'false'})
    <div class="signature-container" style="${containerAlignStyle}">${signaturesHtml}</div>
    @endif

    @if(${settings.hasAttachment ? 'true' : 'false'})
    <div class="page-break"></div>
    
    @if(${settings.attachmentShowKop ? 'true' : 'false'})
    <div class="header-container">
        <div class="header-logo"><img src="${settings.logoUrl}" alt="Logo"></div>
        <div class="header-content">${settings.headerContent}</div>
    </div>
    <div class="header-lines">
        ${headerLinesHtml}
    </div>
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
          <div className={`w-full lg:w-[420px] flex-shrink-0 h-full transition-all duration-300 ${view === TabView.UPLOAD ? 'lg:w-full items-center justify-center' : ''} ${view === TabView.PREVIEW ? 'hidden lg:block' : ''}`}>
             {view === TabView.UPLOAD ? (
                 <div className="max-w-xl w-full p-8 bg-white rounded-2xl shadow-xl text-center mx-4">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">BladeRunner</h1>
                    <p className="text-gray-500 mb-8">AI-Powered Laravel Blade Template Generator</p>
                    
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800 mb-6 text-left">
                        <strong>Supported Formats:</strong> PDF, JPG, PNG.<br/>
                        <strong>Note:</strong> Microsoft Word (.docx) and Google Docs are <u>not supported directly</u>. Please use "Save as PDF" first, then upload the PDF here.
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="relative group w-full">
                            <input type="file" accept="image/*,.pdf" ref={fileInputRef} onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={docState.isAnalyzing} />
                            <button className={`w-full py-4 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 text-indigo-700 font-medium ${docState.isAnalyzing ? 'animate-pulse' : ''}`}>
                                {docState.isAnalyzing ? 'Analyzing Document with AI...' : 'Click to Upload PDF or Image'}
                            </button>
                        </div>
                        
                        <div className="relative flex py-1 items-center">
                            <div className="flex-grow border-t border-gray-200"></div>
                            <span className="flex-shrink-0 mx-2 text-xs text-gray-400">OR</span>
                            <div className="flex-grow border-t border-gray-200"></div>
                        </div>

                        <div className="text-left">
                            <button onClick={handleManualCreate} className="w-full py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 font-medium text-gray-700 shadow-sm">
                                Manual Creation
                            </button>
                            <p className="text-xs text-indigo-600 font-medium mt-2 text-center bg-indigo-50 py-2 rounded border border-indigo-100">
                                Start from scratch with a blank canvas. No AI analysis.
                            </p>
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
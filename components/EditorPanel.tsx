import React, { useState, useEffect } from 'react';
import { LetterSettings, Variable, Signature, HeaderLine, PageSizePreset, Unit } from '../types';
import { generateLogo } from '../services/geminiService';
import RichTextEditor from './RichTextEditor';

interface EditorPanelProps {
  settings: LetterSettings;
  setSettings: React.Dispatch<React.SetStateAction<LetterSettings>>;
  onDownload: () => void;
  onBack: () => void;
}

// Standard sizes in mm
const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  'A4': { width: 210, height: 297 },
  'Letter': { width: 215.9, height: 279.4 },
  'Legal': { width: 215.9, height: 355.6 },
  'F4': { width: 215, height: 330 }, // Indonesian Folio approximation
};

const EditorPanel: React.FC<EditorPanelProps> = ({ settings, setSettings, onDownload, onBack }) => {
  const [logoPrompt, setLogoPrompt] = useState("");
  const [isGeneratingLogo, setIsGeneratingLogo] = useState(false);
  const [activeSection, setActiveSection] = useState<'layout' | 'header' | 'content' | 'attachments' | 'footer' | 'variables'>('content');

  const updateSetting = <K extends keyof LetterSettings>(key: K, value: LetterSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Unit conversion helper
  const convertValue = (val: number, from: Unit, to: Unit): number => {
      let mm = val;
      if (from === 'cm') mm = val * 10;
      if (from === 'in') mm = val * 25.4;
      
      if (to === 'mm') return parseFloat(mm.toFixed(2));
      if (to === 'cm') return parseFloat((mm / 10).toFixed(2));
      if (to === 'in') return parseFloat((mm / 25.4).toFixed(3));
      return val;
  };

  const handleUnitChange = (newUnit: Unit) => {
    const oldUnit = settings.unit;
    if (oldUnit === newUnit) return;

    setSettings(prev => ({
        ...prev,
        unit: newUnit,
        pageWidth: convertValue(prev.pageWidth, oldUnit, newUnit),
        pageHeight: convertValue(prev.pageHeight, oldUnit, newUnit),
        marginTop: convertValue(prev.marginTop, oldUnit, newUnit),
        marginBottom: convertValue(prev.marginBottom, oldUnit, newUnit),
        marginLeft: convertValue(prev.marginLeft, oldUnit, newUnit),
        marginRight: convertValue(prev.marginRight, oldUnit, newUnit),
    }));
  };

  const handlePageSizeChange = (preset: PageSizePreset) => {
      if (preset === 'Custom') {
          updateSetting('pageSize', 'Custom');
          return;
      }
      const sizeMm = PAGE_SIZES[preset];
      if (sizeMm) {
          const currentUnit = settings.unit;
          const w = convertValue(sizeMm.width, 'mm', currentUnit);
          const h = convertValue(sizeMm.height, 'mm', currentUnit);
          setSettings(prev => ({
              ...prev,
              pageSize: preset,
              pageWidth: w,
              pageHeight: h
          }));
      }
  };

  const handleGenerateLogo = async () => {
    if (!logoPrompt) return;
    setIsGeneratingLogo(true);
    try {
      const b64 = await generateLogo(logoPrompt, settings.logoAspectRatio);
      updateSetting('logoUrl', b64);
    } catch (e) {
      alert("Failed to generate logo. Try a different prompt.");
    } finally {
      setIsGeneratingLogo(false);
    }
  };
  
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        updateSetting('logoUrl', ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
          const result = ev.target?.result as string;
          if (file.type.startsWith('image/')) {
              const imgTag = `<br><img src="${result}" style="max-width: 100%; height: auto; margin: 10px 0;" /><br>`;
              updateSetting('attachmentContent', settings.attachmentContent + imgTag);
          } else {
             alert("Only Images (JPG/PNG) are supported for manual inline insertion. For text content, please copy-paste.");
          }
      };
      if (file.type.startsWith('image/')) {
          reader.readAsDataURL(file);
      } else {
          reader.readAsText(file);
      }
  };

  const handleAddVariable = (key: string) => {
    if (!settings.variables.find(v => v.key === key)) {
        const newVar: Variable = {
            id: `var-${Date.now()}`,
            key,
            label: key.replace(/_/g, ' '),
            defaultValue: `[${key}]`
        };
        updateSetting('variables', [...settings.variables, newVar]);
    }
  };

  const updateVariable = (id: string, field: keyof Variable, value: string) => {
    const newVars = settings.variables.map(v => v.id === id ? { ...v, [field]: value } : v);
    updateSetting('variables', newVars);
  };

  // HEADER LINES MANAGEMENT
  const addHeaderLine = () => {
    const newLine: HeaderLine = {
        id: `line-${Date.now()}`,
        width: 3,
        style: 'solid',
        color: '#000000',
        marginTop: 2,
        marginBottom: 2
    };
    updateSetting('headerLines', [...settings.headerLines, newLine]);
  };

  const removeHeaderLine = (id: string) => {
    updateSetting('headerLines', settings.headerLines.filter(l => l.id !== id));
  };

  const updateHeaderLine = (id: string, field: keyof HeaderLine, value: any) => {
    const newLines = settings.headerLines.map(l => l.id === id ? { ...l, [field]: value } : l);
    updateSetting('headerLines', newLines);
  };

  // SIGNATURE MANAGEMENT
  const addSignature = () => {
    const newSig: Signature = {
        id: `sig-${Date.now()}`,
        name: 'Nama Penanda Tangan',
        title: 'Jabatan',
        type: 'wet',
        label: settings.signatures.length === 0 ? 'Hormat Kami,' : 'Mengetahui,',
        align: 'right' // Default alignment
    };
    updateSetting('signatures', [...settings.signatures, newSig]);
  };

  const removeSignature = (id: string) => {
    updateSetting('signatures', settings.signatures.filter(s => s.id !== id));
  };

  const updateSignature = (id: string, field: keyof Signature, value: any) => {
    const newSigs = settings.signatures.map(s => s.id === id ? { ...s, [field]: value } : s);
    updateSetting('signatures', newSigs);
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200 shadow-sm overflow-hidden text-gray-900">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <div className="flex items-center gap-2">
            <button onClick={onBack} className="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100" title="Back">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <h2 className="font-bold text-gray-700 text-sm">Settings</h2>
        </div>
        <button onClick={onDownload} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 shadow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Download
        </button>
      </div>

      <div className="flex border-b border-gray-200 text-xs overflow-x-auto no-scrollbar bg-white">
        {['Layout', 'Header', 'Content', 'Attachments', 'Footer', 'Variables'].map((tab) => (
          <button key={tab} onClick={() => setActiveSection(tab.toLowerCase() as any)} className={`px-4 py-3 font-medium whitespace-nowrap transition-colors ${activeSection === tab.toLowerCase() ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-white">
        
        {/* LAYOUT SETTINGS */}
        {activeSection === 'layout' && (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Page Setup</label>
              
              <div className="flex gap-2 mb-2">
                  <div className="flex-1">
                      <label className="text-[10px] text-gray-400 block mb-1">Preset Size</label>
                      <select 
                        value={settings.pageSize}
                        onChange={(e) => handlePageSizeChange(e.target.value as PageSizePreset)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white text-gray-900"
                      >
                          <option value="A4">A4</option>
                          <option value="Letter">Letter</option>
                          <option value="Legal">Legal</option>
                          <option value="F4">F4 (Folio)</option>
                          <option value="Custom">Custom</option>
                      </select>
                  </div>
                  <div className="w-20">
                      <label className="text-[10px] text-gray-400 block mb-1">Unit</label>
                      <select 
                        value={settings.unit}
                        onChange={(e) => handleUnitChange(e.target.value as Unit)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white text-gray-900"
                      >
                          <option value="mm">mm</option>
                          <option value="cm">cm</option>
                          <option value="in">inch</option>
                      </select>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                      <label className="text-[10px] text-gray-400 block mb-1">Width ({settings.unit})</label>
                      <input 
                          type="number"
                          step="0.1"
                          value={settings.pageWidth}
                          onChange={(e) => {
                              updateSetting('pageWidth', parseFloat(e.target.value));
                              updateSetting('pageSize', 'Custom');
                          }}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white text-gray-900"
                      />
                  </div>
                  <div>
                      <label className="text-[10px] text-gray-400 block mb-1">Height ({settings.unit})</label>
                      <input 
                          type="number"
                          step="0.1"
                          value={settings.pageHeight}
                          onChange={(e) => {
                              updateSetting('pageHeight', parseFloat(e.target.value));
                              updateSetting('pageSize', 'Custom');
                          }}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white text-gray-900"
                      />
                  </div>
              </div>

              <div className="border-t border-gray-100 my-4"></div>

              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Margins ({settings.unit})</label>
              <div className="grid grid-cols-2 gap-3">
                {['Top', 'Right', 'Bottom', 'Left'].map((side) => (
                  <div key={side}>
                    <label className="text-[10px] text-gray-400 block mb-1">{side}</label>
                    <input 
                      type="number" step="0.1" value={settings[`margin${side}` as keyof LetterSettings] as number}
                      onChange={(e) => updateSetting(`margin${side}` as keyof LetterSettings, parseFloat(e.target.value))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white text-gray-900"
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <div>
               <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Typography (Defaults)</label>
               <div className="space-y-2">
                 <div>
                    <label className="text-xs text-gray-400">Global Font Family</label>
                    <select 
                      value={settings.globalFontFamily}
                      onChange={(e) => updateSetting('globalFontFamily', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white"
                    >
                      <option value='"Times New Roman", serif'>Times New Roman</option>
                      <option value='"Arial", sans-serif'>Arial</option>
                      <option value='"Calibri", sans-serif'>Calibri</option>
                      <option value='"Verdana", sans-serif'>Verdana</option>
                    </select>
                 </div>
                 <div>
                    <label className="text-xs text-gray-400">Base Font Size (pt)</label>
                    <input 
                      type="number" 
                      value={settings.fontSize}
                      onChange={(e) => updateSetting('fontSize', parseInt(e.target.value))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white"
                    />
                 </div>
               </div>
            </div>
          </div>
        )}

        {/* HEADER SETTINGS */}
        {activeSection === 'header' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={settings.showKop} onChange={(e) => updateSetting('showKop', e.target.checked)} className="rounded text-indigo-600" />
              <span className="text-sm font-medium text-gray-700">Show Kop Surat</span>
            </div>

            {settings.showKop && (
              <>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Logo Settings</h3>
                    <div className="mb-3">
                        <label className="text-xs text-gray-400 block mb-1">Upload Logo Image</label>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Generate AI Logo (Description)</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={logoPrompt} 
                                onChange={(e) => setLogoPrompt(e.target.value)}
                                placeholder="e.g. minimalist university logo shield blue"
                                className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs bg-white text-gray-900"
                            />
                            <button 
                                onClick={handleGenerateLogo}
                                disabled={isGeneratingLogo || !logoPrompt}
                                className="bg-indigo-600 text-white text-xs px-2 py-1 rounded disabled:bg-gray-300"
                            >
                                {isGeneratingLogo ? '...' : 'Gen'}
                            </button>
                        </div>
                    </div>
                </div>

                <div>
                   <label className="text-xs text-gray-400 block mb-1">Header Content</label>
                   <RichTextEditor content={settings.headerContent} onChange={(html) => updateSetting('headerContent', html)} defaultFontFamily={settings.headerFontFamily} minHeight="120px" />
                </div>
                
                {/* DYNAMIC HEADER LINES */}
                <div className="border-t border-gray-200 pt-3">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Header Lines</label>
                        <button onClick={addHeaderLine} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-100">+ Add Line</button>
                    </div>
                    
                    {settings.headerLines.map((line, idx) => (
                        <div key={line.id} className="bg-gray-50 border border-gray-200 rounded p-2 mb-2 relative">
                             <button onClick={() => removeHeaderLine(line.id)} className="absolute top-1 right-1 text-gray-400 hover:text-red-500">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                             </button>
                             <div className="grid grid-cols-2 gap-2 mb-1">
                                <div>
                                    <label className="text-[9px] text-gray-400 block">Style</label>
                                    <select value={line.style} onChange={(e) => updateHeaderLine(line.id, 'style', e.target.value)} className="w-full text-xs border rounded p-1 bg-white text-gray-900">
                                        <option value="solid">Solid</option>
                                        <option value="double">Double</option>
                                        <option value="dashed">Dashed</option>
                                        <option value="dotted">Dotted</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] text-gray-400 block">Color</label>
                                    <div className="flex items-center gap-1">
                                        <input type="color" value={line.color} onChange={(e) => updateHeaderLine(line.id, 'color', e.target.value)} className="h-6 w-6 border-0 p-0" />
                                        <span className="text-[9px] text-gray-500">{line.color}</span>
                                    </div>
                                </div>
                             </div>
                             <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-[9px] text-gray-400 block">Thick (px)</label>
                                    <input type="number" value={line.width} onChange={(e) => updateHeaderLine(line.id, 'width', parseInt(e.target.value))} className="w-full text-xs border rounded p-1 bg-white text-gray-900" />
                                </div>
                                <div>
                                    <label className="text-[9px] text-gray-400 block">Top (px)</label>
                                    <input type="number" value={line.marginTop} onChange={(e) => updateHeaderLine(line.id, 'marginTop', parseInt(e.target.value))} className="w-full text-xs border rounded p-1 bg-white text-gray-900" />
                                </div>
                                <div>
                                    <label className="text-[9px] text-gray-400 block">Btm (px)</label>
                                    <input type="number" value={line.marginBottom} onChange={(e) => updateHeaderLine(line.id, 'marginBottom', parseInt(e.target.value))} className="w-full text-xs border rounded p-1 bg-white text-gray-900" />
                                </div>
                             </div>
                        </div>
                    ))}
                    {settings.headerLines.length === 0 && <p className="text-[10px] text-gray-400 italic text-center">No lines added.</p>}
                </div>
              </>
            )}
          </div>
        )}

        {/* CONTENT SETTINGS */}
        {activeSection === 'content' && (
          <div className="space-y-4 h-full flex flex-col">
             <div className="flex-1 flex flex-col min-h-[300px]">
                <div className="flex justify-between items-center mb-1">
                     <label className="text-xs text-gray-400 block">Letter Body</label>
                     <select 
                       value={settings.contentFontFamily} 
                       onChange={(e) => updateSetting('contentFontFamily', e.target.value)}
                       className="text-xs border border-gray-300 rounded px-1 bg-white text-gray-900"
                     >
                        <option value={settings.globalFontFamily}>Default Font</option>
                        <option value='"Arial", sans-serif'>Arial</option>
                        <option value='"Times New Roman", serif'>Times</option>
                     </select>
                </div>
                <RichTextEditor 
                    content={settings.rawHtmlContent}
                    onChange={(html) => updateSetting('rawHtmlContent', html)}
                    defaultFontFamily={settings.contentFontFamily}
                    availableVariables={settings.variables}
                    onAddVariable={handleAddVariable}
                    minHeight="350px"
                />
             </div>

             <div className="border-t border-gray-200 pt-4 mt-2">
                <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase">Signatures</label>
                    <button onClick={addSignature} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-200">+ Add</button>
                </div>

                {/* NEW INPUT for City */}
                {settings.signatures.length > 0 && (
                     <div className="mb-3">
                        <label className="text-[10px] text-gray-400 block uppercase">City / Location</label>
                        <input 
                            type="text" 
                            value={settings.signatureCity} 
                            onChange={(e) => updateSetting('signatureCity', e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white text-gray-900"
                            placeholder="e.g. Bandung"
                        />
                     </div>
                )}

                {settings.signatures.map((sig, index) => (
                        <div key={sig.id} className="border border-gray-200 rounded p-2 bg-gray-50 relative group mb-2">
                            <button onClick={() => removeSignature(sig.id)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">x</button>
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-[10px] text-gray-400 font-bold">Signature #{index + 1}</p>
                                <div className="flex items-center gap-1 border border-gray-200 rounded px-1 bg-white">
                                    <label className="text-[9px] text-gray-400 mr-1">Align:</label>
                                    <button 
                                        onClick={() => updateSignature(sig.id, 'align', 'left')} 
                                        className={`p-1 hover:bg-gray-100 rounded ${sig.align === 'left' ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}
                                        title="Left"
                                    >L</button>
                                    <button 
                                        onClick={() => updateSignature(sig.id, 'align', 'center')} 
                                        className={`p-1 hover:bg-gray-100 rounded ${sig.align === 'center' ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}
                                        title="Center"
                                    >C</button>
                                    <button 
                                        onClick={() => updateSignature(sig.id, 'align', 'right')} 
                                        className={`p-1 hover:bg-gray-100 rounded ${sig.align === 'right' || !sig.align ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}
                                        title="Right"
                                    >R</button>
                                </div>
                            </div>
                            
                            <div className="mb-2">
                                <label className="text-[9px] text-gray-400 block">Type</label>
                                <div className="flex gap-2 text-xs">
                                    <label className="flex items-center gap-1 cursor-pointer">
                                        <input type="radio" checked={sig.type === 'wet'} onChange={() => updateSignature(sig.id, 'type', 'wet')} name={`sigtype-${sig.id}`} />
                                        <span>Konvensional (Wet)</span>
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                        <input type="radio" checked={sig.type === 'qr'} onChange={() => updateSignature(sig.id, 'type', 'qr')} name={`sigtype-${sig.id}`} />
                                        <span>E-Sign (QR)</span>
                                    </label>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <input value={sig.label || ''} onChange={(e) => updateSignature(sig.id, 'label', e.target.value)} placeholder="Prefix (e.g. Mengetahui,)" className="text-xs border border-gray-300 rounded p-1 bg-white text-gray-900" />
                                <input value={sig.name} onChange={(e) => updateSignature(sig.id, 'name', e.target.value)} placeholder="Name" className="text-xs border border-gray-300 rounded p-1 font-bold bg-white text-gray-900" />
                            </div>
                            <input value={sig.title} onChange={(e) => updateSignature(sig.id, 'title', e.target.value)} placeholder="Title" className="w-full text-xs border border-gray-300 rounded p-1 bg-white text-gray-900" />
                        </div>
                ))}
             </div>
          </div>
        )}

        {/* ATTACHMENTS SETTINGS */}
        {activeSection === 'attachments' && (
            <div className="space-y-4 h-full flex flex-col">
                 <div className="bg-yellow-50 p-3 rounded text-xs text-yellow-800 border border-yellow-200">
                    <strong>Attachments:</strong> Automatically starts on a new page. You can add tables or upload images manually.
                 </div>

                 <div className="flex items-center gap-4 mb-2 flex-wrap">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={settings.hasAttachment}
                            onChange={(e) => updateSetting('hasAttachment', e.target.checked)}
                            className="rounded text-indigo-600"
                        />
                        <span className="text-sm font-medium text-gray-700">Enable</span>
                    </label>
                    
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={settings.attachmentShowKop}
                            onChange={(e) => updateSetting('attachmentShowKop', e.target.checked)}
                            disabled={!settings.hasAttachment}
                            className="rounded text-indigo-600 disabled:opacity-50"
                        />
                        <span className="text-sm font-medium text-gray-700">Repeat Kop Surat</span>
                    </label>
                 </div>

                 {settings.hasAttachment && (
                    <div className="flex-1 flex flex-col min-h-[400px]">
                        <div className="flex items-center gap-2 mb-2">
                            <label className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 px-2 py-1 rounded cursor-pointer">
                                <span>Upload Image to Attachment</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleAttachmentUpload} />
                            </label>
                            
                            <select 
                                value={settings.attachmentFontFamily} 
                                onChange={(e) => updateSetting('attachmentFontFamily', e.target.value)}
                                className="text-xs border border-gray-300 rounded px-1 ml-auto bg-white text-gray-900"
                            >
                                <option value={settings.globalFontFamily}>Default Font</option>
                                <option value='"Arial", sans-serif'>Arial</option>
                                <option value='"Courier New", monospace'>Courier</option>
                            </select>
                        </div>

                        <RichTextEditor 
                            content={settings.attachmentContent}
                            onChange={(html) => updateSetting('attachmentContent', html)}
                            defaultFontFamily={settings.attachmentFontFamily}
                            availableVariables={settings.variables}
                            onAddVariable={handleAddVariable}
                            minHeight="400px"
                            placeholder="Tables, Lists, or Images..."
                        />
                    </div>
                 )}
            </div>
        )}

        {/* FOOTER SETTINGS */}
        {activeSection === 'footer' && (
             <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <input 
                        type="checkbox" 
                        checked={settings.showFooter}
                        onChange={(e) => updateSetting('showFooter', e.target.checked)}
                        className="rounded text-indigo-600"
                    />
                    <span className="text-sm font-medium text-gray-700">Enable Footer</span>
                </div>
                {settings.showFooter && (
                    <RichTextEditor 
                        content={settings.footerContent}
                        onChange={(html) => updateSetting('footerContent', html)}
                        defaultFontFamily={settings.globalFontFamily}
                        minHeight="100px"
                        placeholder="e.g. Slogan, Page numbers, etc."
                    />
                )}
             </div>
        )}

        {/* VARIABLES SETTINGS */}
        {activeSection === 'variables' && (
            <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 border border-blue-200 mb-4">
                    Variables defined here can be inserted into the editor using the <code>{`{ }`}</code> button.
                    The default value is what shows up in the preview.
                </div>
                <div className="space-y-3">
                    {settings.variables.map((variable) => (
                        <div key={variable.id} className="border border-gray-200 rounded p-3 bg-gray-50 flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <span className="font-mono text-xs font-bold bg-gray-200 px-1 rounded text-gray-700">${variable.key}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] text-gray-400 block uppercase">Label</label>
                                    <input 
                                        type="text" 
                                        value={variable.label} 
                                        onChange={(e) => updateVariable(variable.id, 'label', e.target.value)}
                                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white text-gray-900"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-400 block uppercase">Default Value (Preview)</label>
                                    <input 
                                        type="text" 
                                        value={variable.defaultValue} 
                                        onChange={(e) => updateVariable(variable.id, 'defaultValue', e.target.value)}
                                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white text-gray-900"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                    {settings.variables.length === 0 && (
                        <p className="text-sm text-gray-500 text-center italic">No variables yet. Add them in the editor.</p>
                    )}
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default EditorPanel;
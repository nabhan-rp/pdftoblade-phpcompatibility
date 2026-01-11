import React, { useMemo } from 'react';
import { LetterSettings } from '../types';

interface TemplatePreviewProps {
  settings: LetterSettings;
  scale?: number;
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({ settings, scale = 1 }) => {

  const replaceVariables = (html: string) => {
    let content = html;
    settings.variables.forEach(v => {
      const regex = new RegExp(`\\{\\{\\s*\\$${v.key}\\s*\\}\\}`, 'g');
      content = content.replace(regex, `<span class="bg-yellow-100 text-yellow-800 px-1 rounded border border-yellow-300" title="$${v.key}">${v.defaultValue || v.key}</span>`);
    });
    return content;
  };

  const processedContent = useMemo(() => replaceVariables(settings.rawHtmlContent), [settings.rawHtmlContent, settings.variables]);
  const processedHeader = useMemo(() => replaceVariables(settings.headerContent), [settings.headerContent, settings.variables]);
  const processedAttachment = useMemo(() => replaceVariables(settings.attachmentContent), [settings.attachmentContent, settings.variables]);
  const processedFooter = useMemo(() => replaceVariables(settings.footerContent), [settings.footerContent, settings.variables]);

  const pageStyle = {
      width: `${settings.pageWidth}${settings.unit}`,
      minHeight: `${settings.pageHeight}${settings.unit}`,
      paddingTop: `${settings.marginTop}${settings.unit}`,
      paddingRight: `${settings.marginRight}${settings.unit}`,
      paddingBottom: `${settings.marginBottom}${settings.unit}`,
      paddingLeft: `${settings.marginLeft}${settings.unit}`,
  };

  const HeaderLines = () => (
    <div className="w-full clear-both">
        {settings.headerLines.map((line) => (
            <div 
                key={line.id} 
                style={{ 
                    borderBottomWidth: `${line.width}px`, 
                    borderBottomStyle: line.style, 
                    borderColor: line.color,
                    marginTop: `${line.marginTop}px`,
                    marginBottom: `${line.marginBottom}px`
                }} 
            />
        ))}
    </div>
  );

  const HeaderComponent = () => (
    <div className="mb-2">
        <div className="flex items-center gap-4 mb-2" style={{ fontFamily: settings.headerFontFamily }}>
        {settings.logoUrl && (
            <div className="flex-shrink-0" style={{ width: '80px' }}>
            <img src={settings.logoUrl} alt="Logo" className="w-full h-auto object-contain" />
            </div>
        )}
        <div className="flex-grow text-center leading-tight text-black" dangerouslySetInnerHTML={{ __html: processedHeader }} />
        </div>
        <HeaderLines />
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
    {/* Page 1: Letter */}
    <div 
      className="relative bg-white text-black box-border shadow-2xl transition-transform origin-top flex flex-col"
      style={{
        transform: `scale(${scale})`,
        ...pageStyle,
        fontFamily: settings.globalFontFamily,
        fontSize: `${settings.fontSize}pt`,
        color: '#000000',
      }}
    >
      {settings.showKop && <HeaderComponent />}

      <div className="content-body leading-relaxed text-black flex-grow" style={{ fontFamily: settings.contentFontFamily }} dangerouslySetInnerHTML={{ __html: processedContent }} />

      {/* Signatures */}
      {settings.showSignature && settings.signatures.length > 0 && (
        <div className="mt-8 w-full">
           <div className="grid grid-cols-2 gap-8">
             {settings.signatures.map((sig, idx) => {
                const total = settings.signatures.length;
                const isSingle = total === 1;
                const isOdd = total % 2 !== 0;
                const isLast = idx === total - 1;

                let wrapperClass = "text-center min-w-[200px] text-black ";
                
                if (isSingle) {
                    wrapperClass += "col-span-2 flex flex-col ";
                    if (sig.align === 'left') wrapperClass += "items-start text-left";
                    else if (sig.align === 'center') wrapperClass += "items-center text-center";
                    else wrapperClass += "items-end text-center"; // Default right
                } else if (isOdd && isLast) {
                    // Last item in an odd list (except single) is centered and spans full width
                    wrapperClass += "col-span-2 justify-self-center";
                } else {
                    // Standard grid item
                    wrapperClass += "justify-self-center";
                }

                return (
                    <div key={sig.id} className={wrapperClass}>
                        <p className="mb-1">{sig.label}</p>
                        {isLast && (
                             <p className="mb-2">{settings.signatureCity}, <span className="bg-yellow-100 px-1">{`{{ $tanggal }}`}</span></p>
                        )}
                        <div className="h-20 flex items-center justify-center my-2">
                            {sig.type === 'wet' ? <div className="h-full"></div> : <div className="border border-dashed border-gray-400 p-2 text-[10px] bg-gray-50 flex items-center justify-center w-20 h-20">QR Placeholder</div>}
                        </div>
                        <p className="font-bold underline mt-2">{sig.name}</p>
                        <p>{sig.title}</p>
                    </div>
                );
             })}
           </div>
        </div>
      )}

      {settings.showFooter && (
          <div className="mt-auto pt-8 border-t border-gray-100 text-xs text-center text-gray-500" dangerouslySetInnerHTML={{ __html: processedFooter }} />
      )}
      
      <div className="absolute top-4 right-4 bg-gray-200 text-gray-500 text-[10px] px-2 py-1 rounded opacity-50">Page 1</div>
    </div>

    {/* Page 2: Attachments */}
    {settings.hasAttachment && (
        <div 
            className="relative bg-white text-black box-border shadow-2xl transition-transform origin-top flex flex-col"
            style={{
                transform: `scale(${scale})`,
                ...pageStyle,
                fontFamily: settings.globalFontFamily,
                fontSize: `${settings.fontSize}pt`,
                color: '#000000',
            }}
        >
            <div className="absolute -top-6 left-0 text-gray-500 text-xs italic font-bold">-- Page Break --</div>
            
            {settings.attachmentShowKop && <HeaderComponent />}
            
            <h3 className="font-bold text-lg mb-4 underline">Lampiran</h3>
            <div 
                className="content-body leading-relaxed text-black flex-grow"
                style={{ fontFamily: settings.attachmentFontFamily }}
                dangerouslySetInnerHTML={{ __html: processedAttachment }}
            />

            {settings.showFooter && (
                <div className="mt-auto pt-8 border-t border-gray-100 text-xs text-center text-gray-500" dangerouslySetInnerHTML={{ __html: processedFooter }} />
            )}
            
            <div className="absolute top-4 right-4 bg-gray-200 text-gray-500 text-[10px] px-2 py-1 rounded opacity-50">Page 2+</div>
        </div>
    )}
    </div>
  );
};

export default TemplatePreview;
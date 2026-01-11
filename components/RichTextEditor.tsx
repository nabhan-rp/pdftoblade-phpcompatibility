import React, { useRef, useEffect, useState } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  defaultFontFamily: string;
  placeholder?: string;
  availableVariables?: { id: string; key: string; label: string }[];
  onAddVariable?: (key: string) => void;
  minHeight?: string;
}

const FONT_FAMILIES = [
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Calibri', value: 'Calibri, sans-serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
];

const LIST_STYLES = {
    unordered: [
        { label: '● Disc (Default)', value: 'disc' },
        { label: '○ Circle', value: 'circle' },
        { label: '■ Square', value: 'square' },
    ],
    ordered: [
        { label: '1, 2, 3 (Default)', value: 'decimal' },
        { label: 'a, b, c (Lower Alpha)', value: 'lower-alpha' },
        { label: 'A, B, C (Upper Alpha)', value: 'upper-alpha' },
        { label: 'i, ii, iii (Lower Roman)', value: 'lower-roman' },
        { label: 'I, II, III (Upper Roman)', value: 'upper-roman' },
    ]
};

const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
  content, 
  onChange, 
  defaultFontFamily, 
  placeholder, 
  availableVariables = [],
  onAddVariable,
  minHeight = '200px'
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showVarMenu, setShowVarMenu] = useState(false);
  const [showBulletMenu, setShowBulletMenu] = useState(false);
  const [showNumberMenu, setShowNumberMenu] = useState(false);
  const [customFontSize, setCustomFontSize] = useState('12');

  useEffect(() => {
    if (editorRef.current) {
        const currentHtml = editorRef.current.innerHTML;
        if (content !== currentHtml) {
             if (document.activeElement !== editorRef.current) {
                editorRef.current.innerHTML = content;
             } else {
                 if (content === '' && currentHtml !== '') {
                     editorRef.current.innerHTML = '';
                 }
             }
        }
    }
  }, [content]);

  // Handle click outside to close menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (editorRef.current && !editorRef.current.contains(event.target as Node)) {
             // Optional: logic to close text menus if needed, but primarily handled by onBlur/focus
        }
        // Close toolbar menus if clicking elsewhere
        const target = event.target as HTMLElement;
        if (!target.closest('.toolbar-menu-trigger')) {
            setShowVarMenu(false);
            setShowBulletMenu(false);
            setShowNumberMenu(false);
        }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      if (html !== content) {
          onChange(html);
      }
    }
  };

  const execCmd = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const applyListStyle = (command: string, styleType: string) => {
    // 1. Execute standard command to create list structure
    document.execCommand(command, false, undefined);

    // 2. Find the active list element and apply inline styles
    // This is CRITICAL because Tailwind CSS resets list-style to 'none' and padding to 0.
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        let node = selection.getRangeAt(0).commonAncestorContainer;
        
        // Traverse up to find the UL or OL
        while (node && node.nodeName !== 'UL' && node.nodeName !== 'OL' && node !== editorRef.current) {
            node = node.parentNode as Node;
        }

        if (node && (node.nodeName === 'UL' || node.nodeName === 'OL')) {
            const listElement = node as HTMLElement;
            // Apply style type (disc, decimal, etc)
            listElement.style.listStyleType = styleType;
            // Apply padding so bullets/numbers are visible inside the editor
            listElement.style.paddingLeft = '24px';
            listElement.style.marginLeft = '12px';
        }
    }

    editorRef.current?.focus();
    handleInput();
    setShowBulletMenu(false);
    setShowNumberMenu(false);
  };

  const insertTable = () => {
    const rowsInput = prompt("Jumlah Baris (Rows):", "3");
    if (rowsInput === null) return;
    const colsInput = prompt("Jumlah Kolom (Columns):", "3");
    if (colsInput === null) return;
    
    const rows = parseInt(rowsInput) || 3;
    const cols = parseInt(colsInput) || 3;

    if (rows > 0 && cols > 0) {
      let tableHtml = '<table style="width: 100%; border-collapse: collapse; margin: 10px 0;"><thead><tr>';
      
      // Header row
      for (let j = 0; j < cols; j++) {
         tableHtml += `<th style="border: 1px solid #000; padding: 5px; background: #f0f0f0;">Header ${j + 1}</th>`;
      }
      tableHtml += '</tr></thead><tbody>';

      // Body rows
      for (let i = 0; i < rows; i++) {
        tableHtml += '<tr>';
        for (let j = 0; j < cols; j++) {
           tableHtml += `<td style="border: 1px solid #000; padding: 5px;">Cell</td>`;
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</tbody></table><p><br></p>';
      
      document.execCommand('insertHTML', false, tableHtml);
      handleInput();
    }
  };

  const insertHr = () => {
      const hrHtml = '<hr style="border-top: 1px solid #000; margin: 15px 0; width: 100%;" /><p><br></p>';
      document.execCommand('insertHTML', false, hrHtml);
      handleInput();
  };

  const applyFontSize = () => {
    const size = customFontSize + 'pt';
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontSize = size;
      try {
         if (!range.collapsed) {
             range.surroundContents(span);
         } else {
             span.appendChild(document.createTextNode('\u200B'));
             range.insertNode(span);
             range.setStart(span, 1);
             range.setEnd(span, 1);
         }
      } catch (e) {
          document.execCommand('fontSize', false, '3');
      }
      selection.removeAllRanges();
      selection.addRange(range);
      handleInput();
    }
  };

  const handleFontFamily = (font: string) => {
    document.execCommand('fontName', false, font);
    handleInput();
  };

  const insertVariable = (key: string) => {
    const text = `{{ $${key} }}`;
    document.execCommand('insertText', false, text);
    setShowVarMenu(false);
    handleInput();
    if (onAddVariable) onAddVariable(key);
  };

  const promptNewVariable = () => {
    const name = prompt("Enter variable name (e.g. nomor_surat):");
    if (name) {
      const cleanName = name.replace(/[^a-zA-Z0-9_]/g, '');
      insertVariable(cleanName);
    }
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white flex flex-col shadow-sm w-full">
      {/* Classic Editor Toolbar */}
      <div className="bg-gray-100 border-b border-gray-300 p-1.5 flex flex-wrap gap-1 items-center sticky top-0 z-10">
        
        {/* Row 1: Formatting */}
        <div className="flex bg-white rounded border border-gray-300 mr-1 shadow-sm">
          <button onClick={() => execCmd('bold')} className="p-1.5 hover:bg-gray-200 text-gray-700" title="Bold"><b>B</b></button>
          <button onClick={() => execCmd('italic')} className="p-1.5 hover:bg-gray-200 text-gray-700" title="Italic"><i>I</i></button>
          <button onClick={() => execCmd('underline')} className="p-1.5 hover:bg-gray-200 text-gray-700" title="Underline"><u>U</u></button>
          <button onClick={() => execCmd('strikeThrough')} className="p-1.5 hover:bg-gray-200 text-gray-700" title="Strike"><s>S</s></button>
        </div>

        {/* Alignment */}
        <div className="flex bg-white rounded border border-gray-300 mr-1 shadow-sm">
            <button onClick={() => execCmd('justifyLeft')} className="p-1.5 hover:bg-gray-200 text-gray-600" title="Left"><span className="block w-3 h-0.5 bg-current mb-0.5"></span><span className="block w-2 h-0.5 bg-current mb-0.5"></span><span className="block w-3 h-0.5 bg-current"></span></button>
            <button onClick={() => execCmd('justifyCenter')} className="p-1.5 hover:bg-gray-200 text-gray-600" title="Center"><span className="block w-3 h-0.5 bg-current mb-0.5 mx-auto"></span><span className="block w-2 h-0.5 bg-current mb-0.5 mx-auto"></span><span className="block w-3 h-0.5 bg-current mx-auto"></span></button>
            <button onClick={() => execCmd('justifyRight')} className="p-1.5 hover:bg-gray-200 text-gray-600" title="Right"><span className="block w-3 h-0.5 bg-current mb-0.5 ml-auto"></span><span className="block w-2 h-0.5 bg-current mb-0.5 ml-auto"></span><span className="block w-3 h-0.5 bg-current ml-auto"></span></button>
            <button onClick={() => execCmd('justifyFull')} className="p-1.5 hover:bg-gray-200 text-gray-600" title="Justify"><span className="block w-3 h-0.5 bg-current mb-0.5"></span><span className="block w-3 h-0.5 bg-current mb-0.5"></span><span className="block w-3 h-0.5 bg-current"></span></button>
        </div>

        {/* Lists & Indent */}
        <div className="flex bg-white rounded border border-gray-300 mr-1 shadow-sm items-center">
           {/* Bullet Dropdown */}
           <div className="relative toolbar-menu-trigger">
                <button onClick={() => { setShowBulletMenu(!showBulletMenu); setShowNumberMenu(false); }} className="p-1.5 hover:bg-gray-200 flex items-center gap-0.5 text-gray-900" title="Bullet List">
                    <span>•</span> <span className="text-[10px] opacity-60">▼</span>
                </button>
                {showBulletMenu && (
                    <div className="absolute top-full left-0 mt-1 w-32 bg-white border border-gray-200 rounded shadow-lg z-20">
                        {LIST_STYLES.unordered.map((style) => (
                            <button 
                                key={style.value}
                                onClick={() => applyListStyle('insertUnorderedList', style.value)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 block text-gray-900"
                            >
                                {style.label}
                            </button>
                        ))}
                    </div>
                )}
           </div>

           {/* Number Dropdown */}
           <div className="relative toolbar-menu-trigger">
                <button onClick={() => { setShowNumberMenu(!showNumberMenu); setShowBulletMenu(false); }} className="p-1.5 hover:bg-gray-200 flex items-center gap-0.5 text-gray-900" title="Numbered List">
                    <span>1.</span> <span className="text-[10px] opacity-60">▼</span>
                </button>
                {showNumberMenu && (
                    <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded shadow-lg z-20">
                        {LIST_STYLES.ordered.map((style) => (
                            <button 
                                key={style.value}
                                onClick={() => applyListStyle('insertOrderedList', style.value)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 block text-gray-900"
                            >
                                {style.label}
                            </button>
                        ))}
                    </div>
                )}
           </div>
           
           <div className="w-[1px] h-4 bg-gray-200 mx-0.5"></div>
           
           <button onClick={() => execCmd('outdent')} className="p-1.5 hover:bg-gray-200 text-gray-900" title="Outdent">←|</button>
           <button onClick={() => execCmd('indent')} className="p-1.5 hover:bg-gray-200 text-gray-900" title="Indent">|→</button>
        </div>

        {/* Table & HR */}
        <div className="flex bg-white rounded border border-gray-300 mr-1 shadow-sm">
            <button onClick={insertTable} className="p-1.5 hover:bg-gray-200 text-xs font-bold px-2 text-gray-900" title="Insert Table">Table</button>
            <button onClick={insertHr} className="p-1.5 hover:bg-gray-200 text-xs px-2 font-mono text-gray-900" title="Horizontal Line">HR</button>
        </div>

        <div className="w-full h-0 basis-full lg:hidden"></div> {/* Break row on small screens */}

        {/* Fonts */}
        <select onChange={(e) => handleFontFamily(e.target.value)} className="text-xs border border-gray-300 rounded h-8 px-1 mr-1 bg-white text-gray-900" defaultValue="">
            <option value="" disabled>Font Family</option>
            {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>

        {/* Custom Font Size Input */}
        <div className="flex items-center gap-1 bg-white rounded border border-gray-300 h-8 px-1 mr-1">
            <input 
                type="number" 
                value={customFontSize}
                onChange={(e) => setCustomFontSize(e.target.value)}
                onBlur={applyFontSize}
                onKeyDown={(e) => e.key === 'Enter' && applyFontSize()}
                className="w-10 text-xs text-center outline-none bg-transparent text-gray-900"
                title="Font Size (pt)"
            />
            <span className="text-xs text-gray-500">pt</span>
        </div>

        {/* Color Picker */}
        <div className="flex items-center mr-1" title="Text Color">
            <label className="cursor-pointer border border-gray-300 rounded p-1 hover:bg-gray-200 flex items-center justify-center h-8 w-8 bg-white relative">
                <span className="text-xs font-bold text-gray-600">A</span>
                <input 
                    type="color" 
                    onChange={(e) => execCmd('foreColor', e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                />
            </label>
        </div>

        {/* Variables */}
        <div className="relative ml-auto toolbar-menu-trigger">
            <button 
                onClick={() => setShowVarMenu(!showVarMenu)}
                className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-indigo-700 shadow-sm"
            >
                <span>{`{ }`}</span> Add Variable
            </button>
            
            {showVarMenu && (
                <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-gray-200 rounded shadow-xl z-50 max-h-60 overflow-y-auto">
                    <button onClick={promptNewVariable} className="w-full text-left px-3 py-2 text-xs text-indigo-600 font-bold hover:bg-gray-50 border-b border-gray-100">+ New Variable...</button>
                    {availableVariables.map(v => (
                        <button key={v.id} onClick={() => insertVariable(v.key)} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex justify-between group">
                            <span>${v.key}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* Editor Content Area */}
      <div 
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="flex-1 p-8 outline-none prose prose-sm max-w-none focus:bg-white text-gray-900 text-left cursor-text overflow-auto"
        style={{ 
            fontFamily: defaultFontFamily,
            minHeight,
            resize: 'vertical',
            textAlign: 'left', 
            width: '100%' 
        }}
      />
    </div>
  );
};

export default RichTextEditor;
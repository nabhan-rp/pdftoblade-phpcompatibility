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
  const savedRange = useRef<Range | null>(null); // Track selection
  const [showVarMenu, setShowVarMenu] = useState(false);
  const [showBulletMenu, setShowBulletMenu] = useState(false);
  const [showNumberMenu, setShowNumberMenu] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [customFontSize, setCustomFontSize] = useState('12');
  const [customLineHeight, setCustomLineHeight] = useState('1.5');

  useEffect(() => {
    if (editorRef.current) {
        const currentHtml = editorRef.current.innerHTML;
        if (content !== currentHtml) {
             if (document.activeElement !== editorRef.current) {
                editorRef.current.innerHTML = content;
             } else if (content === '' && currentHtml !== '') {
                 editorRef.current.innerHTML = '';
             }
        }
    }
  }, [content]);

  // Handle click outside to close menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest('.toolbar-menu-trigger')) {
            setShowVarMenu(false);
            setShowBulletMenu(false);
            setShowNumberMenu(false);
            setShowTableMenu(false);
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

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0);
    }
  };

  const restoreSelection = () => {
      const sel = window.getSelection();
      if (sel && savedRange.current) {
          sel.removeAllRanges();
          sel.addRange(savedRange.current);
      } else {
          editorRef.current?.focus();
      }
  };

  const execCmd = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const applyListStyle = (command: string, styleType: string) => {
    restoreSelection();
    document.execCommand(command, false, undefined);
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        let node = selection.getRangeAt(0).commonAncestorContainer;
        while (node && node.nodeName !== 'UL' && node.nodeName !== 'OL' && node !== editorRef.current) {
            node = node.parentNode as Node;
        }
        if (node && (node.nodeName === 'UL' || node.nodeName === 'OL')) {
            const listElement = node as HTMLElement;
            listElement.style.listStyleType = styleType;
            listElement.style.paddingLeft = '24px';
            listElement.style.marginLeft = '12px';
        }
    }
    editorRef.current?.focus();
    handleInput();
    setShowBulletMenu(false);
    setShowNumberMenu(false);
  };

  // --- FEATURE: TABLE OPERATIONS ---
  const insertTable = () => {
    const rowsInput = prompt("Rows:", "3");
    if (rowsInput === null) return;
    const colsInput = prompt("Columns:", "3");
    if (colsInput === null) return;
    
    const rows = parseInt(rowsInput) || 3;
    const cols = parseInt(colsInput) || 3;

    if (rows > 0 && cols > 0) {
      restoreSelection();
      let tableHtml = '<table style="width: 100%; border-collapse: collapse; margin: 10px 0; border: 1px solid black;"><thead><tr>';
      for (let j = 0; j < cols; j++) {
         tableHtml += `<th style="border: 1px solid black; padding: 5px; background: #f0f0f0;">Head ${j + 1}</th>`;
      }
      tableHtml += '</tr></thead><tbody>';
      for (let i = 0; i < rows; i++) {
        tableHtml += '<tr>';
        for (let j = 0; j < cols; j++) {
           tableHtml += `<td style="border: 1px solid black; padding: 5px;">Cell</td>`;
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</tbody></table><p><br></p>';
      
      document.execCommand('insertHTML', false, tableHtml);
      handleInput();
    }
  };

  const getParentTable = (): HTMLTableElement | null => {
      restoreSelection();
      const selection = window.getSelection();
      if (!selection?.rangeCount) return null;
      
      let node = selection.getRangeAt(0).commonAncestorContainer;
      if (node.nodeType === 3) node = node.parentNode as Node;

      while(node && node !== editorRef.current) {
          if (node.nodeName === 'TABLE') return node as HTMLTableElement;
          node = node.parentNode as Node;
      }
      return null;
  };

  const applyTableBorder = (type: 'all' | 'none' | 'outer') => {
      const table = getParentTable();
      if (!table) {
          alert("Please place cursor inside a table first.");
          return;
      }

      const cells = table.querySelectorAll('td, th');

      if (type === 'none') {
          table.style.border = 'none';
          cells.forEach(c => (c as HTMLElement).style.border = 'none');
      } else if (type === 'all') {
          table.style.border = '1px solid black';
          table.style.borderCollapse = 'collapse';
          cells.forEach(c => (c as HTMLElement).style.border = '1px solid black');
      } else if (type === 'outer') {
          table.style.border = '1px solid black';
          table.style.borderCollapse = 'collapse';
          cells.forEach(c => (c as HTMLElement).style.border = 'none');
      }
      handleInput();
      setShowTableMenu(false);
  };

  const applyCellBackground = (color: string) => {
      restoreSelection();
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;

      let node = selection.getRangeAt(0).commonAncestorContainer;
      if (node.nodeType === 3) node = node.parentNode as Node;
      
      // Find closest Cell
      while(node && node !== editorRef.current) {
          if (node.nodeName === 'TD' || node.nodeName === 'TH') {
              (node as HTMLElement).style.backgroundColor = color;
              break;
          }
          if (node.nodeName === 'TABLE') break; // Stop at table if no cell found
          node = node.parentNode as Node;
      }
      handleInput();
  };
  // --------------------------------

  const insertHr = () => {
      restoreSelection();
      const hrHtml = '<hr style="border-top: 1px solid #000; margin: 15px 0; width: 100%;" /><p><br></p>';
      document.execCommand('insertHTML', false, hrHtml);
      handleInput();
  };

  // --- FEATURE: FONT SIZE & LINE HEIGHT ---
  const applyFontSize = () => {
    if (!customFontSize || isNaN(Number(customFontSize))) return;
    restoreSelection();
    const size = customFontSize + 'pt';
    const uuid = "fs-" + Date.now();
    document.execCommand('fontName', false, uuid);
    if (editorRef.current) {
        const fontTags = editorRef.current.querySelectorAll(`font[face="${uuid}"]`);
        fontTags.forEach(el => {
            const span = document.createElement('span');
            span.style.fontSize = size;
            span.innerHTML = el.innerHTML;
            el.parentNode?.replaceChild(span, el);
        });
    }
    handleInput();
  };

  const applyLineHeight = () => {
      if (!customLineHeight || isNaN(Number(customLineHeight))) return;
      restoreSelection();
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          let node: Node | null = range.commonAncestorContainer;
          if (node.nodeType === 3) node = node.parentNode;
          
          while (node && node !== editorRef.current) {
              const element = node as HTMLElement;
              const display = window.getComputedStyle(element).display;
              // Block elements or table cells
              if (display === 'block' || display === 'list-item' || display === 'table-cell') {
                  element.style.lineHeight = customLineHeight;
                  break; 
              }
              node = node.parentNode;
          }
      }
      handleInput();
  };
  // --------------------------------

  const handleFontFamily = (font: string) => {
    restoreSelection();
    document.execCommand('fontName', false, font);
    handleInput();
  };

  const insertVariable = (key: string) => {
    restoreSelection();
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
      {/* Toolbar */}
      <div className="bg-gray-100 border-b border-gray-300 p-1.5 flex flex-wrap gap-1 items-center sticky top-0 z-10">
        
        {/* Formatting */}
        <div className="flex bg-white rounded border border-gray-300 mr-1 shadow-sm">
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('bold')} className="p-1.5 hover:bg-gray-200 text-gray-700 font-bold" title="Bold">B</button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('italic')} className="p-1.5 hover:bg-gray-200 text-gray-700 italic" title="Italic">I</button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('underline')} className="p-1.5 hover:bg-gray-200 text-gray-700 underline" title="Underline">U</button>
        </div>

        {/* Alignment */}
        <div className="flex bg-white rounded border border-gray-300 mr-1 shadow-sm">
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('justifyLeft')} className="p-1.5 hover:bg-gray-200 text-gray-600" title="Left">L</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('justifyCenter')} className="p-1.5 hover:bg-gray-200 text-gray-600" title="Center">C</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('justifyRight')} className="p-1.5 hover:bg-gray-200 text-gray-600" title="Right">R</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('justifyFull')} className="p-1.5 hover:bg-gray-200 text-gray-600" title="Justify">J</button>
        </div>

        {/* Lists */}
        <div className="flex bg-white rounded border border-gray-300 mr-1 shadow-sm items-center">
           <div className="relative toolbar-menu-trigger">
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setShowBulletMenu(!showBulletMenu); setShowNumberMenu(false); }} className="p-1.5 hover:bg-gray-200 text-gray-900 flex items-center gap-0.5">●<span className="text-[9px]">▼</span></button>
                {showBulletMenu && (
                    <div className="absolute top-full left-0 mt-1 w-32 bg-white border border-gray-200 rounded shadow-lg z-20">
                        {LIST_STYLES.unordered.map(s => <button key={s.value} onClick={() => applyListStyle('insertUnorderedList', s.value)} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 block text-gray-900">{s.label}</button>)}
                    </div>
                )}
           </div>
           <div className="relative toolbar-menu-trigger">
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setShowNumberMenu(!showNumberMenu); setShowBulletMenu(false); }} className="p-1.5 hover:bg-gray-200 text-gray-900 flex items-center gap-0.5">1.<span className="text-[9px]">▼</span></button>
                {showNumberMenu && (
                    <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded shadow-lg z-20">
                        {LIST_STYLES.ordered.map(s => <button key={s.value} onClick={() => applyListStyle('insertOrderedList', s.value)} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 block text-gray-900">{s.label}</button>)}
                    </div>
                )}
           </div>
           <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('outdent')} className="p-1.5 hover:bg-gray-200 text-gray-900" title="Outdent">←|</button>
           <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('indent')} className="p-1.5 hover:bg-gray-200 text-gray-900" title="Indent">|→</button>
        </div>

        {/* Table & HR & Advanced Table Tools */}
        <div className="flex bg-white rounded border border-gray-300 mr-1 shadow-sm relative toolbar-menu-trigger">
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => setShowTableMenu(!showTableMenu)} className="p-1.5 hover:bg-gray-200 text-xs font-bold px-2 text-gray-900 flex items-center gap-1">
                Table <span className="text-[9px]">▼</span>
            </button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={insertHr} className="p-1.5 hover:bg-gray-200 text-xs px-2 font-mono text-gray-900" title="HR">HR</button>

            {showTableMenu && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded shadow-lg z-50 p-2 flex flex-col gap-2">
                    <button onClick={insertTable} className="text-left text-xs p-1 hover:bg-gray-100 rounded w-full font-bold">+ New Table</button>
                    <div className="border-t border-gray-100 my-1"></div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Table Borders</p>
                    <div className="flex gap-1">
                        <button onClick={() => applyTableBorder('all')} className="flex-1 text-[10px] border p-1 hover:bg-gray-50 text-center" title="All Borders">田 All</button>
                        <button onClick={() => applyTableBorder('outer')} className="flex-1 text-[10px] border p-1 hover:bg-gray-50 text-center" title="Outer Only">囗 Outer</button>
                        <button onClick={() => applyTableBorder('none')} className="flex-1 text-[10px] border p-1 hover:bg-gray-50 text-center" title="No Borders">None</button>
                    </div>
                    <div className="border-t border-gray-100 my-1"></div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Cell Background</p>
                    <div className="flex gap-1 items-center">
                         <input type="color" onChange={(e) => applyCellBackground(e.target.value)} className="w-full h-6 cursor-pointer" title="Pick Cell Color" />
                         <button onClick={() => applyCellBackground('transparent')} className="text-[10px] border px-2 py-1 hover:bg-gray-50">Clear</button>
                    </div>
                </div>
            )}
        </div>

        <div className="w-full h-0 basis-full lg:hidden"></div>

        {/* Fonts */}
        <select onChange={(e) => handleFontFamily(e.target.value)} className="text-xs border border-gray-300 rounded h-8 px-1 mr-1 bg-white text-gray-900" defaultValue="">
            <option value="" disabled>Font</option>
            {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>

        {/* Font Size */}
        <div className="flex items-center gap-1 bg-white rounded border border-gray-300 h-8 px-1 mr-1">
            <input 
                type="number" 
                value={customFontSize}
                onChange={(e) => setCustomFontSize(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFontSize()}
                className="w-10 text-xs text-center outline-none bg-transparent text-gray-900"
                title="Font Size (pt)"
            />
            <span className="text-xs text-gray-500">pt</span>
            <button onClick={applyFontSize} className="bg-gray-100 hover:bg-gray-200 text-xs px-2 h-full border-l border-gray-300">Set</button>
        </div>

        {/* Line Height */}
        <div className="flex items-center gap-1 bg-white rounded border border-gray-300 h-8 px-1 mr-1">
            <input 
                type="number" 
                step="0.1"
                value={customLineHeight}
                onChange={(e) => setCustomLineHeight(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyLineHeight()}
                className="w-10 text-xs text-center outline-none bg-transparent text-gray-900"
                title="Line Height (e.g. 1.5)"
            />
            <span className="text-xs text-gray-500">lh</span>
            <button onClick={applyLineHeight} className="bg-gray-100 hover:bg-gray-200 text-xs px-2 h-full border-l border-gray-300">Set</button>
        </div>

        {/* Text Color */}
        <div className="flex items-center mr-1" title="Text Color">
            <label className="cursor-pointer border border-gray-300 rounded p-1 hover:bg-gray-200 flex items-center justify-center h-8 w-8 bg-white relative">
                <span className="text-xs font-bold text-gray-600">A</span>
                <input type="color" onChange={(e) => execCmd('foreColor', e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
            </label>
        </div>

        {/* Variables */}
        <div className="relative ml-auto toolbar-menu-trigger">
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => setShowVarMenu(!showVarMenu)} className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-indigo-700 shadow-sm">
                <span>{`{ }`}</span> Add Variable
            </button>
            {showVarMenu && (
                <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-gray-200 rounded shadow-xl z-50 max-h-60 overflow-y-auto">
                    <button onClick={promptNewVariable} className="w-full text-left px-3 py-2 text-xs text-indigo-600 font-bold hover:bg-gray-50 border-b border-gray-100">+ New Variable...</button>
                    {availableVariables.map(v => (
                        <button key={v.id} onClick={() => insertVariable(v.key)} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex justify-between group"><span>${v.key}</span></button>
                    ))}
                </div>
            )}
        </div>
      </div>

      <div 
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={saveSelection}
        className="flex-1 p-8 outline-none prose prose-sm max-w-none focus:bg-white text-gray-900 text-left cursor-text overflow-auto"
        style={{ fontFamily: defaultFontFamily, minHeight, resize: 'vertical', textAlign: 'left', width: '100%' }}
      />
    </div>
  );
};

export default RichTextEditor;
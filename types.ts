export interface DocumentState {
  originalImage: string | null;
  isAnalyzing: boolean;
  isGeneratingLogo: boolean;
  analysisError: string | null;
}

export interface Signature {
  id: string;
  name: string;
  title: string;
  type: 'wet' | 'qr';
  label?: string; // e.g., "Mengetahui," or "Hormat Kami,"
  align?: 'left' | 'center' | 'right'; // Alignment preference
}

export interface HeaderLine {
  id: string;
  width: number; // in px
  style: 'solid' | 'double' | 'dashed' | 'dotted';
  color: string;
  marginTop: number;
  marginBottom: number;
}

export type PageSizePreset = 'A4' | 'Letter' | 'Legal' | 'F4' | 'Custom';
export type Unit = 'mm' | 'cm' | 'in';

export interface LetterSettings {
  // Page Setup
  pageSize: PageSizePreset;
  unit: Unit;
  pageWidth: number;
  pageHeight: number;
  
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  
  // Font Settings (Global & Section specific)
  globalFontFamily: string;
  headerFontFamily: string;
  contentFontFamily: string;
  attachmentFontFamily: string;
  fontSize: number;

  // Header (Kop Surat)
  showKop: boolean;
  headerContent: string;
  headerLines: HeaderLine[];
  logoUrl: string;
  logoAspectRatio: string;

  // Content
  rawHtmlContent: string;
  
  // Footer
  showFooter: boolean;
  footerContent: string;

  // Attachments (Lampiran)
  hasAttachment: boolean;
  attachmentShowKop: boolean;
  attachmentContent: string;

  // Variables (Dynamic Fields)
  variables: Variable[];

  // Signatures
  showSignature: boolean;
  signatureCity: string;
  signatures: Signature[];
}

export interface Variable {
  id: string;
  key: string;
  label: string;
  defaultValue: string;
}

export interface AnalysisResponse {
  institutionName: string;
  institutionAddress: string;
  htmlContent: string;
  attachmentContent?: string;
  detectedVariables: { key: string; label: string; defaultValue: string }[];
  signatureName?: string;
  signatureTitle?: string;
}

export enum TabView {
  UPLOAD = 'UPLOAD',
  EDITOR = 'EDITOR',
  PREVIEW = 'PREVIEW'
}
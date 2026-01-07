// Types for SuperDoc showcase

export interface Specialization {
  id: string;
  name: string;
  description: string;
  publicKey: string;
}

export interface DocumentHeading {
  level: number;
  text: string;
  pos: number;
  nodeSize: number;
}

export interface DocumentSummary {
  wordCount: number;
  sections: DocumentHeading[];
}

export interface DocumentState {
  createdByAI: boolean;
  userHasEdited: boolean;
}

export interface SuperDocInstance {
  activeEditor: any;
  setDocumentMode: (mode: 'editing' | 'suggesting' | 'viewing') => void;
  setTrackedChangesPreferences?: (options: { mode: string; enabled: boolean }) => void;
  export: (options: {
    exportType: string[];
    triggerDownload?: boolean;
    exportedName?: string;
  }) => Promise<Blob | void>;
  on: (event: string, callback: (...args: any[]) => void) => void;
  destroy: () => void;
  superdocStore?: {
    documents?: Array<{
      getPresentationEditor?: () => any;
    }>;
  };
}

// SuperDoc configuration options for npm package
export interface SuperDocConfig {
  selector: string;
  toolbar?: string;
  documentMode?: 'editing' | 'suggesting' | 'viewing';
  rulers?: boolean;
  role?: 'editor' | 'viewer';
  user?: {
    name: string;
    email: string;
  };
  permissionResolver?: (params: { permission: string }) => boolean | undefined;
  modules?: {
    comments?: Record<string, unknown>;
  };
  onReady?: (params: { superdoc: SuperDocInstance }) => void;
  onEditorCreate?: (params: { editor: any }) => void;
  onException?: (params: { error: Error }) => void;
}

// SuperDoc constructor type
export type SuperDocConstructor = new (config: SuperDocConfig) => SuperDocInstance;


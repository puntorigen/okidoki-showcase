// Types for document showcase

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

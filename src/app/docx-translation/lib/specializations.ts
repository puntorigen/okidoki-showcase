import { Specialization } from '../types';

// For the translation showcase, we use a single app with terminology-focused RAG
// Companies can upload glossaries and style guides as knowledge base content
export const specializations: Specialization[] = [
  {
    id: 'document-translation',
    name: 'Document Translation',
    description: 'Translate documents with industry-aware terminology',
    publicKey: 'pk_9e90fab19e5a64da2576238a33b2bfe2d9c18a592189ab77',
  },
  // Future: Add more translation specializations
  // {
  //   id: 'legal-translation',
  //   name: 'Legal Translation',
  //   description: 'Specialized legal document translation',
  //   publicKey: 'pk_YOUR_LEGAL_APP_KEY',
  // },
  // {
  //   id: 'medical-translation',
  //   name: 'Medical Translation',
  //   description: 'Healthcare and medical document translation',
  //   publicKey: 'pk_YOUR_MEDICAL_APP_KEY',
  // },
];

export const defaultSpecialization = specializations[0];

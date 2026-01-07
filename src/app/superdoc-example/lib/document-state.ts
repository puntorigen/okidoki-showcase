import { DocumentState } from '../types';

// Initial document state
export const initialDocumentState: DocumentState = {
  createdByAI: false,
  userHasEdited: false,
};

// Input types that indicate user edits (not programmatic)
export const userEditInputTypes = [
  'insertText',
  'deleteContentBackward',
  'deleteContentForward',
  'paste',
  'drop',
  'insertFromPaste',
  'insertFromDrop',
];

/**
 * Setup user edit detection on the editor
 */
export function setupUserEditDetection(
  editor: any,
  setDocumentState: React.Dispatch<React.SetStateAction<DocumentState>>
) {
  editor.on('update', ({ transaction }: { transaction: any }) => {
    if (!transaction.docChanged) return;

    const inputType = transaction.getMeta('inputType');
    
    if (userEditInputTypes.includes(inputType)) {
      setDocumentState(prev => ({ ...prev, userHasEdited: true }));
    }
  });
}


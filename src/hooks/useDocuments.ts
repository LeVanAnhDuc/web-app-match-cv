import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDocument,
  deleteDocument,
  documentQueryKey,
  fetchDocument,
  fetchSavedDocuments,
  renameDocument,
  savedDocumentsQueryKey,
  setDocumentParent
} from "#/requests/documents";
import type { DocumentKind } from "#/types/Documents";

/** GET /documents/:id — fetch rawText for the wizard's step 3 Review prefill. */
export function useDocument(id: string | null) {
  return useQuery({
    queryKey: documentQueryKey(id ?? ""),
    queryFn: () => fetchDocument(id as string),
    enabled: id !== null
  });
}

/** GET /documents?kind=..&saved=true — reuse list for the wizard's radio picker. */
export function useSavedDocuments(kind: DocumentKind) {
  return useQuery({
    queryKey: savedDocumentsQueryKey(kind),
    queryFn: () => fetchSavedDocuments(kind)
  });
}

/** POST /documents — upload/paste a new document (JD or CV). */
export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDocument,
    onSuccess: (data) => {
      if (data.isSaved) {
        void queryClient.invalidateQueries({
          queryKey: savedDocumentsQueryKey(data.kind)
        });
      }
    }
  });
}

/** PATCH /documents/:id — rename a saved document (library actions). */
export function useRenameDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      renameDocument(id, title),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    }
  });
}

/** PATCH /documents/:id/parent — declare or clear a lineage link (Goal 9). */
export function useSetDocumentParent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string | null }) =>
      setDocumentParent(id, parentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      // The comparison reads the chain this just changed.
      void queryClient.invalidateQueries({ queryKey: ["comparison"] });
    }
  });
}

/** DELETE /documents/:id — delete a saved document (409 when used by a match). */
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    }
  });
}

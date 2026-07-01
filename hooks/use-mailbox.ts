"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMailStore } from "@/store/mail-store";
import { buildGmailQuery } from "@/lib/gmail/query";
import { fetchJson } from "@/lib/fetch-json";
import type { EmailDetail, EmailListResponse } from "@/lib/types";

/**
 * Server-data hooks. The list query key derives from the SAME filter state
 * the store holds, so any filter change — typed by the user or made by the
 * assistant — automatically refetches the right Gmail query.
 */

export function useEmailList() {
  const filters = useMailStore((s) => s.filters);
  const q = buildGmailQuery(filters);
  return useQuery<EmailListResponse>({
    queryKey: ["messages", filters.folder, q],
    queryFn: () =>
      fetchJson(
        `/api/mail/messages?folder=${filters.folder}&q=${encodeURIComponent(q)}`
      ),
    staleTime: 10_000,
  });
}

export function useEmailDetail(id: string | null) {
  return useQuery<EmailDetail>({
    queryKey: ["message", id],
    queryFn: () => fetchJson(`/api/mail/messages/${id}`),
    enabled: id !== null,
    staleTime: 5 * 60_000,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      fetchJson(`/api/mail/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["messages"] }),
  });
}

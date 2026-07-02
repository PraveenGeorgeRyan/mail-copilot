"use client";

import { useMailStore } from "@/store/mail-store";
import { draftToPayload, useSendEmail } from "@/hooks/use-send";
import { SendIcon, XIcon } from "./icons";

/**
 * Gmail-style compose card, bottom-right. Fields are controlled by the
 * store draft — which is exactly what lets the AI assistant fill them
 * visibly (Day 2 adds the typewriter animation on top of the same state).
 */
export function ComposeModal() {
  const compose = useMailStore((s) => s.compose);
  const updateDraft = useMailStore((s) => s.updateDraft);
  const closeCompose = useMailStore((s) => s.closeCompose);
  const setComposeAnimating = useMailStore((s) => s.setComposeAnimating);
  const send = useSendEmail();

  if (!compose.open) return null;

  const onSend = () => {
    if (send.isPending || compose.animating) return;
    send.mutate(draftToPayload());
  };

  return (
    <div
      // Clicking anywhere in the card while the assistant is typing snaps
      // the animation to the finished draft — never fight the user.
      onMouseDownCapture={() => compose.animating && setComposeAnimating(false)}
      className="fixed bottom-4 right-4 z-40 flex w-[min(560px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="flex items-center justify-between bg-zinc-100 px-4 py-2.5 dark:bg-zinc-800">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          {compose.animating
            ? "Assistant is drafting…"
            : compose.replyTo
              ? "Reply"
              : "New message"}
        </span>
        <button
          onClick={closeCompose}
          className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700"
          title="Discard"
        >
          <XIcon />
        </button>
      </div>

      <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
        <Field
          label="To"
          value={compose.draft.to}
          onChange={(to) => updateDraft({ to })}
          placeholder="recipient@example.com"
          fieldName="to"
        />
        <Field
          label="Cc"
          value={compose.draft.cc}
          onChange={(cc) => updateDraft({ cc })}
          placeholder=""
          fieldName="cc"
        />
        <Field
          label="Subject"
          value={compose.draft.subject}
          onChange={(subject) => updateDraft({ subject })}
          placeholder="Subject"
          fieldName="subject"
        />
        <textarea
          value={compose.draft.body}
          onChange={(e) => updateDraft({ body: e.target.value })}
          placeholder="Write your message…"
          rows={10}
          data-compose-field="body"
          className="w-full resize-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-zinc-400"
        />
      </div>

      <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <button
          onClick={onSend}
          disabled={send.isPending || !compose.draft.to.trim()}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SendIcon />
          {send.isPending ? "Sending…" : "Send"}
        </button>
        {send.isError && (
          <span className="text-xs text-red-500">
            {send.error instanceof Error ? send.error.message : "Send failed"}
          </span>
        )}
        {compose.replyTo && (
          <span className="text-xs text-zinc-400">Replying in thread</span>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  fieldName,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  fieldName: string;
}) {
  return (
    <label className="flex items-center gap-3 px-4 py-2">
      <span className="w-12 shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-compose-field={fieldName}
        className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
      />
    </label>
  );
}

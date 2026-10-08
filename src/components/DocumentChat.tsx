"use client";

import { accessHeaders, readJson } from "@/lib/client";

import { useState, type FormEvent } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function DocumentChat({
  sourceText,
}: {
  sourceText: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = question.trim();
    if (!content || loading) return;

    setError("");

    const nextMessages: Message[] = [
      ...messages,
      { role: "user", content },
    ];

    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        signal: AbortSignal.timeout(55_000),
        headers: { "Content-Type": "application/json", ...accessHeaders() },
        body: JSON.stringify({
          sourceText,
          messages: nextMessages,
        }),
      });

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(result.error || "Chat request failed.");
      }

      setMessages([
        ...nextMessages,
        { role: "assistant", content: result.answer },
      ]);
      setQuestion("");
      if (result.incomplete) setError("The answer reached its length limit. Ask for a shorter answer or a follow-up.");
    } catch (error) {
      // Keep the question so the user can retry.
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Ask your document</h2>

        <button
          type="button"
          disabled={loading || messages.length === 0}
          onClick={() => {
            setMessages([]);
            setError("");
            setQuestion("");
          }}
          className="text-sm text-sky-300 disabled:opacity-40"
        >
          Clear chat
        </button>
      </div>

      <p className="text-sm text-slate-400">
        Answers use the extracted text. Verify important details against
        the original document.
      </p>

      <div
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        className="max-h-96 space-y-3 overflow-y-auto"
      >
        {messages.length === 0 && (
          <p className="text-sm text-slate-300">
            Try: “What are the main points?”
          </p>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`rounded-xl p-3 ${
              message.role === "user"
                ? "bg-slate-800"
                : "border border-sky-900 bg-sky-950"
            }`}
          >
            <p className="mb-1 text-xs font-semibold text-sky-300">
              {message.role === "user" ? "You" : "Assistant"}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm leading-6">
              {message.content}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={askQuestion} className="space-y-3">
        <label htmlFor="question" className="block text-sm font-medium">
          Your question
        </label>

        <textarea
          id="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={loading}
          maxLength={4000}
          rows={3}
          placeholder="Ask something about this document…"
          className="w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-sm text-white placeholder:text-slate-500"
        />

        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="w-full rounded-xl bg-sky-400 px-4 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Thinking…" : "Ask question"}
        </button>

        <p role="status" className="text-sm text-slate-300">
          {loading ? "Preparing an answer from your document." : ""}
        </p>

        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
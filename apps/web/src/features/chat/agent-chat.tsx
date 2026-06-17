"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  Brain,
  ChevronDown,
  ChevronRight,
  Code2,
  Database,
  Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAnalysisStore } from "@/stores/analysis-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AgentStep, AnalysisDetail } from "@/types/dataset";
import { AgentStepTrace } from "./agent-step-trace";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

const SUGGESTED_QUERIES = [
  "What are the main trends in this dataset?",
  "Detect anomalies and outliers.",
  "Which columns correlate most strongly?",
  "Give me an executive summary.",
  "What drives the most variance?",
];

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  steps?: AgentStep[];
  result?: AnalysisDetail["result"];
  timestamp: Date;
}

export function AgentChat({ datasetId }: { datasetId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const { isAnalysisRunning, liveSteps, setIsRunning, addLiveStep, clearLiveSteps, setWsConnected } =
    useAnalysisStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveSteps]);

  const connect = (): WebSocket => {
    const socket = new WebSocket(`${WS_URL}/ws/analysis/${datasetId}`);
    socket.onopen = () => setWsConnected(true);
    socket.onclose = () => {
      setWsConnected(false);
      setWs(null);
      // Only clear running state if the server closed unexpectedly (no completed/error event)
      useAnalysisStore.getState().setIsRunning(false);
      // Show an error if we were mid-analysis when the connection dropped
      const { liveSteps: steps } = useAnalysisStore.getState();
      if (steps.length > 0) {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "system",
            content: "Connection lost. The analysis may be incomplete.",
            timestamp: new Date(),
          },
        ]);
        useAnalysisStore.getState().clearLiveSteps();
      }
    };
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.event === "step") {
        addLiveStep(msg.data as AgentStep);
      } else if (msg.event === "completed") {
        // Read steps directly from store at event time to avoid stale closure
        const currentSteps = useAnalysisStore.getState().liveSteps;
        setIsRunning(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: msg.data.summary ?? "Analysis complete.",
            steps: [...currentSteps],
            timestamp: new Date(),
          },
        ]);
        clearLiveSteps();
      } else if (msg.event === "error") {
        setIsRunning(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "system",
            content: `Error: ${msg.data.message}`,
            timestamp: new Date(),
          },
        ]);
        clearLiveSteps();
      }
    };
    return socket;
  };

  const sendMessage = async (query: string) => {
    if (!query.trim() || isAnalysisRunning) return;
    const trimmed = query.trim();
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", content: trimmed, timestamp: new Date() },
    ]);
    clearLiveSteps();
    setIsRunning(true);

    let socket = ws;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      socket = connect();
      setWs(socket);
      try {
        await new Promise<void>((resolve, reject) => {
          socket!.addEventListener("open", () => resolve(), { once: true });
          socket!.addEventListener("error", () => reject(new Error("WebSocket connection failed")), { once: true });
        });
      } catch {
        setIsRunning(false);
        setWs(null);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "system",
            content: "Could not connect to the analysis server. Please try again.",
            timestamp: new Date(),
          },
        ]);
        return;
      }
    }
    socket.send(JSON.stringify({ query: trimmed, type: "full_pipeline" }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full pb-16 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 mb-5">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <p className="text-[15px] font-semibold text-foreground">Ask anything about your data</p>
            <p className="mt-1.5 text-[13px] text-muted-foreground max-w-sm">
              The AI analyst inspects your schema, writes SQL, and synthesises evidence-backed findings.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-md">
              {SUGGESTED_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isAnalysisRunning && liveSteps.length > 0 && (
          <div className="space-y-1.5">
            <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              {liveSteps.length} steps completed
            </p>
            <AnimatePresence>
              {liveSteps.slice(-3).map((step, i) => (
                <LiveStepPill key={i} step={step} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {isAnalysisRunning && liveSteps.length === 0 && <ThinkingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card/50 px-4 py-3.5 backdrop-blur-sm">
        <div className="flex items-end gap-2.5 rounded-xl border border-border bg-background px-3.5 py-2.5 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about trends, anomalies, correlations…"
            className="min-h-[36px] max-h-[120px] flex-1 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-[13.5px]"
            rows={1}
            disabled={isAnalysisRunning}
          />
          <Button
            size="icon"
            className="h-7 w-7 flex-shrink-0 rounded-lg"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isAnalysisRunning}
          >
            {isAnalysisRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
          AI may make mistakes — verify important findings independently.
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const [stepsExpanded, setStepsExpanded] = useState(false);

  if (message.role === "system") {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2 text-[12.5px] text-destructive">
        {message.content}
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-[13.5px] text-primary-foreground leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 mt-0.5">
        <Brain className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="prose prose-sm dark:prose-invert max-w-none text-[13.5px]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>

        {message.steps && message.steps.length > 0 && (
          <div>
            <button
              onClick={() => setStepsExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {stepsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {message.steps.length} reasoning steps
              {message.steps.filter((s) => s.tool_name === "execute_sql").length > 0 && (
                <span className="text-muted-foreground/50">
                  · {message.steps.filter((s) => s.tool_name === "execute_sql").length} SQL
                </span>
              )}
            </button>

            <AnimatePresence>
              {stepsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 space-y-1.5">
                    {message.steps.map((step, i) => (
                      <AgentStepTrace key={i} step={step} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const label =
    elapsed < 10  ? "Connecting…" :
    elapsed < 30  ? "Thinking…" :
    elapsed < 90  ? "Inspecting schema…" :
                    "Running queries…";

  return (
    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
      <span>{label}</span>
      {elapsed >= 10 && <span className="ml-auto tabular-nums text-muted-foreground/40">{elapsed}s</span>}
    </div>
  );
}

function LiveStepPill({ step }: { step: AgentStep }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-1.5 text-[11.5px] text-muted-foreground"
    >
      {step.tool_name === "execute_sql" ? (
        <Code2 className="h-3 w-3 text-blue-500" />
      ) : step.tool_name === "inspect_schema" ? (
        <Database className="h-3 w-3 text-violet-500" />
      ) : (
        <Brain className="h-3 w-3 text-primary" />
      )}
      <span className="font-mono">{step.tool_name ?? step.action}</span>
      {step.tool_name === "execute_sql" && step.sql_executions?.[0] && (
        <span className="ml-auto text-muted-foreground/50">
          {step.sql_executions[0].row_count} rows
        </span>
      )}
    </motion.div>
  );
}

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
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAnalysisStore } from "@/stores/analysis-store";
import { useDatasetStore } from "@/stores/dataset-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDuration } from "@/lib/utils";
import type { AgentStep, AnalysisDetail } from "@/types/dataset";
import { SQLResultTable } from "./sql-result-table";
import { AgentStepTrace } from "./agent-step-trace";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

const SUGGESTED_QUERIES = [
  "What are the main trends and patterns in this dataset?",
  "Are there any anomalies or unusual values I should know about?",
  "Which columns have the strongest correlations?",
  "Give me an executive summary of the key insights.",
  "Identify the top drivers of variance in the data.",
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
    };
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.event === "step") {
        addLiveStep(msg.data as AgentStep);
      } else if (msg.event === "completed") {
        setIsRunning(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: msg.data.summary ?? "Analysis complete.",
            steps: [...liveSteps],
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
      await new Promise<void>((resolve) => {
        socket!.addEventListener("open", () => resolve(), { once: true });
      });
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
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <Brain className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground">Ask anything about your data</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              The AI analyst will inspect your schema, write SQL queries, and synthesize evidence-backed insights.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-lg">
              {SUGGESTED_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors text-left"
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

        {/* Live reasoning trace */}
        {isAnalysisRunning && liveSteps.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Analyzing... {liveSteps.length} steps completed</span>
            </div>
            <AnimatePresence>
              {liveSteps.slice(-3).map((step, i) => (
                <LiveStepIndicator key={i} step={step} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {isAnalysisRunning && liveSteps.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span>Connecting to analysis engine...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card/80 px-4 py-3 backdrop-blur-sm">
        <div className="relative flex items-end gap-2 rounded-lg border border-border bg-background p-3 focus-within:ring-1 focus-within:ring-ring">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about trends, anomalies, forecasts, or run a custom SQL query..."
            className="min-h-[40px] max-h-[120px] flex-1 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-sm"
            rows={1}
            disabled={isAnalysisRunning}
          />
          <Button
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isAnalysisRunning}
          >
            {isAnalysisRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/60">
          AI analyst may make mistakes. Verify important findings with your own analysis.
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const [stepsExpanded, setStepsExpanded] = useState(false);

  if (message.role === "system") {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {message.content}
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 mt-0.5">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {/* Main response */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>

        {/* Reasoning trace toggle */}
        {message.steps && message.steps.length > 0 && (
          <div>
            <button
              onClick={() => setStepsExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {stepsExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <Brain className="h-3.5 w-3.5" />
              {message.steps.length} reasoning steps
              {message.steps.filter((s) => s.tool_name === "execute_sql").length > 0 && (
                <span className="text-muted-foreground/60">
                  · {message.steps.filter((s) => s.tool_name === "execute_sql").length} SQL queries
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
                  <div className="mt-2 space-y-2">
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

function LiveStepIndicator({ step }: { step: AgentStep }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground"
    >
      {step.tool_name === "execute_sql" ? (
        <Code2 className="h-3.5 w-3.5 text-blue-500" />
      ) : step.tool_name === "inspect_schema" ? (
        <Database className="h-3.5 w-3.5 text-purple-500" />
      ) : (
        <Brain className="h-3.5 w-3.5 text-primary" />
      )}
      <span className="font-mono">
        {step.tool_name ?? step.action}
      </span>
      {step.tool_name === "execute_sql" && step.sql_executions?.[0] && (
        <span className="ml-auto text-muted-foreground/60">
          {step.sql_executions[0].row_count} rows · {step.sql_executions[0].execution_time_ms.toFixed(0)}ms
        </span>
      )}
    </motion.div>
  );
}

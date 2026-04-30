"use client";

import React, { useState } from "react";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChatbotPanel } from "./ChatbotPanel";

export function ChatbotButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full bg-gradient-to-br from-[#6D28D9] to-[#8B5CF6] text-white shadow-[0_8px_24px_-4px_rgba(139,92,246,0.4)] hover:scale-105 transition-all z-50",
          isOpen && "hidden"
        )}
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
        <span className="sr-only">Open chat</span>
      </Button>

      {/* Chat Panel Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-end p-4 sm:p-6">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/25 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="relative w-full sm:w-[380px] sm:h-[520px] h-[70vh] max-w-[calc(100%-2rem)]">
            <ChatbotPanel onClose={() => setIsOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
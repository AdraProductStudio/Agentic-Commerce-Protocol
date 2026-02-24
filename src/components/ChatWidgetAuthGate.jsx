"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import ChatWidget from "./ChatWidget";

const API_VERSION = process.env.NEXT_PUBLIC_ACP_API_VERSION || "2026-01-30";

export default function ChatWidgetAuthGate() {
  const pathname = usePathname();
  const isHomeRoute = pathname?.startsWith("/home");
  const [canShowChat, setCanShowChat] = useState(false);
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    if (!isHomeRoute) {
      setCanShowChat(false);
      setCheckedAuth(true);
      return;
    }

    let mounted = true;

    async function verifyToken() {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        if (mounted) {
          setCanShowChat(false);
          setCheckedAuth(true);
        }
        return;
      }

      try {
        const res = await fetch("/api/auth/payload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "API-Version": API_VERSION,
          },
          body: JSON.stringify({}),
        });

        if (!mounted) return;

        if (res.ok) {
          setCanShowChat(true);
        } else {
          localStorage.removeItem("auth_token");
          setCanShowChat(false);
        }
      } catch {
        if (!mounted) return;
        setCanShowChat(false);
      } finally {
        if (mounted) {
          setCheckedAuth(true);
        }
      }
    }

    verifyToken();

    return () => {
      mounted = false;
    };
  }, [isHomeRoute]);

  if (!isHomeRoute || !checkedAuth || !canShowChat) {
    return null;
  }

  return <ChatWidget />;
}

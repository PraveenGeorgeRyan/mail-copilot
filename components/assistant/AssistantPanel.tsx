"use client";

import { CopilotSidebar } from "@copilotkit/react-core/v2";
import { AssistantTools } from "./AssistantTools";
import { AssistantContext } from "./AssistantContext";

/**
 * The assistant panel: CopilotKit's prebuilt sidebar chat plus our tool and
 * context registrations. Mounting this component is what gives the LLM its
 * levers (tools) and eyes (context) — unmount it and the AI can do nothing.
 */
export function AssistantPanel({
  userEmail,
  userName,
}: {
  userEmail: string;
  userName: string;
}) {
  return (
    <>
      <AssistantTools />
      <AssistantContext userEmail={userEmail} userName={userName} />
      <CopilotSidebar defaultOpen width={380} />
    </>
  );
}

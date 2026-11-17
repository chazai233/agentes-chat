import { type DirectMessage, keys, useApi } from "@agenteschat/client";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { router } from "@/ui/navigation";
import { requestComposerText } from "../chat/composer-request";
import { chatHref } from "../links/logic";
import { useErrorToast, useOrgId } from "../shared/hooks";
import { closeSheetsAndOpen } from "./parts";

/**
 * The direct conversation with them that the app already lists, if any: it opens at the tap, with no question to the
 * server first (which, on a slow connection, left the button doing nothing for seconds).
 */
export function knownDmChannel(
  qc: QueryClient,
  orgId: string,
  target: { agentId: string } | { userId: string },
): string | null {
  const type = "agentId" in target ? "agent" : "person";
  const id = "agentId" in target ? target.agentId : target.userId;
  const dms = qc.getQueryData<DirectMessage[]>(keys.dms(orgId)) ?? [];
  return dms.find((d) => d.with.type === type && d.with.id === id)?.channelId ?? null;
}

/**
 * Opens (or creates) the direct conversation with an agent or a person, closing the sheets on the way. `compose`: the
 * conversation opens ready to type (its composer focused), with `text` in it when given. `replace`: the screen it is opened from gives way to it
 * ("New", pushed over the tabs: back from the conversation goes to the tabs, with no pop and push between).
 */
export function useOpenDm() {
  const api = useApi();
  const orgId = useOrgId();
  const qc = useQueryClient();
  const failed = useErrorToast();
  return useCallback(
    (
      target: { agentId: string } | { userId: string },
      how: { compose?: boolean; text?: string; replace?: boolean } = {},
    ) => {
      const go = (channelId: string) => {
        if (how.compose) requestComposerText(channelId, how.text ?? "");
        if (how.replace) router.replace(chatHref(channelId));
        else closeSheetsAndOpen(chatHref(channelId));
      };
      const known = knownDmChannel(qc, orgId, target);
      if (known) {
        go(known);
        return Promise.resolve();
      }
      return api.dms
        .open(orgId, target)
        .then(({ channelId }) => {
          void qc.invalidateQueries({ queryKey: keys.dms(orgId) });
          go(channelId);
        })
        .catch(failed);
    },
    [api, orgId, qc, failed],
  );
}

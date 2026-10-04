import { useNavigate, useSearch } from "@tanstack/react-router";
import { App } from "antd";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFetchMatchRun } from "#/hooks/useMatch";
import { ApiError } from "#/libs/api";
import { useWizardStore } from "#/stores";

// `/wizard?runId=` is where "Sign in to keep it" comes back to. Signing in is
// a full-page redirect, so the store is empty here: read the run, land on step
// 4 with its document pair, then drop `runId` so a reload or Start over does
// not reopen it. Runs in an effect only — the server render shows the
// skeleton the shell picks for a pending reopen, never a guessed step.
const OpenRunFromUrl = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { runId: searchRunId } = useSearch({ from: "/_app/wizard" });
  const storeRunId = useWizardStore((s) => s.runId);
  const openRun = useWizardStore((s) => s.openRun);
  const reset = useWizardStore((s) => s.reset);
  const fetchRun = useFetchMatchRun();
  const handled = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!searchRunId || handled.current === searchRunId) return;
    handled.current = searchRunId;
    const dropRunId = () =>
      void navigate({
        to: ".",
        search: (prev) => ({ ...prev, runId: undefined }),
        replace: true
      });
    if (searchRunId === storeRunId) {
      dropRunId();
      return;
    }
    const reopen = async (id: string) => {
      try {
        const run = await fetchRun(id);
        openRun({
          runId: run.id,
          cvDocId: run.cvDocumentId,
          jdDocId: run.jdDocumentId
        });
      } catch (error) {
        // 404: an expired guest run · 401: someone else's run, or signed out.
        reset();
        message.error(
          error instanceof ApiError && [401, 404].includes(error.status)
            ? t("result.missingRun")
            : t("err.matchFailed")
        );
      } finally {
        dropRunId();
      }
    };
    void reopen(searchRunId);
  }, [searchRunId, storeRunId, fetchRun, openRun, reset, navigate, message, t]);

  return null;
};

export default OpenRunFromUrl;

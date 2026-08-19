import { useNavigate } from "@tanstack/react-router";
import { Button, Table, Tag } from "antd";
import { Inbox, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TableColumnsType } from "antd";
import SectionCard from "#/components/SectionCard";
import { useMatchHistory } from "#/hooks/useMatch";
import { useWizardStore } from "#/stores";
import type { MatchSummaryDto } from "#/types/Matching";

const RECENT_LIMIT = 5;

function scoreBand(score: number): "success" | "warning" | "error" {
  if (score >= 75) return "success";
  if (score >= 50) return "warning";
  return "error";
}

const RecentMatches = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useMatchHistory();

  const history = data ?? [];
  const rows = history.slice(0, RECENT_LIMIT);
  const dateFormatter = new Intl.DateTimeFormat(i18n.language);

  const openResult = (id: string) => {
    useWizardStore.getState().setMatchId(id);
    useWizardStore.getState().setStep(4);
    void navigate({ to: "/wizard" });
  };

  const columns: TableColumnsType<MatchSummaryDto> = [
    {
      title: t("home.cols.cv"),
      dataIndex: "cvTitle",
      key: "cvTitle",
      ellipsis: true
    },
    {
      title: t("home.cols.jd"),
      dataIndex: "jdTitle",
      key: "jdTitle",
      ellipsis: true
    },
    {
      title: t("home.cols.score"),
      dataIndex: "overallScore",
      key: "overallScore",
      render: (score: number, record) => (
        <Tag color={scoreBand(score)} data-testid={`home-score-${record.id}`}>
          {`${score}%`}
        </Tag>
      )
    },
    {
      title: t("home.cols.date"),
      dataIndex: "createdAt",
      key: "createdAt",
      render: (createdAt: string) => dateFormatter.format(new Date(createdAt))
    }
  ];

  return (
    <SectionCard
      title={t("home.recent.title")}
      bodyClassName="p-0"
      extra={
        history.length > RECENT_LIMIT ? (
          // No dedicated "all matches" page exists yet (out of scope for this
          // task, same kind of intentional follow-up gap as library
          // pagination) — rendered as muted, non-interactive text so it does
          // not read as a broken link.
          <span className="text-sm font-medium text-faint">
            {t("home.recent.viewAll")}
          </span>
        ) : null
      }
    >
      <Table<MatchSummaryDto>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={isLoading}
        pagination={false}
        scroll={{ x: "max-content" }}
        onRow={(record) => ({
          role: "button",
          tabIndex: 0,
          "aria-label": `${record.cvTitle} × ${record.jdTitle}`,
          className: "cursor-pointer",
          onClick: () => openResult(record.id),
          onKeyDown: (event: React.KeyboardEvent) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openResult(record.id);
            }
          }
        })}
        locale={{
          emptyText: (
            <div className="flex flex-col items-center gap-3 py-10">
              <Inbox className="text-faint" size={32} />
              <p className="text-muted">{t("home.recent.empty")}</p>
              <Button
                type="primary"
                icon={<Sparkles size={16} />}
                onClick={() => void navigate({ to: "/wizard" })}
              >
                {t("home.recent.emptyCta")}
              </Button>
            </div>
          )
        }}
      />
    </SectionCard>
  );
};

export default RecentMatches;

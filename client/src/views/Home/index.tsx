import PageContainer from "#/components/PageContainer";
import { useAuth } from "#/hooks/useAuth";
import AccountPerks from "./mains/AccountPerks";
import HeroCta from "./mains/HeroCta";
import RecentMatches from "./mains/RecentMatches";
import StatCards from "./mains/StatCards";

const DEFAULT_GUEST_LIMIT = 5;

const Home = () => {
  const { status, isUser, guestQuota } = useAuth();

  if (status === "loading") {
    return <div data-testid="home-loading" className="min-h-96" />;
  }

  if (!isUser) {
    return (
      <PageContainer className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
        <HeroCta guestLimit={guestQuota?.limit ?? DEFAULT_GUEST_LIMIT} />
        <AccountPerks />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-6">
      <HeroCta />
      <StatCards />
      <RecentMatches />
    </PageContainer>
  );
};

export default Home;

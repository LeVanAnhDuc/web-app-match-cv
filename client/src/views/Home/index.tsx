import PageContainer from "#/components/PageContainer";
import HeroCta from "./mains/HeroCta";
import RecentMatches from "./mains/RecentMatches";
import StatCards from "./mains/StatCards";

const Home = () => (
  <PageContainer className="space-y-6">
    <HeroCta />
    <StatCards />
    <RecentMatches />
  </PageContainer>
);

export default Home;

import PageContainer from "#/components/PageContainer";
import MyDataPanel from "./mains/MyDataPanel";

/**
 * My data page — lets the user download an archive of everything the app
 * stores about them.
 */
const MyData = () => (
  <PageContainer className="space-y-6">
    <MyDataPanel />
  </PageContainer>
);

export default MyData;

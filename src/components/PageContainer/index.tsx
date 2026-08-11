import type { PropsWithChildren } from "react";

const PageContainer = ({
  children,
  className = ""
}: PropsWithChildren<{ className?: string }>) => (
  <div className={`mx-auto w-full max-w-[1600px] p-4 md:p-6 ${className}`}>
    {children}
  </div>
);

export default PageContainer;
